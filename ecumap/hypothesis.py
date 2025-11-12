"""
ECU Map Detection - Hypothesis Generation Module

This module implements axis-based hypothesis generation for finding precise map boundaries
within low-entropy regions. It searches for monotonic axes and generates map hypotheses
based on those axes.

Key algorithms:
- Monotonic axis detection
- Map hypothesis generation from axes
- Precise boundary detection
"""

import numpy as np
from typing import List, Tuple, Dict, Any, Generator
from dataclasses import dataclass
from ecumap.interpret import ElementInterpretation, bytes_to_array
from ecumap.filters import MIN_COLS, MAX_COLS, MIN_ROWS, MAX_ROWS


@dataclass
class MapHypothesis:
    """A precise hypothesis for a map's location and dimensions."""
    axis_start_offset: int  # Absolute start offset of the axis
    start_offset: int  # Absolute start offset in the file (of the map data)
    end_offset: int    # Absolute end offset in the file
    width: int
    height: int
    element_type: str
    endianness: str
    element_size: int
    map_data: np.ndarray # The precise 2D map data
    reason: str # e.g., "Found X-Axis", "Found X-Y Axis"


def is_monotonic(array: np.ndarray, min_len: int = 3) -> bool:
    """Checks if a 1D array is strictly monotonic (increasing or decreasing)."""
    if len(array) < min_len:
        return False
    
    # Handle NaN and infinite values
    if not np.all(np.isfinite(array)):
        return False
    
    diff = np.diff(array)
    total_diffs = len(diff)
    if total_diffs == 0:
        return True # A single-element array is monotonic

    # --- NEW FIXED GLITCH LOGIC ---
    # Allow up to 2 fixed glitches, regardless of axis length.
    # This is more robust for longer axes than a percentage.
    max_fixed_glitches = 2

    # Check for mostly increasing (count steps where diff <= 0)
    non_increasing_steps = np.sum(diff <= 0)
    if non_increasing_steps <= max_fixed_glitches:
        return True # Mostly increasing

    # Check for mostly decreasing (count steps where diff >= 0)
    non_decreasing_steps = np.sum(diff >= 0)
    if non_decreasing_steps <= max_fixed_glitches:
        return True # Mostly decreasing
    # --- END NEW LOGIC ---

    return False


def is_pseudo_monotonic(array: np.ndarray, min_len: int = 3) -> bool:
    """
    Detects axes with logarithmic/exponential spacing.
    Real ECU maps often use logarithmic or exponential axes (RPM, load).
    """
    if len(array) < min_len:
        return False
    
    if not np.all(np.isfinite(array)):
        return False
    
    # Check if LOG-spacing is monotonic
    log_array = np.log1p(np.abs(array))  # log1p handles zeros
    if is_monotonic(log_array, min_len):
        return True
    
    # Check if ratios are consistent (geometric progression)
    # Avoid division by zero
    positive_values = array[np.abs(array) > 1e-9]
    if len(positive_values) < min_len:
        return False
    
    ratios = positive_values[1:] / (positive_values[:-1] + 1e-9)
    ratio_std = np.std(ratios)
    ratio_mean = np.mean(ratios)
    
    # Check for consistent spacing (0.8 < ratio < 1.2 and low std)
    if 0.8 < ratio_mean < 1.2 and ratio_std < 0.3:
        return True
    
    return False


def find_monotonic_axes(
    data_slice: bytes,
    interpretation: ElementInterpretation,
    min_len: int = 3,  # Match MIN_ROWS/MIN_COLS to allow smaller maps
    max_len: int = 40  # Increased from 32 to catch 32-wide maps
) -> Generator[Tuple[int, np.ndarray], None, None]:
    """
    Finds all potential monotonic axes within a data slice.
    Yields (start_index_of_axis, axis_data_array)
    """
    element_size = interpretation.element_size
    if not element_size > 0:
        return

    max_axes_per_block = 500  # Increased to search thoroughly
    axes_found = 0
    
    # FIXED: step_size must equal element_size to find all maps
    # The previous max(element_size, 4) was skipping 50-75% of uint8/uint16 maps
    step_size = element_size
    
    for i in range(0, len(data_slice) - (min_len * element_size), step_size):
        if axes_found >= max_axes_per_block:
            break
            
        # Track if we found an axis at this position
        found_axis = False
        
        # Test for axes of different lengths
        # REVERSED: Check from max_len *down to* min_len
        for length in range(max_len, min_len - 1, -1):
            start_idx = i
            end_idx = i + (length * element_size)
            
            if end_idx > len(data_slice):
                continue 

            axis_bytes = data_slice[start_idx:end_idx]
            axis_array = bytes_to_array(axis_bytes, interpretation)
            
            # Check for regular monotonicity OR pseudo-monotonicity
            if axis_array.size == length and (is_monotonic(axis_array, min_len) or is_pseudo_monotonic(axis_array, min_len)):
                # Found a potential axis!
                yield (i, axis_array)
                axes_found += 1
                found_axis = True
                break # Found the longest axis at this spot, break inner loop


