"""
ECU Map Detection - Realistic Map Filters

Filters candidates based on realistic ECU map characteristics.

Real ECU maps typically:
- Have reasonable dimensions (e.g., 3-40 rows, 3-40 columns)
- Store realistic numeric values
- Are not too large or too small
"""

import numpy as np
from typing import Dict, Any

# Define constants for map dimensions
MIN_ROWS = 3
MAX_ROWS = 40
MIN_COLS = 3
MAX_COLS = 40

def is_realistic_map_dimensions(width: int, height: int) -> bool:
    """
    Check if map dimensions are realistic for ECU maps.
    
    Real ECU maps are typically:
    - Small to medium sized: 3-40 rows, 3-40 columns
    - Not extremely wide or tall (704x2 is unrealistic)
    - Have reasonable aspect ratios
    
    Args:
        width: Number of columns
        height: Number of rows
        
    Returns:
        True if dimensions are realistic
    """
    # Check bounds using module-level constants
    if not (MIN_ROWS <= height <= MAX_ROWS):
        return False
    if not (MIN_COLS <= width <= MAX_COLS):
        return False
    
    # Check aspect ratio (shouldn't be too extreme)
    # e.g., 704x2 is unrealistic (352:1 ratio)
    aspect_ratio = max(width, height) / min(width, height)
    if aspect_ratio > 32:  # More than 32:1 is unrealistic
        return False
    
    # Stricter aspect ratio check for real ECU maps
    # Most ECU maps are square-ish (1:1 to 3.0:1)
    if aspect_ratio > 3.0:  # More than 3.0:1 is suspicious
        return False
    
    # Penalize very tall/thin maps (19x40 has ratio 2.1, which passes threshold above)
    # Check if one dimension is > 2x the other
    if height > width * 2 or width > height * 2:
        return False
    
    return True


def has_realistic_values(array_2d: np.ndarray, dtype: str) -> bool:
    """
    Check if map contains realistic numeric values for ECU data.
    
    Real ECU maps typically contain:
    - Temperature: -40°C to 200°C
    - Pressure: 0 to 300 kPa
    - RPM: 0 to 8000
    - Timing: -50° to 50°
    - Small positive/negative values
    
    Unrealistic patterns:
    - Extremely large values (>1e20)
    - Values way outside typical ranges
    - Mostly zeros or constant values
    
    Args:
        array_2d: 2D array of values
        dtype: Data type string
        
    Returns:
        True if values are realistic
    """
    # Flatten to check all values
    values = array_2d.flatten()
    
    # Remove NaN and Inf
    finite_values = values[np.isfinite(values)]
    
    if len(finite_values) < 9:  # Need at least 3x3 map
        return False
    
    # Check for extreme values
    abs_max = np.abs(finite_values).max()
    
    # Typical ECU ranges in base units (before scaling)
    # Floats often store: temperature, pressure, angle, etc.
    if dtype in ['float32', 'float']:
        # Realistic range: allow larger values for unscaled floats
        # But reject obviously garbage like 1e38
        if abs_max > 1e20:  # Reject only extremely large values
            return False
    elif dtype in ['uint16', 'int16']:
        # 16-bit values should fit in reasonable range
        if abs_max > 65535:
            return False
    elif dtype in ['uint8', 'int8']:
        # 8-bit values
        if abs_max > 255:
            return False
    
    # Check if mostly constant (boring data)
    # Only reject if completely flat
    std = np.std(finite_values)
    if std < 1e-10:  # Almost completely constant
        return False
    
    # Check for constant data using Interquartile Range (IQR), which is
    # robust to the outliers that are fooling the std check.
    q75, q25 = np.percentile(finite_values, [75, 25])
    iqr = q75 - q25
    if iqr < 1e-9:  # If 50% of the data is identical, it's constant padding
        return False
    
    # STRENGTHENED: Check for repeated value padding (zeros, constants, etc.)
    # Real maps have diverse values. Junk/padding has one dominant value.
    unique_vals, counts = np.unique(finite_values, return_counts=True)
    max_repeat_ratio = np.max(counts) / len(finite_values)
    
    # Stricter check: If 40% or more of the map is a single value (e.g., 0.0),
    # it is almost certainly padding or "monotonic garbage" (all zeros/constants).
    # Real ECU maps will have much more diverse value distributions.
    if max_repeat_ratio >= 0.4:
        return False
    
    # NEW: Check value distribution (real maps have bell-curve-ish distributions)
    # Garbage has uniform or heavily skewed distributions
    value_range = abs_max - np.abs(finite_values).min()
    if value_range > 0:
        normalized = (finite_values - finite_values.min()) / value_range
        hist, _ = np.histogram(normalized, bins=10)
        # Reject if distribution is too flat (garbage) or too spiky (constant)
        hist_std = np.std(hist)
        if hist_std < 5 or hist_std > len(finite_values) * 0.3:
            return False
    
    return True


def has_map_structure(array_2d: np.ndarray) -> bool:
    """
    Check if array has typical ECU map structure.
    Real ECU maps often have:
    - Edge monotonicity (axes form borders)
    - Magnitude ordering (corner is min/max, center is different)
    - Symmetric structures (fuel map is often mirrored)
    """
    height, width = array_2d.shape
    
    if height < 3 or width < 3:
        return True  # Too small to check structure
    
    # Check for gradient pattern (values increase/decrease from corner)
    corner_val = array_2d[0, 0]
    center_val = array_2d[height//2, width//2]
    opposite_corner = array_2d[-1, -1]
    
    # Real maps often have min/max at corners or different values at corners
    # Reject if corners are too similar (likely flat/random)
    corner_diff = abs(corner_val - opposite_corner)
    corner_val_range = max(abs(corner_val), abs(opposite_corner))
    if corner_val_range > 0:
        if corner_diff / corner_val_range < 0.05:  # Corners too similar
            return False
    
    return True


def has_reasonable_size_bytes(size_bytes: int) -> bool:
    """
    Check if map size in bytes is reasonable.
    
    Real ECU maps are typically:
    - At least 36 bytes (3x3 map of 16-bit values = 18 bytes min)
    - At most 8000 bytes (40x40 map of 16-bit values = 3200 bytes)
    
    Args:
        size_bytes: Size in bytes
        
    Returns:
        True if size is reasonable
    """
    # Typical ECU map sizes (relaxed)
    MIN_BYTES = 16    # 2x2 uint16 map minimum
    MAX_BYTES = 32768  # 32KB maximum to match segmentation config
    
    return MIN_BYTES <= size_bytes <= MAX_BYTES


def filter_candidate(candidate: Dict[str, Any], array_2d: np.ndarray) -> bool:
    """
    Filter a single candidate based on realistic ECU map criteria.
    
    Args:
        candidate: Map candidate dictionary
        array_2d: 2D array representation of the map
        
    Returns:
        True if candidate passes all realistic filters
    """
    # Check dimensions
    if not is_realistic_map_dimensions(candidate['width'], candidate['height']):
        return False
    
    # Check size
    if not has_reasonable_size_bytes(candidate['metrics']['size_bytes']):
        return False
    
    # Check values
    if not has_realistic_values(array_2d, candidate['dtype']):
        return False
    
    # Check map structure
    if not has_map_structure(array_2d):
        return False
    
    return True