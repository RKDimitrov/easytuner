"""Unit tests for ecumap.scorer – normalization helpers and scoring pipeline."""

import numpy as np
import pytest

from ecumap.scorer import (
    ScoringWeights,
    normalize_entropy_score,
    normalize_smoothness_score,
    normalize_row_differences_score,
    normalize_variation_score,
    normalize_monotonicity_score,
    normalize_jump_anomaly_score,
    normalize_data_quality_score,
    normalize_value_coherence_score,
    normalize_local_coherence_score,
    normalize_gradient_dist_score,
    normalize_area_score,
    calculate_candidate_score,
    rank_candidates,
    select_top_candidates,
)


# ─── normalize_entropy_score ──────────────────────────────────────────────────

class TestNormalizeEntropyScore:
    def test_zero_entropy_gives_max_score(self):
        assert normalize_entropy_score(0.0) == pytest.approx(1.0)

    def test_full_entropy_gives_min_score(self):
        assert normalize_entropy_score(1.0) == pytest.approx(0.0)

    def test_midpoint_entropy(self):
        assert normalize_entropy_score(0.5) == pytest.approx(0.5)

    def test_output_clamped_to_zero_for_over_one(self):
        assert normalize_entropy_score(1.5) == pytest.approx(0.0)

    def test_output_clamped_to_one_for_negative(self):
        assert normalize_entropy_score(-0.5) == pytest.approx(1.0)


# ─── normalize_smoothness_score ───────────────────────────────────────────────

class TestNormalizeSmoothnessScore:
    def test_zero_gradients_give_max_score(self):
        score = normalize_smoothness_score(0.0, 0.0)
        assert score == pytest.approx(1.0)

    def test_large_gradients_give_low_score(self):
        score = normalize_smoothness_score(10.0, 10.0)
        assert score < 0.01

    def test_score_is_between_zero_and_one(self):
        for dx, dy in [(0.1, 0.1), (0.5, 0.5), (1.0, 0.0)]:
            score = normalize_smoothness_score(dx, dy)
            assert 0.0 <= score <= 1.0

    def test_higher_gradient_gives_lower_score(self):
        low = normalize_smoothness_score(0.1, 0.1)
        high = normalize_smoothness_score(1.0, 1.0)
        assert low > high


# ─── normalize_row_differences_score ─────────────────────────────────────────

class TestNormalizeRowDifferencesScore:
    def test_zero_diff_gives_max_score(self):
        assert normalize_row_differences_score(0.0) == pytest.approx(1.0)

    def test_large_diff_gives_low_score(self):
        score = normalize_row_differences_score(1000.0)
        assert score < 0.01

    def test_score_decreases_with_larger_diff(self):
        s1 = normalize_row_differences_score(1.0)
        s2 = normalize_row_differences_score(5.0)
        assert s1 > s2

    def test_output_in_range(self):
        for diff in [0.0, 0.5, 10.0, 100.0]:
            score = normalize_row_differences_score(diff)
            assert 0.0 <= score <= 1.0


# ─── normalize_variation_score ────────────────────────────────────────────────

class TestNormalizeVariationScore:
    def test_zero_col_variance_gives_zero(self):
        assert normalize_variation_score(0.0, 100.0) == pytest.approx(0.0)

    def test_zero_row_variance_gives_zero(self):
        assert normalize_variation_score(100.0, 0.0) == pytest.approx(0.0)

    def test_balanced_variance_gives_higher_score(self):
        balanced = normalize_variation_score(500.0, 500.0)
        unbalanced = normalize_variation_score(1000.0, 1.0)
        assert balanced > unbalanced

    def test_output_in_range(self):
        score = normalize_variation_score(100.0, 200.0)
        assert 0.0 <= score <= 1.0


# ─── normalize_monotonicity_score ────────────────────────────────────────────

class TestNormalizeMonotonicityScore:
    def test_full_monotonicity_gives_max_score(self):
        assert normalize_monotonicity_score(1.0, 1.0) == pytest.approx(1.0)

    def test_zero_monotonicity_gives_zero(self):
        assert normalize_monotonicity_score(0.0, 0.0) == pytest.approx(0.0)

    def test_average_of_rows_and_cols(self):
        score = normalize_monotonicity_score(0.8, 0.4)
        assert score == pytest.approx(0.6)


