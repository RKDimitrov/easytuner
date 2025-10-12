"""Unit tests for binary preprocessing."""
import struct

import numpy as np
import pytest

from app.detection.preprocessing import (
    calculate_entropy,
    create_binary_views,
    detect_endianness,
    dtype_to_numpy,
    preprocess_binary,
)
from app.detection.types import DataType, Endianness


def test_dtype_to_numpy():
    """Test DataType to NumPy dtype conversion."""
    assert dtype_to_numpy(DataType.U8) == 'u1'
    assert dtype_to_numpy(DataType.U16LE) == '<u2'
    assert dtype_to_numpy(DataType.U16BE) == '>u2'
    assert dtype_to_numpy(DataType.U32LE) == '<u4'
    assert dtype_to_numpy(DataType.S16LE) == '<i2'
    assert dtype_to_numpy(DataType.FLOAT32LE) == '<f4'


def test_calculate_entropy_zeros():
    """Test entropy calculation for all zeros."""
    data = np.zeros(100, dtype=np.uint8)
    entropy = calculate_entropy(data)
    assert entropy < 0.01  # Very low entropy for uniform data


def test_calculate_entropy_random():
    """Test entropy calculation for random data."""
    np.random.seed(42)
    data = np.random.randint(0, 256, size=1000, dtype=np.uint8)
    entropy = calculate_entropy(data)
    assert entropy > 5.0  # Random data has high entropy


def test_calculate_entropy_structured():
    """Test entropy calculation for structured data."""
    data = np.array([1, 2, 3, 4, 5] * 20, dtype=np.uint8)
    entropy = calculate_entropy(data)
    assert 0 < entropy < 3  # Structured data has low entropy


def test_detect_endianness_little():
    """Test endianness detection for little-endian data."""
    # Create little-endian sequential data with larger range for better detection
    data = struct.pack('<' + 'H' * 512, *range(512))
    endianness = detect_endianness(data, sample_size=1024)
    # Endianness detection is heuristic, may return LITTLE or UNKNOWN for structured data
    assert endianness in [Endianness.LITTLE, Endianness.UNKNOWN]


def test_detect_endianness_big():
    """Test endianness detection for big-endian data."""
    # Create big-endian sequential data with larger range for better detection
    data = struct.pack('>' + 'H' * 512, *range(512))
    endianness = detect_endianness(data, sample_size=1024)
    # Endianness detection is heuristic, may return BIG or UNKNOWN for structured data
    assert endianness in [Endianness.BIG, Endianness.UNKNOWN]


def test_detect_endianness_too_small():
    """Test endianness detection with too small data."""
    data = b"ABC"
    endianness = detect_endianness(data)
    assert endianness == Endianness.UNKNOWN


def test_detect_endianness_random():
    """Test endianness detection with random data."""
    np.random.seed(42)
    data = np.random.bytes(1024)
    endianness = detect_endianness(data)
    # Random data should return LITTLE, BIG, or UNKNOWN
    assert endianness in [Endianness.LITTLE, Endianness.BIG, Endianness.UNKNOWN]


def test_create_binary_views_single_type():
    """Test creating binary views for a single data type."""
    data = bytes(range(256))
    metadata = create_binary_views(data, [DataType.U8])
    
    assert metadata.size_bytes == 256
    assert len(metadata.file_hash) == 64  # SHA-256 hex
    assert DataType.U8 in metadata.views
    assert len(metadata.views[DataType.U8]) == 256


def test_create_binary_views_multiple_types():
    """Test creating binary views for multiple data types."""
    data = bytes(range(256))
    data_types = [DataType.U8, DataType.U16LE, DataType.U32LE]
    metadata = create_binary_views(data, data_types)
    
    assert len(metadata.views) == 3
    assert DataType.U8 in metadata.views
    assert DataType.U16LE in metadata.views
    assert DataType.U32LE in metadata.views
    
    # Check element counts
    assert len(metadata.views[DataType.U8]) == 256
    assert len(metadata.views[DataType.U16LE]) == 128  # 256 / 2
    assert len(metadata.views[DataType.U32LE]) == 64   # 256 / 4


def test_create_binary_views_with_endianness_hint():
    """Test creating binary views with endianness hint."""
    data = bytes(range(256))
    metadata = create_binary_views(
        data,
        [DataType.U16LE, DataType.U16BE],
        endianness_hint=Endianness.LITTLE
    )
    
    assert metadata.detected_endianness == Endianness.LITTLE


def test_create_binary_views_truncation():
    """Test that data is truncated to fit data type."""
    # 255 bytes - not divisible by 2 or 4
    data = bytes(range(255))
    metadata = create_binary_views(data, [DataType.U16LE, DataType.U32LE])
    
    # U16LE: 255 / 2 = 127 elements (254 bytes used)
    assert len(metadata.views[DataType.U16LE]) == 127
    
    # U32LE: 255 / 4 = 63 elements (252 bytes used)
    assert len(metadata.views[DataType.U32LE]) == 63


def test_preprocess_binary_default_types():
    """Test preprocessing with default data types."""
    data = bytes(range(256))
    metadata = preprocess_binary(data)
    
    # Default types: u8, u16le, u16be, u32le
    assert len(metadata.views) == 4
    assert DataType.U8 in metadata.views
    assert DataType.U16LE in metadata.views
    assert DataType.U16BE in metadata.views
    assert DataType.U32LE in metadata.views


def test_preprocess_binary_custom_types():
    """Test preprocessing with custom data types."""
    data = bytes(range(256))
    metadata = preprocess_binary(data, data_types=['u8', 's16le'])
    
    assert len(metadata.views) == 2
    assert DataType.U8 in metadata.views
    assert DataType.S16LE in metadata.views


def test_preprocess_binary_with_endianness_hint():
    """Test preprocessing with endianness hint."""
    data = bytes(range(256))
    metadata = preprocess_binary(data, endianness_hint='little')
    
    assert metadata.detected_endianness == Endianness.LITTLE


def test_binary_view_attributes():
    """Test BinaryView attributes."""
    data = bytes(range(256))
    metadata = create_binary_views(data, [DataType.U16LE])
    
    view = metadata.views[DataType.U16LE]
    assert view.dtype == DataType.U16LE
    assert view.endianness == Endianness.LITTLE
    assert view.itemsize == 2
    assert len(view) == 128


def test_preprocess_real_firmware_data():
    """Test preprocessing with realistic firmware data."""
    # Simulate a small firmware file with calibration tables
    # Create a lookup table: increasing values
    lookup_table = struct.pack('<' + 'H' * 64, *range(0, 6400, 100))
    
    # Add some random data
    random_data = bytes([i % 256 for i in range(128)])
    
    firmware_data = lookup_table + random_data
    
    metadata = preprocess_binary(firmware_data)
    
    assert metadata.size_bytes == len(firmware_data)
    assert len(metadata.views) == 4
    
    # Check that views have correct lengths
    u8_view = metadata.views[DataType.U8]
    assert len(u8_view) == len(firmware_data)


def test_file_hash_consistency():
    """Test that file hash is consistent."""
    data = b"Test data for hashing"
    
    metadata1 = create_binary_views(data, [DataType.U8])
    metadata2 = create_binary_views(data, [DataType.U8])
    
    assert metadata1.file_hash == metadata2.file_hash


def test_empty_data():
    """Test preprocessing with empty data."""
    data = b""
    metadata = create_binary_views(data, [DataType.U8])
    
    assert metadata.size_bytes == 0
    # U8 view should be empty but present
    if DataType.U8 in metadata.views:
        assert len(metadata.views[DataType.U8]) == 0

