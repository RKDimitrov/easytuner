"""
Type definitions for the detection pipeline.
"""
from dataclasses import dataclass
from enum import Enum
from typing import Dict

import numpy as np


class DataType(str, Enum):
    """Supported data types for binary interpretation."""
    U8 = "u8"
    U16LE = "u16le"
    U16BE = "u16be"
    U32LE = "u32le"
    U32BE = "u32be"
    S16LE = "s16le"
    S16BE = "s16be"
    S32LE = "s32le"
    S32BE = "s32be"
    FLOAT32LE = "float32le"
    FLOAT32BE = "float32be"


class Endianness(str, Enum):
    """Byte order."""
    LITTLE = "little"
    BIG = "big"
    UNKNOWN = "unknown"


@dataclass
class BinaryView:
    """Represents binary data interpreted as a specific data type."""
    data: np.ndarray
    dtype: DataType
    endianness: Endianness
    itemsize: int
    
    def __len__(self) -> int:
        """Return number of elements in the view."""
        return len(self.data)


@dataclass
class BinaryMetadata:
    """Metadata about the binary file."""
    file_hash: str  # SHA-256
    size_bytes: int
    detected_endianness: Endianness
    views: Dict[DataType, BinaryView]


@dataclass
class WindowFeatures:
    """Features extracted from a data window."""
    offset: int  # Starting offset in bytes
    size: int    # Window size in elements
    
    # Statistical features
    gradient_smoothness: float
    entropy: float
    value_range_normalized: float
    monotonicity: float
    
    # Structural features
    boundary_alignment_score: float
    
    def to_dict(self) -> Dict[str, float]:
        """Convert to dictionary for JSON serialization."""
        return {
            'offset': self.offset,
            'size': self.size,
            'gradient_smoothness': self.gradient_smoothness,
            'entropy': self.entropy,
            'value_range_normalized': self.value_range_normalized,
            'monotonicity': self.monotonicity,
            'boundary_alignment_score': self.boundary_alignment_score,
        }


@dataclass
class DetectionResult:
    """Result of pattern detection in a window."""
    offset: int
    size: int
    data_type: DataType
    confidence: float
    pattern_type: str  # '1d_array', '2d_table', 'unknown'
    features: WindowFeatures
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        return {
            'offset': self.offset,
            'size': self.size,
            'data_type': self.data_type.value,
            'confidence': self.confidence,
            'pattern_type': self.pattern_type,
            'features': self.features.to_dict(),
        }

