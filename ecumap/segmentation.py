"""
ECU Map Detection - Segmentation Module

This module implements algorithms to identify candidate contiguous regions
in ECU binaries that likely contain structured map data.

Key algorithms:
- Shannon entropy calculation
- Sliding window entropy analysis
- ASCII content filtering
- Block merging and filtering
"""

import numpy as np
from typing import List, Tuple, Optional
from dataclasses import dataclass


@dataclass
class SegmentationConfig:
    """Configuration parameters for binary segmentation."""
    window_size: int = 1024
    step_size: int = 256
    entropy_threshold: float = 7.2
    min_block_size: int = 256
    max_block_size: int = 32 * 1024  # Max 32KB blocks to avoid overly large regions
    ascii_threshold: float = 0.3  # Exclude regions with >30% printable ASCII


def shannon_entropy(data: np.ndarray) -> float:
    """
    Calculate Shannon entropy of a data array.
    
    Args:
        data: Input data array (bytes or integers)
        
    Returns:
        Shannon entropy in bits
    """
    if len(data) == 0:
        return 0.0
    
    # Get unique values and their counts
    unique_values, counts = np.unique(data, return_counts=True)
    
    # Calculate probabilities
    probabilities = counts / len(data)
    
    # Calculate Shannon entropy: H = -sum(p * log2(p))
    # Add small epsilon to avoid log(0)
    entropy = -np.sum(probabilities * np.log2(probabilities + 1e-12))
    
    return float(entropy)


def calculate_ascii_ratio(data: bytes) -> float:
    """
    Calculate the ratio of printable ASCII characters in the data.
    
    Args:
        data: Input byte data
        
    Returns:
        Ratio of printable ASCII characters (0.0 to 1.0)
    """
    if len(data) == 0:
        return 0.0
    
    # Count printable ASCII characters (32-126)
    printable_count = sum(1 for byte in data if 32 <= byte <= 126)
    
    return printable_count / len(data)


def detect_padding(data: bytes) -> int:
    """
    Detect and skip padding at the start of the file.
    Padding is typically a repeated byte value (often 0x00, 0xFF, or 0xC3).
    
    Args:
        data: Binary data to analyze
        
    Returns:
        Number of bytes to skip (end of padding)
    """
    if len(data) < 4:
        return 0
    
    # Find the first byte value
    first_byte = data[0]
    
    # Count consecutive identical bytes
    padding_end = 0
    while padding_end < len(data) and data[padding_end] == first_byte:
        padding_end += 1
    
    # Only consider it padding if it's at least 1KB of the same byte
    if padding_end >= 1024:
        return padding_end
    
    return 0


def sliding_window_entropy_analysis(
    data: bytes,
    config: SegmentationConfig
) -> List[Tuple[int, int]]:
    """
    Perform sliding window entropy analysis to identify low-entropy regions.
    
    Args:
        data: Binary data to analyze
        config: Segmentation configuration parameters
        
    Returns:
        List of (start_offset, end_offset) tuples for candidate blocks
    """
    data_length = len(data)
    if data_length < config.window_size:
        return []
    
    # Detect and skip padding at the start
    padding_size = detect_padding(data)
    analysis_start = max(padding_size, config.window_size)
    
    if analysis_start >= data_length:
        return []
    
    # Convert to numpy array for efficient processing
    data_array = np.frombuffer(data, dtype=np.uint8)
    
    # Track which bytes are in low-entropy regions
    low_entropy_mask = np.zeros(data_length, dtype=bool)
    
    # Slide window across the data (skip padding region)
    for start_idx in range(analysis_start, data_length - config.window_size + 1, config.step_size):
        end_idx = start_idx + config.window_size
        
        # Extract window data
        window_data = data_array[start_idx:end_idx]
        
        # Calculate entropy for this window
        entropy = shannon_entropy(window_data)
        
        # Check if this window has low entropy (structured data)
        if entropy < config.entropy_threshold:
            low_entropy_mask[start_idx:end_idx] = True
    
    # Merge adjacent low-entropy regions into blocks
    blocks = _merge_adjacent_regions(low_entropy_mask, config.max_block_size)
    
    # Filter blocks by minimum size
    filtered_blocks = [
        (start, end) for start, end in blocks
        if (end - start) >= config.min_block_size
    ]
    
    return filtered_blocks


