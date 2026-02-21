"""
ECU Map Detection - Scoring & Ranking System

This module implements deterministic scoring algorithms to rank map candidates
and provide the most promising results based on weighted combinations of metrics.

Key algorithms:
- Deterministic scoring function with configurable weights
- Normalized metric combinations
- Tie-breaking logic (entropy, area)
- Top-K candidate selection and ranking
"""

import numpy as np
from typing import List, Dict, Any, Tuple
from dataclasses import dataclass
from enum import Enum


class ScoringWeights:
    """
    Configuration class for scoring weights.
    
    REBALANCED to prioritize 2D map data smoothness and de-emphasize 
    1D axis-like monotonicity. The previous aggressive monotonicity weighting
    was detecting axis arrays and pointer tables instead of actual map data.
    """
    
    # --- PRIMARY HEURISTICS (Structural) ---
    # Greatly reduced - was over-rewarding axis arrays instead of map body
    MONOTONICITY_WEIGHT = 0.20      # WAS: 0.50 - Reduced to stop rewarding axes
    
    # Restored - smooth value transitions are characteristic of map data
    SMOOTHNESS_WEIGHT = 0.15        # WAS: 0.00 - Restored for 2D smoothness
    
    # Increased - rewards logical value patterns in map body
    VALUE_COHERENCE_WEIGHT = 0.20   # WAS: 0.15 - Increased
    
    # Moderate penalty for chaotic data
    JUMP_ANOMALY_WEIGHT = 0.15      # WAS: 0.20 - Slightly reduced
    
    # --- SECONDARY HEURISTICS ---
    ENTROPY_WEIGHT = 0.10           # WAS: 0.10 - Keep
    
    # Increased to penalize axis-like candidates where rows are too similar
    ROW_DIFFERENCES_WEIGHT = 0.10   # WAS: 0.05 - Increased
    
    # Restored - help identify coherent 2D structure
    LOCAL_COHERENCE_WEIGHT = 0.05   # WAS: 0.00 - Restored
    GRADIENT_DIST_WEIGHT = 0.05     # WAS: 0.00 - Restored
    
    # Keep low
    VALUE_RANGE_WEIGHT = 0.02       # WAS: 0.00 - Restored to 0.02
    DATA_QUALITY_WEIGHT = 0.02      # WAS: 0.00 - Restored to 0.02
    AREA_TIEBREAK_WEIGHT = 0.05     # WAS: 0.00 - Restored to 0.05
    
    # Structural (autocorrelation) score - complements Shannon/entropy detection
    STRUCTURAL_WEIGHT = 0.15
    
    # Keep deactivated - still causes issues
    VARIATION_WEIGHT = 0.00         # Still 0.00


@dataclass
class ScoringResult:
    """Container for scoring results."""
    candidate_id: int
    score: float
    structural_score: float
    entropy_score: float
    smoothness_score: float
    row_diff_score: float
    variation_score: float
    monotonicity_score: float
    jump_anomaly_score: float
    local_coherence_score: float
    gradient_dist_score: float
    value_coherence_score: float
    value_range_score: float
    data_quality_score: float
    area_score: float
    total_area: int


def normalize_entropy_score(entropy: float) -> float:
    """
    Normalize entropy score (lower entropy = higher score).
    
    Args:
        entropy: Raw entropy value (0-1)
        
    Returns:
        Normalized score (0-1, higher is better)
    """
    # Lower entropy is better, so invert the score
    # Clamp to valid range [0, 1]
    return max(0.0, min(1.0, 1.0 - entropy))


def normalize_smoothness_score(mean_abs_dx: float, mean_abs_dy: float) -> float:
    """
    Normalize smoothness score (lower gradients = higher score).
    
    Args:
        mean_abs_dx: Mean absolute horizontal gradient
        mean_abs_dy: Mean absolute vertical gradient
        
    Returns:
        Normalized score (0-1, higher is better)
    """
    # Average the gradients and normalize
    avg_gradient = (mean_abs_dx + mean_abs_dy) / 2.0
    
    # Use exponential decay for smoothness scoring
    # Lower gradients get exponentially higher scores
    smoothness_score = np.exp(-avg_gradient * 10.0)
    
    return min(1.0, smoothness_score)


def normalize_row_differences_score(row_diff_mean: float) -> float:
    """
    Normalize row differences score (lower differences = higher score).
    
    Args:
        row_diff_mean: Mean row-to-row difference
        
    Returns:
        Normalized score (0-1, higher is better)
    """
    # Use logarithmic scaling to handle large differences
    if row_diff_mean <= 0:
        return 1.0
    
    # Use exponential decay for better handling of large differences
    # This gives much lower scores for large differences
    normalized_score = np.exp(-row_diff_mean / 10.0)
    
    return min(1.0, normalized_score)


