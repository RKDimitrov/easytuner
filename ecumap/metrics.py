"""
ECU Map Detection - Metrics Module

This module implements deterministic algorithms to compute metrics that indicate
whether a reshaped array represents a meaningful map structure.

Key algorithms:
- Core map metrics (entropy, spatial gradients, variance profiles)
- Advanced pattern detection (row similarity, monotonicity)
- Value range validation and data quality checks
"""

import numpy as np
from typing import Dict, Any, Tuple, Optional
from dataclasses import dataclass


@dataclass
class MapMetrics:
    """Container for map detection metrics."""
    entropy: float
    mean_abs_dx_norm: float
    mean_abs_dy_norm: float
    row_diff_mean: float
    col_var_mean: float
    row_var_mean: float
    monotonic_rows: float
    monotonic_cols: float
    value_range_score: float
    nan_frequency: float
    inf_frequency: float
    edge_consistency: float
    value_coherence: float
    jump_anomaly: float
    local_coherence: float
    gradient_distribution_quality: float


def compute_normalized_entropy(array: np.ndarray, bins: int = 256) -> float:
    """
    Compute normalized Shannon entropy using histogram binning.
    
    Args:
        array: Input 2D array
        bins: Number of histogram bins
        
    Returns:
        Normalized entropy (0-1 scale)
    """
    if array.size == 0:
        return 0.0
    
    # Flatten array and compute histogram
    flat_array = array.flatten()
    
    # Handle NaN and inf values
    valid_mask = np.isfinite(flat_array)
    if not np.any(valid_mask):
        return 0.0
    
    valid_data = flat_array[valid_mask]
    
    # Compute histogram
    hist, _ = np.histogram(valid_data, bins=bins)
    
    # Calculate probabilities
    probabilities = hist / np.sum(hist)
    
    # Calculate Shannon entropy
    entropy = -np.sum(probabilities * np.log2(probabilities + 1e-12))
    
    # Normalize by maximum possible entropy (log2(bins))
    max_entropy = np.log2(bins)
    normalized_entropy = entropy / max_entropy
    
    return float(normalized_entropy)


def compute_spatial_gradients(array: np.ndarray) -> Tuple[float, float]:
    """
    Compute normalized spatial gradients (horizontal and vertical smoothness).
    
    Args:
        array: Input 2D array
        
    Returns:
        Tuple of (normalized_horizontal_gradient, normalized_vertical_gradient)
    """
    if array.size == 0 or array.shape[0] < 2 or array.shape[1] < 2:
        return 0.0, 0.0
    
    # Compute dynamic range for normalization
    dynamic_range = np.max(array) - np.min(array)
    if dynamic_range == 0:
        return 0.0, 0.0
    
    # Horizontal gradient (differences along columns)
    if array.shape[1] > 1:
        dx = np.diff(array, axis=1)
        mean_abs_dx = np.mean(np.abs(dx))
        normalized_dx = mean_abs_dx / dynamic_range
    else:
        normalized_dx = 0.0
    
    # Vertical gradient (differences along rows)
    if array.shape[0] > 1:
        dy = np.diff(array, axis=0)
        mean_abs_dy = np.mean(np.abs(dy))
        normalized_dy = mean_abs_dy / dynamic_range
    else:
        normalized_dy = 0.0
    
    return float(normalized_dx), float(normalized_dy)


def compute_variance_profiles(array: np.ndarray) -> Tuple[float, float]:
    """
    Compute row and column variance profiles.
    
    Args:
        array: Input 2D array
        
    Returns:
        Tuple of (mean_column_variance, mean_row_variance)
    """
    if array.size == 0:
        return 0.0, 0.0
    
    # Column variance (variance along rows)
    col_var = np.var(array, axis=0)
    mean_col_var = np.mean(col_var)
    
    # Row variance (variance along columns)
    row_var = np.var(array, axis=1)
    mean_row_var = np.mean(row_var)
    
    return float(mean_col_var), float(mean_row_var)


def compute_row_similarity(array: np.ndarray) -> float:
    """
    Compute normalized row-to-row similarity metric.
    
    Args:
        array: Input 2D array
        
    Returns:
        Mean absolute difference between adjacent rows, normalized by dynamic range
    """
    if array.shape[0] < 2:
        return 0.0
    
    # Compute differences between adjacent rows
    row_diffs = np.abs(array[1:] - array[:-1])
    mean_row_diff = np.mean(row_diffs)
    
    # FIX: NORMALIZE THE METRIC by dynamic range
    dynamic_range = np.max(array) - np.min(array)
    if dynamic_range == 0:
        return 0.0  # Flat data
        
    normalized_row_diff = mean_row_diff / dynamic_range
    
    return float(normalized_row_diff)  # Return the normalized value


