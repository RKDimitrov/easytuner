"""
ECU Map Detection - Element Interpretation Module

This module implements algorithms to convert binary blocks into numeric arrays
and explore different dimensional interpretations to find map-like structures.

Key algorithms:
- Multi-format element conversion (1, 2, 4 bytes)
- Endianness handling (little-endian, big-endian)
- Width discovery using divisors and linear search
- Array reshaping into 2D format
"""

import numpy as np
from typing import List, Tuple, Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum


class ElementType(Enum):
    """Supported element types for interpretation."""
    UINT8 = "uint8"
    INT8 = "int8"
    UINT16 = "uint16"
    INT16 = "int16"
    UINT32 = "uint32"
    INT32 = "int32"
    FLOAT32 = "float32"


class Endianness(Enum):
    """Supported endianness types."""
    LITTLE = "<"
    BIG = ">"


@dataclass
class ElementInterpretation:
    """Configuration for element interpretation."""
    element_type: ElementType
    endianness: Endianness
    element_size: int
    min_len: int = 8 # Add this line


@dataclass
class ReshapeResult:
    """Result of array reshaping operation."""
    array_2d: np.ndarray
    width: int
    height: int
    element_count: int
    remainder_bytes: int


def get_supported_element_types() -> List[ElementInterpretation]:
    """
    Get list of all supported element interpretations.
    
    Returns:
        List of ElementInterpretation objects
    """
    interpretations = []
    min_len = 8 # Define the minimum axis length
    
    # OPTIMIZED: Only test the most common types used in ECU maps
    # This dramatically reduces the search space from 16 to 3 types
    
    # 1-byte elements
    interpretations.append(ElementInterpretation(ElementType.UINT8, Endianness.LITTLE, 1, min_len))
    
    # 2-byte elements (TEST BOTH ENDIANS, both are common)
    interpretations.append(ElementInterpretation(ElementType.UINT16, Endianness.LITTLE, 2, min_len))
    interpretations.append(ElementInterpretation(ElementType.UINT16, Endianness.BIG, 2, min_len))
    
    # 4-byte float (little-endian only, most common)
    interpretations.append(ElementInterpretation(ElementType.FLOAT32, Endianness.LITTLE, 4, min_len))
    
    # OPTIONAL: Uncomment these lines to test more types (slower):
    # interpretations.extend([
    #     ElementInterpretation(ElementType.INT8, Endianness.LITTLE, 1, min_len),
    #     ElementInterpretation(ElementType.INT16, Endianness.LITTLE, 2, min_len),
    # ])
    # for endianness in [Endianness.LITTLE, Endianness.BIG]:
    #     interpretations.extend([
    #         ElementInterpretation(ElementType.UINT32, endianness, 4, min_len),
    #         ElementInterpretation(ElementType.INT32, endianness, 4, min_len),
    #         ElementInterpretation(ElementType.FLOAT32, endianness, 4, min_len),
    #     ])
    
    return interpretations


def bytes_to_array(data: bytes, interpretation: ElementInterpretation) -> np.ndarray:
    """
    Convert bytes to numpy array using specified interpretation.
    
    Args:
        data: Input byte data
        interpretation: Element interpretation configuration
        
    Returns:
        Numpy array with specified dtype and endianness
    """
    if len(data) == 0:
        return np.array([], dtype=np.float64)
    
    # Create numpy dtype string
    if interpretation.element_size == 1:
        # 1-byte types don't need endianness
        dtype_str = interpretation.element_type.value
    else:
        # Multi-byte types need endianness
        # Map element types to numpy dtype codes
        type_mapping = {
            ElementType.UINT16: "u2",
            ElementType.INT16: "i2", 
            ElementType.UINT32: "u4",
            ElementType.INT32: "i4",
            ElementType.FLOAT32: "f4"
        }
        
        numpy_type = type_mapping[interpretation.element_type]
        dtype_str = f"{interpretation.endianness.value}{numpy_type}"
    
    try:
        # Convert bytes to array
        array = np.frombuffer(data, dtype=dtype_str)
        
        # Convert to float64 for consistent processing, handling NaN values
        if array.size > 0:
            # Check for NaN values and handle them
            if np.any(np.isnan(array)):
                # Replace NaN with 0 for consistent processing
                array = np.nan_to_num(array, nan=0.0)
            
            return array.astype(np.float64)
        else:
            return np.array([], dtype=np.float64)
    
    except (ValueError, TypeError) as e:
        # Handle conversion errors gracefully
        return np.array([], dtype=np.float64)


