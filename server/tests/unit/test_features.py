"""Unit tests for feature extraction and pattern detection."""
import numpy as np
import pytest

from app.detection.features import (
    calculate_entropy,
    detect_pattern_type,
    extract_features_sliding_window,
    extract_window_features,
    merge_overlapping_detections,
)
from app.detection.types import DataType, DetectionResult, WindowFeatures


def test_calculate_entropy_uniform():
    """Test entropy for uniform data."""
    data = np.ones(100, dtype=np.uint8) * 42
    entropy = calculate_entropy(data)
    assert entropy < 0.01  # Very low entropy for uniform data


def test_calculate_entropy_binary():
    """Test entropy for binary data."""
    data = np.array([0, 1] * 50, dtype=np.uint8)
    entropy = calculate_entropy(data)
    assert 0.9 < entropy < 1.1  # Close to 1 bit


def test_calculate_entropy_float():
    """Test entropy for float data."""
    data = np.random.rand(100).astype(np.float32)
    entropy = calculate_entropy(data)
    assert entropy > 0


def test_extract_window_features_too_small():
    """Test feature extraction with too small window."""
    window = np.array([1, 2], dtype=np.uint8)
    features = extract_window_features(window, 0, 1000)
    assert features is None


def test_extract_window_features_monotonic():
    """Test feature extraction for monotonic data."""
    window = np.arange(64, dtype=np.uint8)
    features = extract_window_features(window, 0, 1000)
    
    assert features is not None
    assert features.offset == 0
    assert features.size == 64
    assert features.monotonicity > 0.9  # Highly monotonic


def test_extract_window_features_random():
    """Test feature extraction for random data."""
    np.random.seed(42)
    window = np.random.randint(0, 256, size=64, dtype=np.uint8)
    features = extract_window_features(window, 0, 1000)
    
    assert features is not None
    assert features.monotonicity < 0.7  # Not very monotonic


def test_extract_window_features_alignment():
    """Test boundary alignment scoring."""
    window = np.arange(64, dtype=np.uint8)
    
    # Test different alignments
    features_512 = extract_window_features(window, 512, 1000)
    features_64 = extract_window_features(window, 64, 1000)
    features_7 = extract_window_features(window, 7, 1000)
    
    assert features_512.boundary_alignment_score == 1.0
    assert features_64.boundary_alignment_score == 0.5
    assert features_7.boundary_alignment_score == 0.1


def test_extract_window_features_gradient_smoothness():
    """Test gradient smoothness calculation."""
    # Smooth gradient
    smooth_window = np.arange(64, dtype=np.uint8)
    smooth_features = extract_window_features(smooth_window, 0, 1000)
    
    # Rough gradient
    rough_window = np.array([i if i % 2 == 0 else 0 for i in range(64)], dtype=np.uint8)
    rough_features = extract_window_features(rough_window, 0, 1000)
    
    assert smooth_features.gradient_smoothness > rough_features.gradient_smoothness


def test_detect_pattern_type_1d_array():
    """Test 1D array pattern detection."""
    features = WindowFeatures(
        offset=0,
        size=64,
        gradient_smoothness=0.9,
        entropy=2.0,
        value_range_normalized=0.8,
        monotonicity=0.95,  # High monotonicity
        boundary_alignment_score=1.0
    )
    
    pattern_type, confidence = detect_pattern_type(features)
    assert pattern_type == '1d_array'
    assert confidence > 0.6


def test_detect_pattern_type_2d_table():
    """Test 2D table pattern detection."""
    features = WindowFeatures(
        offset=0,
        size=64,
        gradient_smoothness=0.8,  # Smooth
        entropy=4.0,  # Moderate entropy
        value_range_normalized=0.7,
        monotonicity=0.3,  # Low monotonicity
        boundary_alignment_score=1.0
    )
    
    pattern_type, confidence = detect_pattern_type(features)
    assert pattern_type == '2d_table'
    assert confidence > 0.5


def test_detect_pattern_type_unknown():
    """Test unknown pattern detection."""
    features = WindowFeatures(
        offset=0,
        size=64,
        gradient_smoothness=0.3,
        entropy=7.0,  # High entropy
        value_range_normalized=0.5,
        monotonicity=0.2,
        boundary_alignment_score=0.1
    )
    
    pattern_type, confidence = detect_pattern_type(features)
    assert pattern_type == 'unknown'
    assert confidence < 0.6


def test_extract_features_sliding_window():
    """Test sliding window feature extraction."""
    # Create monotonic data
    data = np.arange(256, dtype=np.uint8)
    
    detections = extract_features_sliding_window(
        data,
        window_size=64,
        stride=32,
        file_size=256,
        min_confidence=0.3
    )
    
    assert len(detections) > 0
    assert all(isinstance(d, DetectionResult) for d in detections)


def test_extract_features_sliding_window_confidence_threshold():
    """Test that confidence threshold filters results."""
    data = np.arange(256, dtype=np.uint8)
    
    low_threshold = extract_features_sliding_window(
        data, window_size=64, stride=32, min_confidence=0.3
    )
    high_threshold = extract_features_sliding_window(
        data, window_size=64, stride=32, min_confidence=0.8
    )
    
    assert len(low_threshold) >= len(high_threshold)