def compute_monotonicity(array: np.ndarray) -> Tuple[float, float]:
    """
    Compute monotonicity scores for rows and columns.
    
    Args:
        array: Input 2D array
        
    Returns:
        Tuple of (row_monotonicity, column_monotonicity)
    """
    if array.size == 0:
        return 0.0, 0.0
    
    row_monotonic = 0.0
    col_monotonic = 0.0
    
    # Row monotonicity
    if array.shape[0] > 0 and array.shape[1] > 1:
        monotonic_rows = 0
        for i in range(array.shape[0]):
            row = array[i, :]
            # Check if row is non-decreasing or non-increasing
            if np.all(row[1:] >= row[:-1]) or np.all(row[1:] <= row[:-1]):
                monotonic_rows += 1
        row_monotonic = monotonic_rows / array.shape[0]
    
    # Column monotonicity
    if array.shape[1] > 0 and array.shape[0] > 1:
        monotonic_cols = 0
        for j in range(array.shape[1]):
            col = array[:, j]
            # Check if column is non-decreasing or non-increasing
            if np.all(col[1:] >= col[:-1]) or np.all(col[1:] <= col[:-1]):
                monotonic_cols += 1
        col_monotonic = monotonic_cols / array.shape[1]
    
    return float(row_monotonic), float(col_monotonic)


def compute_value_range_score(array: np.ndarray, dtype: str) -> float:
    """
    Compute value range consistency score based on data type.
    
    Args:
        array: Input 2D array
        dtype: Data type string (e.g., 'uint8', 'int16', 'float32')
        
    Returns:
        Value range consistency score (0-1)
    """
    if array.size == 0:
        return 0.0
    
    # Define expected ranges for different data types
    type_ranges = {
        'uint8': (0, 255),
        'int8': (-128, 127),
        'uint16': (0, 65535),
        'int16': (-32768, 32767),
        'uint32': (0, 4294967295),
        'int32': (-2147483648, 2147483647),
        'float32': (-3.4e38, 3.4e38)
    }
    
    if dtype not in type_ranges:
        return 1.0  # Unknown type, assume valid
    
    min_expected, max_expected = type_ranges[dtype]
    
    # Check if values are within expected range
    valid_mask = (array >= min_expected) & (array <= max_expected)
    valid_ratio = np.sum(valid_mask) / array.size
    
    return float(valid_ratio)


def compute_data_quality_metrics(array: np.ndarray) -> Tuple[float, float]:
    """
    Compute data quality metrics (NaN and inf frequencies).
    
    Args:
        array: Input 2D array
        
    Returns:
        Tuple of (nan_frequency, inf_frequency)
    """
    if array.size == 0:
        return 0.0, 0.0
    
    nan_count = np.sum(np.isnan(array))
    inf_count = np.sum(np.isinf(array))
    
    nan_frequency = nan_count / array.size
    inf_frequency = inf_count / array.size
    
    return float(nan_frequency), float(inf_frequency)


def compute_edge_consistency(array: np.ndarray) -> float:
    """
    Compute edge consistency metric (how similar are edge values).
    
    Args:
        array: Input 2D array
        
    Returns:
        Edge consistency score (0-1)
    """
    if array.shape[0] < 2 or array.shape[1] < 2:
        return 1.0
    
    # Get edge values
    top_edge = array[0, :]
    bottom_edge = array[-1, :]
    left_edge = array[:, 0]
    right_edge = array[:, -1]
    
    # Compute edge similarities
    top_bottom_sim = 1.0 - np.mean(np.abs(top_edge - bottom_edge)) / (np.max(array) - np.min(array) + 1e-9)
    left_right_sim = 1.0 - np.mean(np.abs(left_edge - right_edge)) / (np.max(array) - np.min(array) + 1e-9)
    
    # Average edge consistency
    edge_consistency = (top_bottom_sim + left_right_sim) / 2.0
    
    return float(np.clip(edge_consistency, 0.0, 1.0))


def compute_value_coherence(array: np.ndarray) -> float:
    """
    Measures if values form logical patterns.
    Real maps have gradual transitions, not random jumps.
    
    Args:
        array: Input 2D array
        
    Returns:
        Value coherence score (0-1, higher is better)
    """
    if array.shape[0] < 2 or array.shape[1] < 2:
        return 0.0
    
    # Check row-wise gradients
    row_gradients = np.abs(np.diff(array, axis=1))
    row_gradient_std = np.std(row_gradients)
    
    # Check column-wise gradients
    col_gradients = np.abs(np.diff(array, axis=0))
    col_gradient_std = np.std(col_gradients)
    
    # Low gradient std = smooth transitions = real map
    # Normalize by value range
    value_range = np.ptp(array)
    if value_range == 0:
        return 0.0
    
    coherence = 1.0 - min(1.0, (row_gradient_std + col_gradient_std) / (2 * value_range))
    return float(coherence)