def normalize_variation_score(col_var_mean: float, row_var_mean: float) -> float:
    """
    Normalize variation score. Rewards maps that have variance
    in *both* directions, and penalizes ramps (variance in one dir).
    
    Args:
        col_var_mean: Mean column variance
        row_var_mean: Mean row variance
        
    Returns:
        Normalized score (0-1, higher is better)
    """
    # Use a small epsilon to avoid division by zero
    epsilon = 1e-9

    if col_var_mean < epsilon or row_var_mean < epsilon:
        # If variance in *either* direction is zero, it's a flat block or
        # a "ramp" that is flat along one axis. Penalize heavily.
        # (The filter should have caught flat blocks already)
        return 0.0
    
    # We want maps where row and column variances are "balanced"
    # A ramp will have (e.g.) col_var=1000, row_var=0.
    # A 2D map will have (e.g.) col_var=500, row_var=600.
    total_var = col_var_mean + row_var_mean
    balance_ratio = 1.0 - (abs(col_var_mean - row_var_mean) / (total_var + epsilon))
    
    # We also want to reward *having* variance in general (it's not flat)
    # Use log1p to scale the magnitude of variance
    magnitude = np.log1p(total_var)
    
    # Normalize magnitude (crude, assumes max log(variance) is ~20)
    norm_magnitude = min(1.0, magnitude / 20.0)
    
    # Final score is a mix of being balanced and having significant variance
    return (balance_ratio * 0.7) + (norm_magnitude * 0.3)


def normalize_monotonicity_score(monotonic_rows: float, monotonic_cols: float) -> float:
    """
    Normalize monotonicity score (higher monotonicity = higher score).
    
    Args:
        monotonic_rows: Fraction of monotonic rows
        monotonic_cols: Fraction of monotonic columns
        
    Returns:
        Normalized score (0-1, higher is better)
    """
    # Average monotonicity from rows and columns
    avg_monotonicity = (monotonic_rows + monotonic_cols) / 2.0
    
    # Monotonicity is already normalized (0-1), so use it directly
    return avg_monotonicity


def normalize_value_range_score(value_range_score: float) -> float:
    """
    Normalize value range score (higher score = higher score).
    
    Args:
        value_range_score: Raw value range score (0-1)
        
    Returns:
        Normalized score (0-1, higher is better)
    """
    # Value range score is already normalized, use it directly
    return value_range_score


def normalize_data_quality_score(nan_frequency: float, inf_frequency: float) -> float:
    """
    Normalize data quality score (lower NaN/inf = higher score).
    
    Args:
        nan_frequency: Frequency of NaN values
        inf_frequency: Frequency of infinite values
        
    Returns:
        Normalized score (0-1, higher is better)
    """
    # Combine NaN and inf frequencies
    total_bad_frequency = nan_frequency + inf_frequency
    
    # Lower bad frequency = higher score
    quality_score = max(0.0, 1.0 - total_bad_frequency)
    
    return quality_score


def normalize_value_coherence_score(value_coherence: float) -> float:
    """
    Normalize value coherence score (higher coherence = higher score).
    
    Args:
        value_coherence: Raw value coherence score (0-1)
        
    Returns:
        Normalized score (0-1, higher is better)
    """
    # Value coherence is already normalized, use it directly
    return float(np.clip(value_coherence, 0.0, 1.0))


def normalize_jump_anomaly_score(jump_anomaly: float) -> float:
    """
    Normalize jump anomaly score (lower anomaly = higher score).
    
    Args:
        jump_anomaly: Raw jump anomaly score (0-1)
        
    Returns:
        Normalized score (0-1, higher is better)
    """
    # Lower jump anomaly = higher score (invert)
    return 1.0 - jump_anomaly


def normalize_local_coherence_score(local_coherence: float) -> float:
    """
    Normalize local coherence score (higher coherence = higher score).
    
    Args:
        local_coherence: Raw local coherence score (0-1)
        
    Returns:
        Normalized score (0-1, higher is better)
    """
    return float(np.clip(local_coherence, 0.0, 1.0))


def normalize_gradient_dist_score(gradient_dist: float) -> float:
    """
    Normalize gradient distribution score (higher quality = higher score).
    
    Args:
        gradient_dist: Raw gradient distribution score (0-1)
        
    Returns:
        Normalized score (0-1, higher is better)
    """
    return float(np.clip(gradient_dist, 0.0, 1.0))