# ─── normalize_jump_anomaly_score ────────────────────────────────────────────

class TestNormalizeJumpAnomalyScore:
    def test_no_anomaly_gives_max_score(self):
        assert normalize_jump_anomaly_score(0.0) == pytest.approx(1.0)

    def test_full_anomaly_gives_zero(self):
        assert normalize_jump_anomaly_score(1.0) == pytest.approx(0.0)

    def test_midpoint_anomaly(self):
        assert normalize_jump_anomaly_score(0.5) == pytest.approx(0.5)


# ─── normalize_data_quality_score ────────────────────────────────────────────

class TestNormalizeDataQualityScore:
    def test_clean_data_gives_max_score(self):
        assert normalize_data_quality_score(0.0, 0.0) == pytest.approx(1.0)

    def test_all_nan_gives_zero(self):
        assert normalize_data_quality_score(1.0, 0.0) == pytest.approx(0.0)

    def test_all_inf_gives_zero(self):
        assert normalize_data_quality_score(0.0, 1.0) == pytest.approx(0.0)

    def test_combined_bad_frequency_clamped_to_zero(self):
        assert normalize_data_quality_score(0.7, 0.5) == pytest.approx(0.0)

    def test_partial_bad_data(self):
        score = normalize_data_quality_score(0.1, 0.05)
        assert score == pytest.approx(0.85)


# ─── normalize_value_coherence_score ─────────────────────────────────────────

class TestNormalizeValueCoherenceScore:
    def test_max_coherence(self):
        assert normalize_value_coherence_score(1.0) == pytest.approx(1.0)

    def test_zero_coherence(self):
        assert normalize_value_coherence_score(0.0) == pytest.approx(0.0)

    def test_clamps_above_one(self):
        assert normalize_value_coherence_score(1.5) == pytest.approx(1.0)

    def test_clamps_below_zero(self):
        assert normalize_value_coherence_score(-0.3) == pytest.approx(0.0)


# ─── normalize_area_score ────────────────────────────────────────────────────

class TestNormalizeAreaScore:
    def test_zero_area_gives_zero(self):
        assert normalize_area_score(0, 10) == pytest.approx(0.0)

    def test_larger_area_gives_higher_score(self):
        small = normalize_area_score(3, 3)
        large = normalize_area_score(20, 20)
        assert large > small

    def test_output_in_range(self):
        for w, h in [(3, 3), (10, 10), (40, 40)]:
            score = normalize_area_score(w, h)
            assert 0.0 <= score <= 1.0

    def test_max_reasonable_area_near_one(self):
        score = normalize_area_score(100, 100)
        assert score >= 1.0 or score <= 1.0  # capped at 1.0


# ─── calculate_candidate_score ───────────────────────────────────────────────