def _merge_adjacent_regions(mask: np.ndarray, max_block_size: int = 32 * 1024) -> List[Tuple[int, int]]:
    """
    Merge adjacent True regions in a boolean mask into contiguous blocks.
    Large blocks are split into smaller chunks.
    
    Args:
        mask: Boolean array indicating low-entropy regions
        max_block_size: Maximum allowed block size before splitting
        
    Returns:
        List of (start, end) tuples for contiguous blocks
    """
    blocks = []
    in_block = False
    start_idx = 0
    
    for i, is_low_entropy in enumerate(mask):
        if is_low_entropy and not in_block:
            # Start of a new block
            start_idx = i
            in_block = True
        elif not is_low_entropy and in_block:
            # End of current block
            # Split large blocks into smaller chunks
            block_size = i - start_idx
            if block_size > max_block_size:
                # Split into max_block_size chunks with 50% overlap
                chunk_size = max_block_size
                overlap = chunk_size // 2
                current_start = start_idx
                while current_start < i:
                    chunk_end = min(current_start + chunk_size, i)
                    blocks.append((current_start, chunk_end))
                    current_start += overlap
            else:
                blocks.append((start_idx, i))
            in_block = False
    
    # Handle case where block extends to end of data
    if in_block:
        block_size = len(mask) - start_idx
        if block_size > max_block_size:
            # Split large blocks
            chunk_size = max_block_size
            overlap = chunk_size // 2
            current_start = start_idx
            while current_start < len(mask):
                chunk_end = min(current_start + chunk_size, len(mask))
                blocks.append((current_start, chunk_end))
                current_start += overlap
        else:
            blocks.append((start_idx, len(mask)))
    
    return blocks


def filter_ascii_regions(
    data: bytes,
    blocks: List[Tuple[int, int]],
    config: SegmentationConfig
) -> List[Tuple[int, int]]:
    """
    Filter out blocks that contain too much ASCII text content.
    
    Args:
        data: Original binary data
        blocks: List of candidate blocks
        config: Segmentation configuration
        
    Returns:
        Filtered list of blocks with ASCII content removed
    """
    filtered_blocks = []
    
    for start, end in blocks:
        block_data = data[start:end]
        ascii_ratio = calculate_ascii_ratio(block_data)
        
        # Keep block if ASCII ratio is below threshold
        if ascii_ratio < config.ascii_threshold:
            filtered_blocks.append((start, end))
    
    return filtered_blocks


def find_candidate_blocks(
    data: bytes,
    config: Optional[SegmentationConfig] = None
) -> List[Tuple[int, int]]:
    """
    Main function to find candidate blocks in binary data.
    
    This function combines entropy analysis and ASCII filtering to identify
    regions that likely contain structured map data.
    
    Args:
        data: Binary data to analyze
        config: Optional configuration parameters
        
    Returns:
        List of (start_offset, end_offset) tuples for candidate blocks
    """
    if config is None:
        config = SegmentationConfig()
    
    # Step 1: Sliding window entropy analysis
    entropy_blocks = sliding_window_entropy_analysis(data, config)
    
    # Step 2: Filter out ASCII text regions
    filtered_blocks = filter_ascii_regions(data, entropy_blocks, config)
    
    return filtered_blocks


def analyze_block_statistics(
    data: bytes,
    blocks: List[Tuple[int, int]]
) -> List[dict]:
    """
    Analyze statistics for each candidate block.
    
    Args:
        data: Original binary data
        blocks: List of candidate blocks
        
    Returns:
        List of dictionaries containing block statistics
    """
    statistics = []
    
    for i, (start, end) in enumerate(blocks):
        block_data = data[start:end]
        
        # Calculate various statistics
        entropy = shannon_entropy(np.frombuffer(block_data, dtype=np.uint8))
        ascii_ratio = calculate_ascii_ratio(block_data)
        
        # Calculate byte value distribution
        byte_counts = np.bincount(np.frombuffer(block_data, dtype=np.uint8), minlength=256)
        unique_bytes = np.count_nonzero(byte_counts)
        
        # Calculate top byte values
        top_bytes = np.argsort(byte_counts)[-3:][::-1]
        top_byte_percentages = [(byte_counts[b] / len(block_data)) * 100 for b in top_bytes]
        
        stats = {
            'block_id': i + 1,
            'start_offset': start,
            'end_offset': end,
            'size_bytes': end - start,
            'entropy': entropy,
            'ascii_ratio': ascii_ratio,
            'unique_bytes': unique_bytes,
            'top_bytes': top_bytes.tolist(),
            'top_byte_percentages': top_byte_percentages
        }
        
        statistics.append(stats)
    
    return statistics


