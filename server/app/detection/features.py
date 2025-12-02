"""
Feature extraction and pattern detection module.
Analyzes binary data to find calibration tables and arrays.
"""
import logging
from typing import List, Optional

import numpy as np

from app.detection.types import DetectionResult, WindowFeatures

logger = logging.getLogger(__name__)


def calculate_entropy(data: np.ndarray) -> float:
    """
    Calculate Shannon entropy of data.
    
    Args:
        data: NumPy array
        
    Returns:
        Entropy value
    """
    if len(data) == 0:
        return 0.0
    
    flat_data = data.flatten()
    
    # For continuous data, bin it
    if np.issubdtype(data.dtype, np.floating):
        hist, _ = np.histogram(flat_data, bins=256)
        probabilities = hist[hist > 0] / len(flat_data)
    else:
        # For integer data, use histogram to avoid memory issues with large ranges
        hist, _ = np.histogram(flat_data.astype(np.float64), bins=256)
        probabilities = hist[hist > 0] / len(flat_data)
    
    entropy = -np.sum(probabilities * np.log2(probabilities + 1e-10))
    return float(entropy)


def extract_window_features(
    window: np.ndarray,
    offset: int,
    file_size: int
) -> Optional[WindowFeatures]:
    """
    Extract features from a data window.
    
    Args:
        window: NumPy array of data
        offset: Starting offset in original file (bytes)
        file_size: Total file size for alignment scoring
        
    Returns:
        WindowFeatures object or None if window too small
    """
    if len(window) < 4:
        return None
    
    try:
        # Convert to float for calculations
        window_float = window.astype(np.float64)
        
        # 1. Gradient smoothness
        # Smoother gradients suggest structured data (e.g., lookup tables)
        gradient = np.diff(window_float)
        if len(gradient) > 0:
            gradient_std = np.std(gradient)
            gradient_smoothness = 1.0 / (1.0 + gradient_std)
        else:
            gradient_smoothness = 0.0
        
        # 2. Entropy
        # Lower entropy suggests structured/calibrated data
        entropy = calculate_entropy(window)
        
        # 3. Value range (normalized)
        min_val, max_val = np.min(window), np.max(window)
        if np.issubdtype(window.dtype, np.integer):
            # Get max value for this dtype
            try:
                dtype_max = np.iinfo(window.dtype).max
                value_range_normalized = (max_val - min_val) / dtype_max if dtype_max > 0 else 0.0
            except ValueError:
                # If iinfo fails, use actual range
                value_range_normalized = float(max_val - min_val) / 65535.0
        else:
            # For floats, normalize to [0, 1] range
            value_range_normalized = float(max_val - min_val)
        
        # 4. Monotonicity
        # High monotonicity suggests 1D lookup tables
        if len(gradient) > 0:
            increasing = np.sum(gradient > 0)
            decreasing = np.sum(gradient < 0)
            monotonicity = max(increasing, decreasing) / len(gradient)
        else:
            monotonicity = 0.0
        
        # 5. Boundary alignment
        # Prefer power-of-2 aligned offsets (common in firmware)
        if offset % 512 == 0:
            alignment_score = 1.0
        elif offset % 256 == 0:
            alignment_score = 0.8
        elif offset % 64 == 0:
            alignment_score = 0.5
        elif offset % 16 == 0:
            alignment_score = 0.3
        elif offset % 4 == 0:
            alignment_score = 0.2
        else:
            alignment_score = 0.1
        
        return WindowFeatures(
            offset=offset,
            size=len(window),
            gradient_smoothness=float(gradient_smoothness),
            entropy=float(entropy),
            value_range_normalized=float(value_range_normalized),
            monotonicity=float(monotonicity),
            boundary_alignment_score=float(alignment_score),
        )
        
    except Exception as e:
        logger.error(f"Feature extraction failed at offset {offset}: {e}")
        return None


def detect_pattern_type(features: WindowFeatures) -> tuple[str, float]:
    """
    Detect pattern type based on features.
    
    Args:
        features: Extracted window features
        
    Returns:
        Tuple of (pattern_type, confidence)
        pattern_type: '1d_array', '2d_table', or 'unknown'
        confidence: 0.0 to 1.0
    """
    # Simple heuristic-based detection for MVP
    
    # 1D array characteristics:
    # - High monotonicity
    # - Low entropy
    # - Good alignment
    array_1d_score = (
        features.monotonicity * 0.5 +
        (1.0 - features.entropy / 8.0) * 0.3 +  # Normalize entropy (max ~8 for 256 bins)
        features.boundary_alignment_score * 0.2
    )
    
    # 2D table characteristics:
    # - Smooth gradients
    # - Moderate entropy
    # - Good alignment
    table_2d_score = (
        features.gradient_smoothness * 0.4 +
        (features.entropy / 8.0) * 0.3 +  # Tables have moderate entropy
        features.boundary_alignment_score * 0.3
    )
    
    # Determine pattern type
    if array_1d_score > 0.6:
        return '1d_array', min(array_1d_score, 1.0)
    elif table_2d_score > 0.5:
        return '2d_table', min(table_2d_score, 1.0)
    else:
        return 'unknown', max(array_1d_score, table_2d_score)