def normalize_area_score(width: int, height: int) -> float:
    """
    Normalize area score for tie-breaking (larger area = slightly higher score).
    
    Args:
        width: Map width
        height: Map height
        
    Returns:
        Normalized score (0-1, higher is better)
    """
    area = width * height
    
    # Use logarithmic scaling to prevent very large areas from dominating
    if area <= 0:
        return 0.0
    
    # Log scale with normalization
    log_area = np.log(area)
    max_log_area = np.log(10000)  # Assume max reasonable area
    
    area_score = min(1.0, log_area / max_log_area)
    
    return area_score


def calculate_candidate_score(metrics: Dict[str, Any], width: int, height: int) -> ScoringResult:
    """
    Calculate comprehensive score for a map candidate.
    
    Args:
        metrics: Dictionary containing all map metrics
        width: Map width
        height: Map height
        
    Returns:
        ScoringResult with detailed scoring breakdown
    """
    # Extract metrics
    entropy = metrics.get('entropy', 0.0)
    mean_abs_dx_norm = metrics.get('mean_abs_dx_norm', 0.0)
    mean_abs_dy_norm = metrics.get('mean_abs_dy_norm', 0.0)
    row_diff_mean = metrics.get('row_diff_mean', 0.0)
    col_var_mean = metrics.get('col_var_mean', 0.0)
    row_var_mean = metrics.get('row_var_mean', 0.0)
    monotonic_rows = metrics.get('monotonic_rows', 0.0)
    monotonic_cols = metrics.get('monotonic_cols', 0.0)
    jump_anomaly = metrics.get('jump_anomaly', 0.5)
    local_coherence = metrics.get('local_coherence', 0.5)
    gradient_dist = metrics.get('gradient_distribution_quality', 0.5)
    value_coherence = metrics.get('value_coherence', 0.0)
    value_range_score = metrics.get('value_range_score', 0.0)
    nan_frequency = metrics.get('nan_frequency', 0.0)
    inf_frequency = metrics.get('inf_frequency', 0.0)
    structural_score = float(np.clip(metrics.get('structural_score', 0.5), 0.0, 1.0))
    
    # Calculate individual normalized scores
    entropy_score = normalize_entropy_score(entropy)
    smoothness_score = normalize_smoothness_score(mean_abs_dx_norm, mean_abs_dy_norm)
    row_diff_score = normalize_row_differences_score(row_diff_mean)
    variation_score = normalize_variation_score(col_var_mean, row_var_mean)
    monotonicity_score = normalize_monotonicity_score(monotonic_rows, monotonic_cols)
    jump_anomaly_score = normalize_jump_anomaly_score(jump_anomaly)
    local_coherence_score = normalize_local_coherence_score(local_coherence)
    gradient_dist_score = normalize_gradient_dist_score(gradient_dist)
    value_coherence_score = normalize_value_coherence_score(value_coherence)
    value_range_score_norm = normalize_value_range_score(value_range_score)
    data_quality_score = normalize_data_quality_score(nan_frequency, inf_frequency)
    area_score = normalize_area_score(width, height)
    
    # Calculate weighted total score (Shannon-based + structural)
    total_score = (
        ScoringWeights.ENTROPY_WEIGHT * entropy_score +
        ScoringWeights.SMOOTHNESS_WEIGHT * smoothness_score +
        ScoringWeights.ROW_DIFFERENCES_WEIGHT * row_diff_score +
        ScoringWeights.VARIATION_WEIGHT * variation_score +
        ScoringWeights.MONOTONICITY_WEIGHT * monotonicity_score +
        ScoringWeights.JUMP_ANOMALY_WEIGHT * jump_anomaly_score +
        ScoringWeights.LOCAL_COHERENCE_WEIGHT * local_coherence_score +
        ScoringWeights.GRADIENT_DIST_WEIGHT * gradient_dist_score +
        ScoringWeights.VALUE_COHERENCE_WEIGHT * value_coherence_score +
        ScoringWeights.VALUE_RANGE_WEIGHT * value_range_score_norm +
        ScoringWeights.DATA_QUALITY_WEIGHT * data_quality_score +
        ScoringWeights.AREA_TIEBREAK_WEIGHT * area_score +
        ScoringWeights.STRUCTURAL_WEIGHT * structural_score
    )
    
    # Consensus: cap score if structural signal is weak (reduces confidence fluctuations)
    if structural_score < 0.35:
        total_score = min(total_score, 0.72)
    
    return ScoringResult(
        candidate_id=0,  # Will be set by caller
        score=total_score,
        structural_score=structural_score,
        entropy_score=entropy_score,
        smoothness_score=smoothness_score,
        row_diff_score=row_diff_score,
        variation_score=variation_score,
        monotonicity_score=monotonicity_score,
        jump_anomaly_score=jump_anomaly_score,
        local_coherence_score=local_coherence_score,
        gradient_dist_score=gradient_dist_score,
        value_coherence_score=value_coherence_score,
        value_range_score=value_range_score_norm,
        data_quality_score=data_quality_score,
        area_score=area_score,
        total_area=width * height
    )