def compute_jump_anomaly_score(array: np.ndarray) -> float:
    """
    Detects sudden value jumps that indicate corrupted or misaligned data.
    Real maps have smooth transitions; garbage has wild jumps.
    
    Returns:
        Anomaly score (0-1, lower is better for real maps)
    """
    if array.shape[0] < 2 or array.shape[1] < 2:
        return 0.0
    
    # Get all cell-to-cell differences (4-neighbor connectivity)
    # Horizontal differences
    h_diffs = np.abs(np.diff(array, axis=1))
    # Vertical differences
    v_diffs = np.abs(np.diff(array, axis=0))
    
    all_diffs = np.concatenate([h_diffs.flatten(), v_diffs.flatten()])
    
    if len(all_diffs) == 0:
        return 0.0
    
    # Calculate statistics of gradients
    mean_diff = np.mean(all_diffs)
    std_diff = np.std(all_diffs)
    max_diff = np.max(all_diffs)
    
    # Real maps: std should be much smaller than max
    # Garbage: std is close to max (wild jumps everywhere)
    value_range = np.ptp(array)
    if value_range == 0:
        return 1.0  # Flat data
    
    # Normalize by value range
    normalized_max_diff = max_diff / value_range
    normalized_std_diff = std_diff / value_range
    
    # If max jump is > 50% of total range, it's suspicious
    if normalized_max_diff > 0.5:
        jump_penalty = normalized_max_diff
    else:
        jump_penalty = 0.0
    
    # If std is > 20% of range, transitions are chaotic
    if normalized_std_diff > 0.2:
        chaos_penalty = normalized_std_diff
    else:
        chaos_penalty = 0.0
    
    # Count outlier jumps (> 3 standard deviations)
    outlier_threshold = mean_diff + 3 * std_diff
    outlier_ratio = np.sum(all_diffs > outlier_threshold) / len(all_diffs)
    
    # Combine penalties
    anomaly_score = (jump_penalty * 0.4 + chaos_penalty * 0.4 + outlier_ratio * 0.2)
    
    return float(np.clip(anomaly_score, 0.0, 1.0))


def compute_local_coherence(array: np.ndarray) -> float:
    """
    Measures if each cell is similar to its neighbors.
    Real maps have smooth neighborhoods; garbage has random neighborhoods.
    
    Returns:
        Local coherence score (0-1, higher is better)
    """
    if array.shape[0] < 3 or array.shape[1] < 3:
        return 0.0
    
    height, width = array.shape
    coherence_scores = []
    
    # Check each cell's similarity to its 4-neighborhood
    for i in range(1, height - 1):
        for j in range(1, width - 1):
            center = array[i, j]
            
            # Get 4 neighbors (up, down, left, right)
            neighbors = [
                array[i-1, j],  # up
                array[i+1, j],  # down
                array[i, j-1],  # left
                array[i, j+1]   # right
            ]
            
            # Calculate how similar center is to neighbors
            diffs = [abs(center - n) for n in neighbors]
            avg_diff = np.mean(diffs)
            
            coherence_scores.append(avg_diff)
    
    if len(coherence_scores) == 0:
        return 0.0
    
    # Normalize by value range
    value_range = np.ptp(array)
    if value_range == 0:
        return 1.0  # Completely flat = coherent but boring
    
    mean_local_diff = np.mean(coherence_scores)
    normalized_local_diff = mean_local_diff / value_range
    
    # Lower local differences = higher coherence
    coherence = 1.0 - min(1.0, normalized_local_diff * 2.0)
    
    return float(coherence)


def compute_gradient_distribution_score(array: np.ndarray) -> float:
    """
    Analyzes the distribution of gradients.
    Real maps: Most gradients are small (Gaussian distribution)
    Garbage: Gradients are uniformly distributed (chaos)
    
    Returns:
        Distribution quality score (0-1, higher is better)
    """
    if array.shape[0] < 2 or array.shape[1] < 2:
        return 0.0
    
    # Get all gradients
    h_diffs = np.abs(np.diff(array, axis=1)).flatten()
    v_diffs = np.abs(np.diff(array, axis=0)).flatten()
    all_diffs = np.concatenate([h_diffs, v_diffs])
    
    if len(all_diffs) < 10:
        return 0.0
    
    # Normalize gradients to [0, 1]
    max_diff = np.max(all_diffs)
    if max_diff == 0:
        return 1.0  # Flat = perfect smoothness
    
    normalized_diffs = all_diffs / max_diff
    
    # Create histogram
    hist, bin_edges = np.histogram(normalized_diffs, bins=20, range=(0, 1))
    
    # Real maps should have most values in the first few bins (small gradients)
    # Calculate what percentage of gradients are < 0.2 (normalized)
    small_gradient_ratio = np.sum(normalized_diffs < 0.2) / len(normalized_diffs)
    
    # Real maps should also have exponential decay (not uniform)
    # Check if histogram decreases monotonically
    is_decreasing = np.all(hist[:-1] >= hist[1:])
    decreasing_bonus = 0.3 if is_decreasing else 0.0
    
    # Combine: reward small gradients + monotonic decrease
    score = (small_gradient_ratio * 0.7) + decreasing_bonus
    
    return float(np.clip(score, 0.0, 1.0))