def discover_candidate_widths(element_count: int, max_width: int = 1024, min_width: int = 4) -> List[int]:
    """
    Discover candidate widths for reshaping using divisors and linear search.
    
    Args:
        element_count: Total number of elements
        max_width: Maximum width to consider
        min_width: Minimum width to consider
        
    Returns:
        List of candidate widths (limited to 200 for performance)
    """
    widths = set()
    
    # Method 1: Divisor-based discovery
    for width in range(min_width, min(max_width + 1, element_count // 2 + 1)):
        if element_count % width == 0:
            heights = element_count // width
            if heights >= 2:  # Need at least 2 rows
                widths.add(width)
    
    # Method 2: Linear search as fallback
    if not widths:
        # Try common widths
        common_widths = [8, 16, 32, 64, 128, 256, 512]
        for width in common_widths:
            if min_width <= width <= max_width and element_count >= width * 2:
                heights = element_count // width
                if heights >= 2:
                    widths.add(width)
    
    # Convert to sorted list and limit for performance
    width_list = sorted(list(widths))
    return width_list[:200]  # Performance limit


def reshape_to_2d(array: np.ndarray, width: int) -> ReshapeResult:
    """
    Reshape 1D array into 2D array with specified width.
    
    Args:
        array: Input 1D array
        width: Desired width for reshaping
        
    Returns:
        ReshapeResult with 2D array and metadata
    """
    element_count = len(array)
    
    if element_count < width * 2:
        # Not enough elements for meaningful reshaping
        return ReshapeResult(
            array_2d=np.array([]).reshape(0, width),
            width=width,
            height=0,
            element_count=element_count,
            remainder_bytes=element_count  # All elements are remainder
        )
    
    # Calculate number of complete rows
    complete_elements = (element_count // width) * width
    height = element_count // width
    remainder_elements = element_count - complete_elements
    
    # Reshape to 2D array
    array_2d = array[:complete_elements].reshape(height, width)
    
    return ReshapeResult(
        array_2d=array_2d,
        width=width,
        height=height,
        element_count=complete_elements,
        remainder_bytes=remainder_elements
    )


def interpret_block(
    data: bytes,
    interpretation: ElementInterpretation,
    max_width: int = 1024,
    min_width: int = 4
) -> List[ReshapeResult]:
    """
    Interpret a binary block using specified element type and find candidate 2D shapes.
    
    Args:
        data: Binary data block
        interpretation: Element interpretation configuration
        max_width: Maximum width to consider
        min_width: Minimum width to consider
        
    Returns:
        List of ReshapeResult objects for different widths
    """
    # Convert bytes to array
    array = bytes_to_array(data, interpretation)
    
    if len(array) == 0:
        return []
    
    # Discover candidate widths
    widths = discover_candidate_widths(len(array), max_width, min_width)
    
    # Reshape for each width
    results = []
    for width in widths:
        reshape_result = reshape_to_2d(array, width)
        if reshape_result.height >= 2:  # Need at least 2 rows
            results.append(reshape_result)
    
    return results


def interpret_all_element_types(
    data: bytes,
    max_width: int = 1024,
    min_width: int = 4
) -> Dict[str, List[ReshapeResult]]:
    """
    Interpret binary data using all supported element types and endianness.
    
    Args:
        data: Binary data block
        max_width: Maximum width to consider
        min_width: Minimum width to consider
        
    Returns:
        Dictionary mapping interpretation names to lists of ReshapeResult objects
    """
    interpretations = get_supported_element_types()
    results = {}
    
    for interpretation in interpretations:
        # Create unique key for this interpretation
        key = f"{interpretation.element_type.value}_{interpretation.endianness.value}"
        
        # Interpret the block
        reshape_results = interpret_block(data, interpretation, max_width, min_width)
        
        if reshape_results:
            results[key] = reshape_results
    
    return results


def get_interpretation_info(interpretation: ElementInterpretation) -> Dict[str, Any]:
    """
    Get information about an element interpretation.
    
    Args:
        interpretation: Element interpretation configuration
        
    Returns:
        Dictionary with interpretation information
    """
    return {
        "element_type": interpretation.element_type.value,
        "endianness": "little" if interpretation.endianness == Endianness.LITTLE else "big",
        "element_size": interpretation.element_size,
        "dtype": interpretation.element_type.value,
        "is_signed": interpretation.element_type.value.startswith("int"),
        "is_float": interpretation.element_type.value.startswith("float")
    }


def analyze_reshape_quality(reshape_result: ReshapeResult) -> Dict[str, Any]:
    """
    Analyze the quality of a reshape result for map detection.
    
    Args:
        reshape_result: Reshape result to analyze
        
    Returns:
        Dictionary with quality metrics
    """
    if reshape_result.height < 2:
        return {
            "valid": False,
            "reason": "insufficient_height"
        }
    
    array = reshape_result.array_2d
    
    # Basic statistics
    min_val = float(np.min(array))
    max_val = float(np.max(array))
    mean_val = float(np.mean(array))
    std_val = float(np.std(array))
    
    # Check for reasonable value ranges
    value_range = max_val - min_val
    dynamic_range = std_val / (abs(mean_val) + 1e-9)
    
    # Check for NaN or infinite values (especially for floats)
    nan_count = np.sum(np.isnan(array))
    inf_count = np.sum(np.isinf(array))
    
    # Calculate coverage (non-zero elements)
    non_zero_count = np.sum(array != 0)
    coverage = non_zero_count / array.size
    
    return {
        "valid": True,
        "height": reshape_result.height,
        "width": reshape_result.width,
        "element_count": reshape_result.element_count,
        "remainder_bytes": reshape_result.remainder_bytes,
        "min_value": min_val,
        "max_value": max_val,
        "mean_value": mean_val,
        "std_value": std_val,
        "value_range": value_range,
        "dynamic_range": dynamic_range,
        "nan_count": int(nan_count),
        "inf_count": int(inf_count),
        "coverage": coverage,
        "aspect_ratio": reshape_result.height / reshape_result.width
    }