def generate_hypotheses(
    block_data: bytes,
    block_start_offset: int,
    interpretation: ElementInterpretation
) -> List[MapHypothesis]:
    """
    Generates all map hypotheses for a given block and data interpretation.
    Uses 2-Axis search to find BOTH Y-axis and X-axis, dramatically reducing
    the number of hypotheses generated compared to the "shotgun" approach.
    """
    hypotheses = []
    element_size = interpretation.element_size
    if not element_size > 0:
        return []

    max_hypotheses_per_block = 500
    hypotheses_generated = 0

    # 2-AXIS SEARCH: Find Y-axis candidates and immediately look for X-axis after
    for y_axis_start_in_block, y_axis_array in find_monotonic_axes(block_data, interpretation):
        if hypotheses_generated >= max_hypotheses_per_block:
            break
            
        y_axis_len = len(y_axis_array)
        y_axis_bytes = y_axis_len * element_size
        
        # After Y-axis, look for X-axis
        x_axis_start_in_block = y_axis_start_in_block + y_axis_bytes
        
        # Try to find an X-axis immediately after this Y-axis
        if x_axis_start_in_block + (MIN_COLS * element_size) <= len(block_data):
            # Extract a slice that could contain an X-axis
            potential_x_axis_slice = block_data[x_axis_start_in_block:]
            
            # Look for an X-axis in this slice
            x_axis_found = False
            for x_axis_rel_start, x_axis_array in find_monotonic_axes(potential_x_axis_slice, interpretation):
                # We only want the X-axis that starts at position 0 (immediately after Y-axis)
                if x_axis_rel_start == 0:
                    x_axis_len = len(x_axis_array)
                    x_axis_bytes = x_axis_len * element_size
                    
                    # Map data starts after BOTH axes
                    map_data_start_in_block = x_axis_start_in_block + x_axis_bytes
                    map_bytes = y_axis_len * x_axis_len * element_size
                    map_data_end_in_block = map_data_start_in_block + map_bytes
                    
                    if map_data_end_in_block <= len(block_data):
                        # Found a 2-axis map! Generate ONE precise hypothesis
                        map_data_bytes = block_data[map_data_start_in_block:map_data_end_in_block]
                        map_array = bytes_to_array(map_data_bytes, interpretation)
                        
                        if map_array.size == y_axis_len * x_axis_len:
                            map_2d = map_array.reshape(y_axis_len, x_axis_len)
                            hypotheses.append(MapHypothesis(
                                axis_start_offset=block_start_offset + y_axis_start_in_block,
                                start_offset=block_start_offset + map_data_start_in_block,
                                end_offset=block_start_offset + map_data_end_in_block,
                                width=x_axis_len,
                                height=y_axis_len,
                                element_type=interpretation.element_type.value,
                                endianness=interpretation.endianness.value,
                                element_size=element_size,
                                map_data=map_2d,
                                reason=f"Found 2-Axis Map: Y={y_axis_len}, X={x_axis_len}"
                            ))
                            hypotheses_generated += 1
                            x_axis_found = True
                    break  # Only check the first potential X-axis at position 0
        
        # FALLBACK: If no X-axis found, generate 1-axis hypotheses (for backwards compatibility)
        # This handles edge cases where maps only have one axis stored
        if not x_axis_found:
            map_data_start_in_block = y_axis_start_in_block + y_axis_bytes
            axis_start_abs = block_start_offset + y_axis_start_in_block
            
            # Try this as an X-Axis (Width = y_axis_len)
            for height in range(MIN_ROWS, MAX_ROWS + 1):
                if hypotheses_generated >= max_hypotheses_per_block:
                    break
                    
                map_bytes = y_axis_len * height * element_size
                map_data_end_in_block = map_data_start_in_block + map_bytes
                
                if map_data_end_in_block > len(block_data):
                    break

                map_data_bytes = block_data[map_data_start_in_block:map_data_end_in_block]
                map_array = bytes_to_array(map_data_bytes, interpretation)

                if map_array.size == y_axis_len * height:
                    map_2d = map_array.reshape(height, y_axis_len)
                    hypotheses.append(MapHypothesis(
                        axis_start_offset=axis_start_abs,
                        start_offset=block_start_offset + map_data_start_in_block,
                        end_offset=block_start_offset + map_data_end_in_block,
                        width=y_axis_len,
                        height=height,
                        element_type=interpretation.element_type.value,
                        endianness=interpretation.endianness.value,
                        element_size=element_size,
                        map_data=map_2d,
                        reason=f"Found {y_axis_len}-element X-Axis (1-axis fallback)"
                    ))
                    hypotheses_generated += 1

            # Try this as a Y-Axis (Height = y_axis_len)
            for width in range(MIN_COLS, MAX_COLS + 1):
                if hypotheses_generated >= max_hypotheses_per_block:
                    break
                    
                map_bytes = width * y_axis_len * element_size
                map_data_end_in_block = map_data_start_in_block + map_bytes

                if map_data_end_in_block > len(block_data):
                    break

                map_data_bytes = block_data[map_data_start_in_block:map_data_end_in_block]
                map_array = bytes_to_array(map_data_bytes, interpretation)

                if map_array.size == width * y_axis_len:
                    map_2d = map_array.reshape(y_axis_len, width)
                    hypotheses.append(MapHypothesis(
                        axis_start_offset=axis_start_abs,
                        start_offset=block_start_offset + map_data_start_in_block,
                        end_offset=block_start_offset + map_data_end_in_block,
                        width=width,
                        height=y_axis_len,
                        element_type=interpretation.element_type.value,
                        endianness=interpretation.endianness.value,
                        element_size=element_size,
                        map_data=map_2d,
                        reason=f"Found {y_axis_len}-element Y-Axis (1-axis fallback)"
                    ))
                    hypotheses_generated += 1

    return hypotheses