def compute_map_metrics(array: np.ndarray, dtype: str = "uint8") -> MapMetrics:
    """
    Compute comprehensive map detection metrics for a 2D array.
    
    Args:
        array: Input 2D array
        dtype: Data type string for value range validation
        
    Returns:
        MapMetrics object with all computed metrics
    """
    # Core metrics
    entropy = compute_normalized_entropy(array)
    mean_abs_dx_norm, mean_abs_dy_norm = compute_spatial_gradients(array)
    col_var_mean, row_var_mean = compute_variance_profiles(array)
    row_diff_mean = compute_row_similarity(array)
    
    # Advanced pattern detection
    monotonic_rows, monotonic_cols = compute_monotonicity(array)
    
    # Value validation
    value_range_score = compute_value_range_score(array, dtype)
    nan_frequency, inf_frequency = compute_data_quality_metrics(array)
    
    # Edge consistency
    edge_consistency = compute_edge_consistency(array)
    
    # Value coherence
    value_coherence = compute_value_coherence(array)
    
    # New sophisticated metrics
    jump_anomaly = compute_jump_anomaly_score(array)
    local_coherence = compute_local_coherence(array)
    gradient_distribution_quality = compute_gradient_distribution_score(array)
    
    return MapMetrics(
        entropy=entropy,
        mean_abs_dx_norm=mean_abs_dx_norm,
        mean_abs_dy_norm=mean_abs_dy_norm,
        row_diff_mean=row_diff_mean,
        col_var_mean=col_var_mean,
        row_var_mean=row_var_mean,
        monotonic_rows=monotonic_rows,
        monotonic_cols=monotonic_cols,
        value_range_score=value_range_score,
        nan_frequency=nan_frequency,
        inf_frequency=inf_frequency,
        edge_consistency=edge_consistency,
        value_coherence=value_coherence,
        jump_anomaly=jump_anomaly,
        local_coherence=local_coherence,
        gradient_distribution_quality=gradient_distribution_quality
    )


def metrics_to_dict(metrics: MapMetrics) -> Dict[str, Any]:
    """
    Convert MapMetrics object to dictionary for JSON serialization.
    
    Args:
        metrics: MapMetrics object
        
    Returns:
        Dictionary with all metrics
    """
    return {
        "entropy": metrics.entropy,
        "mean_abs_dx_norm": metrics.mean_abs_dx_norm,
        "mean_abs_dy_norm": metrics.mean_abs_dy_norm,
        "row_diff_mean": metrics.row_diff_mean,
        "col_var_mean": metrics.col_var_mean,
        "row_var_mean": metrics.row_var_mean,
        "monotonic_rows": metrics.monotonic_rows,
        "monotonic_cols": metrics.monotonic_cols,
        "value_range_score": metrics.value_range_score,
        "nan_frequency": metrics.nan_frequency,
        "inf_frequency": metrics.inf_frequency,
        "edge_consistency": metrics.edge_consistency,
        "value_coherence": metrics.value_coherence,
        "jump_anomaly": metrics.jump_anomaly,
        "local_coherence": metrics.local_coherence,
        "gradient_distribution_quality": metrics.gradient_distribution_quality
    }


def analyze_map_quality(metrics: MapMetrics) -> Dict[str, Any]:
    """
    Analyze map quality based on computed metrics.
    
    Args:
        metrics: MapMetrics object
        
    Returns:
        Dictionary with quality analysis
    """
    quality_indicators = {
        "is_structured": metrics.entropy < 0.7,  # Low entropy indicates structure
        "is_smooth": metrics.mean_abs_dx_norm < 0.3 and metrics.mean_abs_dy_norm < 0.3,
        "has_consistent_rows": metrics.row_diff_mean < 10.0,
        "has_monotonic_axes": metrics.monotonic_rows > 0.3 or metrics.monotonic_cols > 0.3,
        "has_valid_values": metrics.value_range_score > 0.95,
        "is_clean_data": metrics.nan_frequency < 0.01 and metrics.inf_frequency < 0.01,
        "has_consistent_edges": metrics.edge_consistency > 0.5
    }
    
    # Overall quality score
    quality_score = sum(quality_indicators.values()) / len(quality_indicators)
    
    return {
        "quality_score": quality_score,
        "quality_indicators": quality_indicators,
        "recommendation": "Good map candidate" if quality_score > 0.6 else "Poor map candidate"
    }