def extract_features_sliding_window(
    data: np.ndarray,
    window_size: int = 64,
    stride: int = 32,
    file_size: int = 0,
    min_confidence: float = 0.5
) -> List[DetectionResult]:
    """
    Extract features using sliding window and detect patterns.
    
    Args:
        data: NumPy array of binary data (single view)
        window_size: Size of window in elements
        stride: Stride between windows
        file_size: Total file size for alignment scoring
        min_confidence: Minimum confidence threshold for detection
        
    Returns:
        List of DetectionResult for windows above confidence threshold
    """
    from app.detection.types import DataType
    
    detections: List[DetectionResult] = []
    
    # Determine data type from numpy dtype
    if data.dtype == np.uint8:
        data_type = DataType.U8
    elif data.dtype == np.dtype('<u2'):
        data_type = DataType.U16LE
    elif data.dtype == np.dtype('>u2'):
        data_type = DataType.U16BE
    elif data.dtype == np.dtype('<u4'):
        data_type = DataType.U32LE
    elif data.dtype == np.dtype('>u4'):
        data_type = DataType.U32BE
    elif data.dtype == np.dtype('<i2'):
        data_type = DataType.S16LE
    elif data.dtype == np.dtype('>i2'):
        data_type = DataType.S16BE
    elif data.dtype == np.dtype('<i4'):
        data_type = DataType.S32LE
    elif data.dtype == np.dtype('>i4'):
        data_type = DataType.S32BE
    elif data.dtype == np.dtype('<f4'):
        data_type = DataType.FLOAT32LE
    elif data.dtype == np.dtype('>f4'):
        data_type = DataType.FLOAT32BE
    else:
        data_type = DataType.U8  # Default
    
    # Slide window across data
    for i in range(0, len(data) - window_size + 1, stride):
        window = data[i:i + window_size]
        offset = i * data.itemsize  # Convert to byte offset
        
        # Extract features
        features = extract_window_features(window, offset, file_size)
        if features is None:
            continue
        
        # Detect pattern type
        pattern_type, confidence = detect_pattern_type(features)
        
        # Only keep detections above threshold
        if confidence >= min_confidence:
            detections.append(DetectionResult(
                offset=offset,
                size=window_size * data.itemsize,
                data_type=data_type,
                confidence=confidence,
                pattern_type=pattern_type,
                features=features
            ))
    
    logger.info(
        f"Found {len(detections)} patterns above confidence {min_confidence} "
        f"(scanned {len(data)} elements with window_size={window_size}, stride={stride})"
    )
    
    return detections


def merge_overlapping_detections(
    detections: List[DetectionResult],
    overlap_threshold: float = 0.5
) -> List[DetectionResult]:
    """
    Merge overlapping detections to reduce duplicates.
    
    Args:
        detections: List of detection results
        overlap_threshold: Minimum overlap ratio to merge (0.0 to 1.0)
        
    Returns:
        List of merged detections
    """
    if not detections:
        return []
    
    # Sort by offset
    sorted_detections = sorted(detections, key=lambda d: d.offset)
    
    merged: List[DetectionResult] = []
    current = sorted_detections[0]
    
    for next_det in sorted_detections[1:]:
        current_end = current.offset + current.size
        next_end = next_det.offset + next_det.size
        
        # Check for overlap
        overlap_start = max(current.offset, next_det.offset)
        overlap_end = min(current_end, next_end)
        overlap_size = max(0, overlap_end - overlap_start)
        
        # Calculate overlap ratio
        overlap_ratio = overlap_size / min(current.size, next_det.size)
        
        if overlap_ratio >= overlap_threshold:
            # Merge: keep the one with higher confidence
            if next_det.confidence > current.confidence:
                current = next_det
            # else keep current
        else:
            # No overlap, add current and move to next
            merged.append(current)
            current = next_det
    
    # Add the last one
    merged.append(current)
    
    logger.info(f"Merged {len(detections)} detections into {len(merged)} unique patterns")
    
    return merged