def test_extract_features_different_window_sizes():
    """Test different window sizes."""
    data = np.arange(256, dtype=np.uint8)
    
    small_window = extract_features_sliding_window(
        data, window_size=32, stride=16, min_confidence=0.3
    )
    large_window = extract_features_sliding_window(
        data, window_size=128, stride=64, min_confidence=0.3
    )
    
    # Smaller windows should produce more detections
    assert len(small_window) >= len(large_window)


def test_detection_result_to_dict():
    """Test DetectionResult serialization."""
    features = WindowFeatures(
        offset=0,
        size=64,
        gradient_smoothness=0.8,
        entropy=3.0,
        value_range_normalized=0.7,
        monotonicity=0.9,
        boundary_alignment_score=1.0
    )
    
    detection = DetectionResult(
        offset=0,
        size=128,
        data_type=DataType.U16LE,
        confidence=0.85,
        pattern_type='1d_array',
        features=features
    )
    
    result_dict = detection.to_dict()
    
    assert result_dict['offset'] == 0
    assert result_dict['size'] == 128
    assert result_dict['data_type'] == 'u16le'
    assert result_dict['confidence'] == 0.85
    assert result_dict['pattern_type'] == '1d_array'
    assert 'features' in result_dict


def test_merge_overlapping_detections_no_overlap():
    """Test merging detections with no overlap."""
    features1 = WindowFeatures(0, 64, 0.8, 3.0, 0.7, 0.9, 1.0)
    features2 = WindowFeatures(128, 64, 0.8, 3.0, 0.7, 0.9, 1.0)
    
    detections = [
        DetectionResult(0, 64, DataType.U8, 0.8, '1d_array', features1),
        DetectionResult(128, 64, DataType.U8, 0.7, '1d_array', features2),
    ]
    
    merged = merge_overlapping_detections(detections, overlap_threshold=0.5)
    
    assert len(merged) == 2  # No overlap, both kept


def test_merge_overlapping_detections_with_overlap():
    """Test merging overlapping detections."""
    features1 = WindowFeatures(0, 64, 0.8, 3.0, 0.7, 0.9, 1.0)
    features2 = WindowFeatures(32, 64, 0.8, 3.0, 0.7, 0.9, 1.0)
    
    detections = [
        DetectionResult(0, 64, DataType.U8, 0.7, '1d_array', features1),
        DetectionResult(32, 64, DataType.U8, 0.8, '1d_array', features2),
    ]
    
    merged = merge_overlapping_detections(detections, overlap_threshold=0.5)
    
    assert len(merged) == 1  # Overlapping, merged to 1
    assert merged[0].confidence == 0.8  # Kept higher confidence


def test_merge_overlapping_detections_keep_best():
    """Test that merging keeps the best confidence."""
    features1 = WindowFeatures(0, 64, 0.8, 3.0, 0.7, 0.9, 1.0)
    features2 = WindowFeatures(16, 64, 0.8, 3.0, 0.7, 0.9, 1.0)
    features3 = WindowFeatures(32, 64, 0.8, 3.0, 0.7, 0.9, 1.0)
    
    detections = [
        DetectionResult(0, 64, DataType.U8, 0.6, '1d_array', features1),
        DetectionResult(16, 64, DataType.U8, 0.9, '1d_array', features2),
        DetectionResult(32, 64, DataType.U8, 0.7, '1d_array', features3),
    ]
    
    merged = merge_overlapping_detections(detections, overlap_threshold=0.5)
    
    # All three overlap significantly, should merge to 1
    assert len(merged) <= 2
    # Best confidence should be kept
    assert any(d.confidence >= 0.9 for d in merged)


def test_merge_empty_detections():
    """Test merging empty detection list."""
    merged = merge_overlapping_detections([], overlap_threshold=0.5)
    assert len(merged) == 0


def test_extract_features_u16le_data():
    """Test feature extraction with uint16 little-endian data."""
    data = np.arange(128, dtype='<u2')
    
    detections = extract_features_sliding_window(
        data, window_size=32, stride=16, min_confidence=0.3
    )
    
    assert len(detections) > 0
    assert all(d.data_type == DataType.U16LE for d in detections)


def test_extract_features_realistic_firmware():
    """Test feature extraction with realistic firmware-like data."""
    # Simulate a calibration table: smooth increasing values
    calibration_table = np.array([
        1000 + i * 10 for i in range(64)
    ], dtype='<u2')
    
    # Add some noise/random data
    noise = np.random.randint(0, 65535, size=64, dtype='<u2')
    
    data = np.concatenate([calibration_table, noise])
    
    detections = extract_features_sliding_window(
        data, window_size=32, stride=16, min_confidence=0.5
    )
    
    # Should detect the calibration table region
    assert len(detections) > 0
    
    # First detections should have high confidence (from calibration region)
    if detections:
        assert detections[0].confidence > 0.5