def rank_candidates(candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Rank candidates by their calculated scores.
    
    Args:
        candidates: List of candidate dictionaries
        
    Returns:
        List of candidates sorted by score (highest first)
    """
    if not candidates:
        return []
    
    # Calculate scores for all candidates
    scored_candidates = []
    
    for i, candidate in enumerate(candidates):
        metrics = candidate.get('metrics', {})
        width = candidate.get('width', 1)
        height = candidate.get('height', 1)
        
        scoring_result = calculate_candidate_score(metrics, width, height)
        scoring_result.candidate_id = candidate.get('id', i + 1)
        
        # Add scoring information to candidate
        candidate_copy = candidate.copy()
        candidate_copy['score'] = scoring_result.score
        candidate_copy['scoring_breakdown'] = {
            'structural_score': scoring_result.structural_score,
            'entropy_score': scoring_result.entropy_score,
            'smoothness_score': scoring_result.smoothness_score,
            'row_diff_score': scoring_result.row_diff_score,
            'variation_score': scoring_result.variation_score,
            'monotonicity_score': scoring_result.monotonicity_score,
            'jump_anomaly_score': scoring_result.jump_anomaly_score,
            'local_coherence_score': scoring_result.local_coherence_score,
            'gradient_dist_score': scoring_result.gradient_dist_score,
            'value_coherence_score': scoring_result.value_coherence_score,
            'value_range_score': scoring_result.value_range_score,
            'data_quality_score': scoring_result.data_quality_score,
            'area_score': scoring_result.area_score
        }
        
        scored_candidates.append((scoring_result.score, candidate_copy))
    
    # Sort by score (highest first), then by area (largest first) for tie-breaking
    scored_candidates.sort(key=lambda x: (-x[0], -x[1]['width'] * x[1]['height']))
    
    # Return sorted candidates without scoring tuples
    return [candidate for _, candidate in scored_candidates]


def select_top_candidates(candidates: List[Dict[str, Any]], top_k: int = 20) -> List[Dict[str, Any]]:
    """
    Select top-K candidates after ranking.
    
    Args:
        candidates: List of candidate dictionaries
        top_k: Number of top candidates to return
        
    Returns:
        List of top-K candidates
    """
    ranked_candidates = rank_candidates(candidates)
    return ranked_candidates[:top_k]


def analyze_scoring_distribution(candidates: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyze the distribution of scores for debugging and optimization.
    
    Args:
        candidates: List of scored candidates
        
    Returns:
        Dictionary with scoring statistics
    """
    if not candidates:
        return {}
    
    scores = [candidate.get('score', 0.0) for candidate in candidates]
    
    return {
        'total_candidates': len(candidates),
        'score_mean': float(np.mean(scores)),
        'score_std': float(np.std(scores)),
        'score_min': float(np.min(scores)),
        'score_max': float(np.max(scores)),
        'score_median': float(np.median(scores)),
        'high_quality_count': sum(1 for score in scores if score > 0.7),
        'medium_quality_count': sum(1 for score in scores if 0.4 <= score <= 0.7),
        'low_quality_count': sum(1 for score in scores if score < 0.4)
    }


def get_scoring_weights() -> Dict[str, float]:
    """
    Get current scoring weights for transparency.
    
    Returns:
        Dictionary of current scoring weights
    """
    return {
        'entropy_weight': ScoringWeights.ENTROPY_WEIGHT,
        'smoothness_weight': ScoringWeights.SMOOTHNESS_WEIGHT,
        'row_differences_weight': ScoringWeights.ROW_DIFFERENCES_WEIGHT,
        'variation_weight': ScoringWeights.VARIATION_WEIGHT,
        'monotonicity_weight': ScoringWeights.MONOTONICITY_WEIGHT,
        'jump_anomaly_weight': ScoringWeights.JUMP_ANOMALY_WEIGHT,
        'local_coherence_weight': ScoringWeights.LOCAL_COHERENCE_WEIGHT,
        'gradient_dist_weight': ScoringWeights.GRADIENT_DIST_WEIGHT,
        'value_coherence_weight': ScoringWeights.VALUE_COHERENCE_WEIGHT,
        'value_range_weight': ScoringWeights.VALUE_RANGE_WEIGHT,
        'data_quality_weight': ScoringWeights.DATA_QUALITY_WEIGHT,
        'area_tiebreak_weight': ScoringWeights.AREA_TIEBREAK_WEIGHT
    }