def grid_based_search(
    data: bytes,
    config: SegmentationConfig,
    grid_step: int = 2048  # Step between grid points
) -> List[Tuple[int, int]]:
    """
    Perform a grid-based exhaustive search across the file.
    This scans with overlapping windows to find map candidates at any location.
    
    Args:
        data: Binary data to analyze
        config: Segmentation configuration
        grid_step: Step size between grid search points
        
    Returns:
        List of (start_offset, end_offset) tuples for candidate blocks
    """
    data_length = len(data)
    if data_length < config.window_size:
        return []
    
    # Detect and skip padding
    padding_size = detect_padding(data)
    search_start = max(padding_size, config.window_size)
    
    if search_start >= data_length:
        return []
    
    blocks = []
    analysis_window = min(2 * 1024, data_length - search_start)  # 2KB analysis window for tighter detection
    
    # Slide across the file with overlapping windows
    for start_idx in range(search_start, data_length - config.window_size, grid_step):
        end_idx = min(start_idx + analysis_window, data_length)
        
        # Sample entropy at this location
        sample_data = data[start_idx:end_idx]
        if len(sample_data) < config.window_size:
            continue
            
        data_array = np.frombuffer(sample_data, dtype=np.uint8)
        entropy = shannon_entropy(data_array)
        
        # Accept if entropy is in reasonable range for maps (4-7)
        # This is less restrictive than entropy_threshold which filters for low-entropy
        if 4.0 <= entropy <= 7.5:
            blocks.append((start_idx, end_idx))
    
    # Remove duplicates and merge overlapping blocks
    if not blocks:
        return []
    
    # Sort by start position
    blocks.sort()
    
    # Merge overlapping blocks
    merged = []
    current_start, current_end = blocks[0]
    
    for start, end in blocks[1:]:
        if start <= current_end:  # Overlapping
            current_end = max(current_end, end)
        else:
            merged.append((current_start, current_end))
            current_start, current_end = start, end
    
    merged.append((current_start, current_end))
    
    # Split large blocks
    final_blocks = []
    for start, end in merged:
        size = end - start
        if size > config.max_block_size:
            # Split into chunks
            chunk_size = config.max_block_size
            overlap = chunk_size // 2
            current_start = start
            while current_start < end:
                chunk_end = min(current_start + chunk_size, end)
                final_blocks.append((current_start, chunk_end))
                current_start += overlap
        else:
            final_blocks.append((start, end))
    
    return final_blocks


def find_aligned_boundaries(
    candidates: List[Tuple[int, int]],
    alignment: int = 2  # Typically 2, 4, 8, 16 for 16-bit, 32-bit, 64-bit, etc.
) -> List[Tuple[int, int]]:
    """
    Adjust block boundaries to be properly aligned.
    
    Real maps are usually aligned to 2, 4, 8, or 16-byte boundaries
    since they store multi-byte values.
    
    Args:
        candidates: List of (start, end) block tuples
        alignment: Alignment boundary (2, 4, 8, or 16)
        
    Returns:
        List of adjusted (start, end) tuples with aligned boundaries
    """
    aligned_blocks = []
    
    for start, end in candidates:
        # Align start downward to nearest boundary
        aligned_start = (start // alignment) * alignment
        
        # Align end upward to nearest boundary
        aligned_end = ((end + alignment - 1) // alignment) * alignment
        
        # Keep original if alignment doesn't change much
        if abs(aligned_start - start) <= 16 and abs(aligned_end - end) <= 16:
            aligned_blocks.append((aligned_start, aligned_end))
        else:
            # Use original if alignment would change too much
            aligned_blocks.append((start, end))
    
    return aligned_blocks


def detect_entropy_transitions(
    data: bytes,
    config: SegmentationConfig,
    transition_threshold: float = 0.3
) -> List[int]:
    """
    Detect entropy transitions that indicate map boundaries.
    
    Maps typically have edges where entropy changes significantly.
    These transitions help identify exact map start/end boundaries.
    
    Args:
        data: Binary data to analyze
        config: Segmentation configuration
        transition_threshold: Minimum entropy change to detect a transition
        
    Returns:
        List of byte offsets where significant entropy changes occur
    """
    data_length = len(data)
    if data_length < config.window_size * 2:
        return []
    
    transitions = []
    window_radius = config.window_size // 2
    
    # Calculate entropy in a sliding window to detect transitions
    prev_entropy = None
    for i in range(window_radius, data_length - window_radius, 256):
        window_start = max(0, i - window_radius)
        window_end = min(data_length, i + window_radius)
        window_data = data[window_start:window_end]
        
        if len(window_data) < 128:
            continue
            
        entropy = shannon_entropy(np.frombuffer(window_data, dtype=np.uint8))
        
        if prev_entropy is not None:
            entropy_change = abs(entropy - prev_entropy)
            if entropy_change > transition_threshold:
                transitions.append(i)
        
        prev_entropy = entropy
    
    return transitions
