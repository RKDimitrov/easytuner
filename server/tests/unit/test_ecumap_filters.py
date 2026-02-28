"""Unit tests for ecumap.filters – ECU map candidate filter functions."""

import numpy as np
import pytest

from ecumap.filters import (
    is_realistic_map_dimensions,
    has_realistic_values,
    has_map_structure,
    has_reasonable_size_bytes,
    filter_candidate,
    MIN_ROWS,
    MAX_ROWS,
    MIN_COLS,
    MAX_COLS,
)


# ─── is_realistic_map_dimensions ─────────────────────────────────────────────

class TestIsRealisticMapDimensions:
    def test_typical_square_map_passes(self):
        assert is_realistic_map_dimensions(16, 16) is True

    def test_minimum_valid_dimensions_pass(self):
        assert is_realistic_map_dimensions(MIN_COLS, MIN_ROWS) is True

    def test_maximum_valid_dimensions_pass(self):
        assert is_realistic_map_dimensions(MAX_COLS, MAX_ROWS) is True

    def test_too_small_width_fails(self):
        assert is_realistic_map_dimensions(MIN_COLS - 1, 10) is False

    def test_too_small_height_fails(self):
        assert is_realistic_map_dimensions(10, MIN_ROWS - 1) is False

    def test_too_large_width_fails(self):
        assert is_realistic_map_dimensions(MAX_COLS + 1, 10) is False

    def test_too_large_height_fails(self):
        assert is_realistic_map_dimensions(10, MAX_ROWS + 1) is False

    def test_extreme_aspect_ratio_fails(self):
        # 704 x 2 → ratio 352:1 — unrealistic
        assert is_realistic_map_dimensions(704, 2) is False

    def test_moderate_aspect_ratio_fails(self):
        # 3:1 ratio is the strict threshold — 30x10 → ratio 3.0 (border case)
        # 31x10 → ratio 3.1 — should fail
        assert is_realistic_map_dimensions(31, 10) is False

    def test_height_more_than_twice_width_fails(self):
        assert is_realistic_map_dimensions(5, 11) is False

    def test_width_more_than_twice_height_fails(self):
        assert is_realistic_map_dimensions(11, 5) is False

    def test_rectangular_but_valid_map_passes(self):
        # 10x20 → ratio 2:1, within 2x limit
        assert is_realistic_map_dimensions(10, 20) is True


# ─── has_realistic_values ────────────────────────────────────────────────────

class TestHasRealisticValues:
    def _make_realistic_array(self, shape=(16, 16)) -> np.ndarray:
        """Create a realistic ECU-like 2D array that passes all filter checks."""
        np.random.seed(0)
        # Use a normal-ish distribution centred around 500 with std ~150
        # so the histogram has a bell-curve shape (high hist_std)
        arr = np.random.normal(500, 150, shape).astype(np.float32)
        # Clip to uint16 range and ensure no constant values
        arr = np.clip(arr, 1, 65000)
        return arr

    def test_realistic_array_passes(self):
        arr = self._make_realistic_array()
        assert has_realistic_values(arr, 'uint16') is True

    def test_constant_array_fails(self):
        arr = np.full((8, 8), 100.0, dtype=np.float32)
        assert has_realistic_values(arr, 'uint16') is False

    def test_all_zeros_fails(self):
        arr = np.zeros((8, 8), dtype=np.float32)
        assert has_realistic_values(arr, 'uint16') is False

    def test_too_few_elements_fails(self):
        arr = np.array([[1.0, 2.0], [3.0, 4.0]], dtype=np.float32)
        assert has_realistic_values(arr, 'uint16') is False

    def test_extreme_float_values_fail(self):
        arr = np.full((8, 8), 1e25, dtype=np.float64)
        assert has_realistic_values(arr, 'float32') is False

    def test_dominant_single_value_fails(self):
        # 50% zeros — should fail the max_repeat_ratio check
        arr = np.zeros((10, 10), dtype=np.float32)
        arr[0:5, :] = np.arange(50, dtype=np.float32).reshape(5, 10)
        assert has_realistic_values(arr, 'uint16') is False

    def test_diverse_uint16_values_pass(self):
        # Simulate a fuel map with a bell-curve-like distribution
        np.random.seed(7)
        arr = np.random.normal(300, 100, (16, 16)).astype(np.float32)
        arr = np.clip(arr, 1, 65000)
        assert has_realistic_values(arr, 'uint16') is True


# ─── has_map_structure ────────────────────────────────────────────────────────

class TestHasMapStructure:
    def test_small_array_always_passes(self):
        arr = np.array([[1.0, 2.0], [3.0, 4.0]])
        assert has_map_structure(arr) is True

    def test_gradient_map_passes(self):
        # Corners are different: top-left=0, bottom-right=100
        arr = np.array(
            [[i * 10.0 + j for j in range(10)] for i in range(10)],
            dtype=np.float32,
        )
        assert has_map_structure(arr) is True

    def test_flat_map_fails(self):
        # All corners identical → corner_diff/corner_val_range < 0.05
        arr = np.full((10, 10), 50.0, dtype=np.float32)
        assert has_map_structure(arr) is False


# ─── has_reasonable_size_bytes ───────────────────────────────────────────────

class TestHasReasonableSizeBytes:
    def test_minimum_valid_size(self):
        assert has_reasonable_size_bytes(16) is True

    def test_typical_map_size(self):
        assert has_reasonable_size_bytes(512) is True

    def test_maximum_valid_size(self):
        assert has_reasonable_size_bytes(32768) is True

    def test_too_small_fails(self):
        assert has_reasonable_size_bytes(15) is False

    def test_too_large_fails(self):
        assert has_reasonable_size_bytes(32769) is False

    def test_zero_fails(self):
        assert has_reasonable_size_bytes(0) is False


# ─── filter_candidate ────────────────────────────────────────────────────────

class TestFilterCandidate:
    def _make_candidate(self, width=16, height=16, dtype='uint16', size_bytes=512) -> dict:
        return {
            "width": width,
            "height": height,
            "dtype": dtype,
            "metrics": {"size_bytes": size_bytes},
        }

    def _make_realistic_array(self, shape=(16, 16)) -> np.ndarray:
        np.random.seed(0)
        arr = np.random.normal(500, 150, shape).astype(np.float32)
        arr = np.clip(arr, 1, 65000)
        return arr

    def test_valid_candidate_passes(self):
        candidate = self._make_candidate()
        array_2d = self._make_realistic_array()
        assert filter_candidate(candidate, array_2d) is True

    def test_bad_dimensions_rejected(self):
        candidate = self._make_candidate(width=200, height=2)
        array_2d = self._make_realistic_array((2, 200))
        assert filter_candidate(candidate, array_2d) is False

    def test_bad_size_bytes_rejected(self):
        candidate = self._make_candidate(size_bytes=5)
        array_2d = self._make_realistic_array()
        assert filter_candidate(candidate, array_2d) is False

    def test_constant_values_rejected(self):
        candidate = self._make_candidate()
        array_2d = np.full((16, 16), 42.0, dtype=np.float32)
        assert filter_candidate(candidate, array_2d) is False

    def test_flat_structure_rejected(self):
        candidate = self._make_candidate()
        # All corners identical → fails has_map_structure
        array_2d = np.full((16, 16), 50.0, dtype=np.float32)
        assert filter_candidate(candidate, array_2d) is False
