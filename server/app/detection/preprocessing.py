"""
Binary preprocessing module.
Handles binary data interpretation, endianness detection, and view creation.
"""
import hashlib
import logging
from typing import Dict, List, Optional

import numpy as np

from app.detection.types import (
    BinaryMetadata,
    BinaryView,
    DataType,
    Endianness,
)

logger = logging.getLogger(__name__)


def dtype_to_numpy(dtype: DataType) -> str:
    """
    Convert our DataType to NumPy dtype string.
    
    Args:
        dtype: DataType enum value
        
    Returns:
        NumPy dtype string (e.g., '<u2' for little-endian uint16)
    """
    mapping = {
        DataType.U8: 'u1',
        DataType.U16LE: '<u2',
        DataType.U16BE: '>u2',
        DataType.U32LE: '<u4',
        DataType.U32BE: '>u4',
        DataType.S16LE: '<i2',
        DataType.S16BE: '>i2',
        DataType.S32LE: '<i4',
        DataType.S32BE: '>i4',
        DataType.FLOAT32LE: '<f4',
        DataType.FLOAT32BE: '>f4',
    }
    return mapping[dtype]


def calculate_entropy(data: np.ndarray) -> float:
    """
    Calculate Shannon entropy of data.
    
    Args:
        data: NumPy array of integer values
        
    Returns:
        Entropy value (0.0 to log2(num_unique_values))
    """
    if len(data) == 0:
        return 0.0
    
    # Flatten if multidimensional
    flat_data = data.flatten()
    
    # For integer types, count unique values
    if np.issubdtype(data.dtype, np.integer):
        # Limit to reasonable value range to avoid memory issues
        if flat_data.max() - flat_data.min() > 65536:
            # For large ranges, use histogram
            hist, _ = np.histogram(flat_data, bins=256)
            probabilities = hist[hist > 0] / len(flat_data)
        else:
            # Use bincount for smaller ranges
            min_val = int(flat_data.min())
            adjusted = flat_data - min_val
            value_counts = np.bincount(adjusted.astype(np.int64))
            probabilities = value_counts[value_counts > 0] / len(flat_data)
    else:
        # For float types, use histogram
        hist, _ = np.histogram(flat_data, bins=256)
        probabilities = hist[hist > 0] / len(flat_data)
    
    # Calculate entropy
    entropy = -np.sum(probabilities * np.log2(probabilities + 1e-10))
    return float(entropy)


def detect_endianness(raw_bytes: bytes, sample_size: int = 1024) -> Endianness:
    """
    Heuristically detect byte order (endianness).
    
    Strategy: Compare entropy of little-endian vs big-endian interpretations.
    Structured data typically has lower entropy in the correct endianness.
    
    Args:
        raw_bytes: Raw binary data
        sample_size: Number of bytes to sample from beginning
        
    Returns:
        Detected endianness (LITTLE, BIG, or UNKNOWN)
    """
    sample = raw_bytes[:min(sample_size, len(raw_bytes))]
    
    if len(sample) < 4:
        return Endianness.UNKNOWN
    
    try:
        # Interpret as uint16 in both endiannesses
        # Truncate to even length for uint16
        even_length = len(sample) & ~1
        sample = sample[:even_length]
        
        le_data = np.frombuffer(sample, dtype='<u2')
        be_data = np.frombuffer(sample, dtype='>u2')
        
        # Calculate entropy for both
        le_entropy = calculate_entropy(le_data)
        be_entropy = calculate_entropy(be_data)
        
        logger.debug(
            f"Endianness detection: LE entropy={le_entropy:.2f}, "
            f"BE entropy={be_entropy:.2f}"
        )
        
        # Lower entropy suggests correct endianness for structured data
        # Threshold difference to be confident
        if abs(le_entropy - be_entropy) < 0.5:
            return Endianness.UNKNOWN
        
        return Endianness.LITTLE if le_entropy < be_entropy else Endianness.BIG
        
    except Exception as e:
        logger.warning(f"Endianness detection failed: {e}")
        return Endianness.UNKNOWN


def create_binary_views(
    raw_bytes: bytes,
    data_types: List[DataType],
    endianness_hint: Optional[Endianness] = None
) -> BinaryMetadata:
    """
    Create multiple views of binary data with different type interpretations.
    
    Args:
        raw_bytes: Raw binary data
        data_types: List of data types to create views for
        endianness_hint: Optional endianness hint (overrides detection)
        
    Returns:
        BinaryMetadata with all requested views
    """
    # Compute file hash
    file_hash = hashlib.sha256(raw_bytes).hexdigest()
    size_bytes = len(raw_bytes)
    
    # Detect endianness if not provided
    if endianness_hint is None or endianness_hint == Endianness.UNKNOWN:
        detected_endianness = detect_endianness(raw_bytes)
    else:
        detected_endianness = endianness_hint
    
    logger.info(
        f"Processing binary: {size_bytes} bytes, "
        f"hash={file_hash[:16]}..., endianness={detected_endianness}"
    )
    
    # Create views for each data type
    views: Dict[DataType, BinaryView] = {}
    
    for dtype in data_types:
        try:
            np_dtype = dtype_to_numpy(dtype)
            
            # Truncate data to be divisible by itemsize
            itemsize = np.dtype(np_dtype).itemsize
            truncated_length = (len(raw_bytes) // itemsize) * itemsize
            if truncated_length < len(raw_bytes):
                logger.debug(
                    f"Truncated {len(raw_bytes) - truncated_length} bytes "
                    f"for {dtype.value} view"
                )
            
            array = np.frombuffer(raw_bytes[:truncated_length], dtype=np_dtype)
            
            # Determine endianness for this view
            if 'le' in dtype.value.lower():
                view_endianness = Endianness.LITTLE
            elif 'be' in dtype.value.lower():
                view_endianness = Endianness.BIG
            else:
                view_endianness = detected_endianness
            
            views[dtype] = BinaryView(
                data=array,
                dtype=dtype,
                endianness=view_endianness,
                itemsize=array.itemsize
            )
            
            logger.debug(f"Created {dtype.value} view: {len(array)} elements")
            
        except Exception as e:
            logger.error(f"Failed to create view for {dtype.value}: {e}")
            continue
    
    return BinaryMetadata(
        file_hash=file_hash,
        size_bytes=size_bytes,
        detected_endianness=detected_endianness,
        views=views
    )


def preprocess_binary(
    raw_bytes: bytes,
    data_types: Optional[List[str]] = None,
    endianness_hint: Optional[str] = None
) -> BinaryMetadata:
    """
    Main preprocessing function.
    
    Args:
        raw_bytes: Raw binary data
        data_types: List of data type strings (e.g., ['u8', 'u16le', 'u32le'])
        endianness_hint: Optional endianness hint ('little', 'big', 'unknown')
        
    Returns:
        BinaryMetadata with all views
    """
    # Default data types for MVP
    if data_types is None:
        data_types = ['u8', 'u16le', 'u16be', 'u32le']
    
    # Convert string data types to enum
    dtype_enums = [DataType(dt) for dt in data_types]
    
    # Convert endianness hint
    endian_enum = None
    if endianness_hint:
        try:
            endian_enum = Endianness(endianness_hint)
        except ValueError:
            logger.warning(f"Invalid endianness hint: {endianness_hint}")
    
    # Create views
    metadata = create_binary_views(raw_bytes, dtype_enums, endian_enum)
    
    return metadata