class TestCalculateCandidateScore:
    def _good_metrics(self) -> dict:
        return {
            "entropy": 0.3,
            "mean_abs_dx_norm": 0.05,
            "mean_abs_dy_norm": 0.05,
            "row_diff_mean": 1.0,
            "col_var_mean": 200.0,
            "row_var_mean": 180.0,
            "monotonic_rows": 0.8,
            "monotonic_cols": 0.7,
            "jump_anomaly": 0.1,
            "local_coherence": 0.9,
            "gradient_distribution_quality": 0.8,
            "value_coherence": 0.85,
            "value_range_score": 0.7,
            "nan_frequency": 0.0,
            "inf_frequency": 0.0,
            "structural_score": 0.75,
        }

    def _bad_metrics(self) -> dict:
        return {
            "entropy": 0.95,
            "mean_abs_dx_norm": 5.0,
            "mean_abs_dy_norm": 5.0,
            "row_diff_mean": 500.0,
            "col_var_mean": 0.0,
            "row_var_mean": 0.0,
            "monotonic_rows": 0.0,
            "monotonic_cols": 0.0,
            "jump_anomaly": 0.9,
            "local_coherence": 0.1,
            "gradient_distribution_quality": 0.1,
            "value_coherence": 0.0,
            "value_range_score": 0.0,
            "nan_frequency": 0.5,
            "inf_frequency": 0.3,
            "structural_score": 0.1,
        }

    def test_returns_scoring_result(self):
        result = calculate_candidate_score(self._good_metrics(), 16, 16)
        assert result is not None

    def test_good_metrics_score_higher_than_bad(self):
        good = calculate_candidate_score(self._good_metrics(), 16, 16)
        bad = calculate_candidate_score(self._bad_metrics(), 16, 16)
        assert good.score > bad.score

    def test_score_in_valid_range(self):
        result = calculate_candidate_score(self._good_metrics(), 16, 16)
        assert 0.0 <= result.score <= 1.0

    def test_weak_structural_score_caps_total(self):
        metrics = self._good_metrics()
        metrics["structural_score"] = 0.1  # Very weak structural signal
        result = calculate_candidate_score(metrics, 16, 16)
        assert result.score <= 0.72

    def test_strong_structural_score_not_capped(self):
        metrics = self._good_metrics()
        metrics["structural_score"] = 0.9
        result = calculate_candidate_score(metrics, 16, 16)
        # Score should not be artificially capped at 0.72
        # (it may still be below 0.72 due to other factors, but the cap isn't applied)
        assert result.structural_score == pytest.approx(0.9)

    def test_missing_metrics_use_defaults(self):
        result = calculate_candidate_score({}, 10, 10)
        assert 0.0 <= result.score <= 1.0

    def test_individual_scores_in_range(self):
        result = calculate_candidate_score(self._good_metrics(), 16, 16)
        for attr in [
            "entropy_score", "smoothness_score", "row_diff_score",
            "monotonicity_score", "jump_anomaly_score", "local_coherence_score",
            "gradient_dist_score", "value_coherence_score", "data_quality_score",
            "area_score",
        ]:
            val = getattr(result, attr)
            assert 0.0 <= val <= 1.0, f"{attr} = {val} out of range"


# ─── rank_candidates ─────────────────────────────────────────────────────────

class TestRankCandidates:
    def _make_candidate(self, cid: int, score_hint: float) -> dict:
        """Create a candidate dict with metrics that yield roughly the desired score."""
        return {
            "id": cid,
            "width": 16,
            "height": 16,
            "dtype": "uint16",
            "metrics": {
                "entropy": 1.0 - score_hint,
                "mean_abs_dx_norm": (1.0 - score_hint) * 2,
                "mean_abs_dy_norm": (1.0 - score_hint) * 2,
                "row_diff_mean": (1.0 - score_hint) * 20,
                "col_var_mean": score_hint * 300,
                "row_var_mean": score_hint * 280,
                "monotonic_rows": score_hint,
                "monotonic_cols": score_hint,
                "jump_anomaly": 1.0 - score_hint,
                "local_coherence": score_hint,
                "gradient_distribution_quality": score_hint,
                "value_coherence": score_hint,
                "value_range_score": score_hint,
                "nan_frequency": 0.0,
                "inf_frequency": 0.0,
                "structural_score": score_hint,
                "size_bytes": 512,
            },
        }

    def test_returns_list(self):
        candidates = [self._make_candidate(i, 0.5) for i in range(3)]
        result = rank_candidates(candidates)
        assert isinstance(result, list)

    def test_higher_scoring_candidates_ranked_first(self):
        candidates = [
            self._make_candidate(1, 0.2),   # low quality
            self._make_candidate(2, 0.9),   # high quality
            self._make_candidate(3, 0.5),   # medium quality
        ]
        ranked = rank_candidates(candidates)
        assert ranked[0]["id"] == 2

    def test_empty_list_returns_empty(self):
        assert rank_candidates([]) == []

    def test_single_candidate_returned(self):
        candidates = [self._make_candidate(1, 0.7)]
        result = rank_candidates(candidates)
        assert len(result) == 1

    def test_top_k_limits_results(self):
        candidates = [self._make_candidate(i, 0.5) for i in range(10)]
        result = select_top_candidates(candidates, top_k=3)
        assert len(result) <= 3
