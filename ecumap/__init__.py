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
    
    # Convert to numpy array for efficient processing
    data_array = np.frombuffer(data, dtype=np.uint8)
    
    # Track which bytes are in low-entropy regions
    low_entropy_mask = np.zeros(data_length, dtype=bool)
    
    # Slide window across the data
    for start_idx in range(0, data_length - config.window_size + 1, config.step_size):
        end_idx = start_idx + config.window_size
        
        # Extract window data
        window_data = data_array[start_idx:end_idx]
        
        # Calculate entropy for this window
        entropy = shannon_entropy(window_data)
        
        # Check if this window has low entropy (structured data)
        if entropy < config.entropy_threshold:
            low_entropy_mask[start_idx:end_idx] = True
    
    # Merge adjacent low-entropy regions into blocks
    blocks = _merge_adjacent_regions(low_entropy_mask)
    
    # Filter blocks by minimum size
    filtered_blocks = [
        (start, end) for start, end in blocks
        if (end - start) >= config.min_block_size
    ]
    
    return filtered_blocks


def _merge_adjacent_regions(mask: np.ndarray) -> List[Tuple[int, int]]:
    """
    Merge adjacent True regions in a boolean mask into contiguous blocks.
    
    Args:
        mask: Boolean array indicating low-entropy regions
        
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
            blocks.append((start_idx, i))
            in_block = False
    
    # Handle case where block extends to end of data
    if in_block:
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
