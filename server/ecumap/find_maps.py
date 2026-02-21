#!/usr/bin/env python3
"""
ECU Map Detection Tool - MVP Implementation

A Python CLI tool that finds potential maps inside ECU binary dumps using
deterministic heuristics and outputs structured JSON results.

Usage:
    python find_maps.py <file.bin> [--out output.json] [--top N]

Author: ECU Map Detection Team
Version: 1.0.0
"""

import argparse
import json
import sys
import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Optional

# Import segmentation, interpretation, metrics, and scoring modules
from ecumap.segmentation import (
    SegmentationConfig,
    find_candidate_blocks,
    find_aligned_boundaries
)
from ecumap.hypothesis import generate_hypotheses, MapHypothesis
from ecumap.interpret import get_supported_element_types
from ecumap.metrics import (
    compute_map_metrics,
    compute_structural_autocorrelation_score,
    metrics_to_dict
)
from ecumap.scorer import rank_candidates
from ecumap.filters import filter_candidate


def validate_file_path(file_path: str) -> Path:
    """
    Validate that the file exists and is readable.
    
    Args:
        file_path: Path to the binary file
        
    Returns:
        Path object if valid
        
    Raises:
        SystemExit: If file validation fails
    """
    path = Path(file_path)
    
    if not path.exists():
        print(f"Error: File '{file_path}' does not exist.", file=sys.stderr)
        sys.exit(1)
    
    if not path.is_file():
        print(f"Error: '{file_path}' is not a file.", file=sys.stderr)
        sys.exit(1)
    
    if not path.stat().st_size > 0:
        print(f"Error: File '{file_path}' is empty.", file=sys.stderr)
        sys.exit(1)
    
    try:
        # Test if file is readable
        with open(path, 'rb') as f:
            f.read(1)  # Try to read one byte
    except PermissionError:
        print(f"Error: Permission denied reading file '{file_path}'.", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: Cannot read file '{file_path}': {e}", file=sys.stderr)
        sys.exit(1)
    
    return path


def create_output_schema(file_path: str, candidates: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Create the output JSON schema as specified in the PRD.
    
    Args:
        file_path: Path to the input binary file
        candidates: List of map candidates
        
    Returns:
        Dictionary matching the PRD JSON schema
    """
    return {
        "file": file_path,
        "candidates": candidates
    }


def write_output(output_data: Dict[str, Any], output_file: Optional[str] = None) -> None:
    """
    Write output to stdout or file.
    
    Args:
        output_data: Data to output
        output_file: Optional output file path
    """
    json_output = json.dumps(output_data, indent=2)
    
    if output_file:
        try:
            output_path = Path(output_file)
            output_path.write_text(json_output)
            print(f"Results written to: {output_file}")
        except Exception as e:
            print(f"Error writing to output file '{output_file}': {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print(json_output)


def find_maps_real(file_path: Path, top_k: int = 20, config: Optional[SegmentationConfig] = None) -> List[Dict[str, Any]]:
    """
    Real implementation of map detection using axis-based hypothesis generation.
    
    Args:
        file_path: Path to the binary file
        top_k: Number of top candidates to return
        config: Optional segmentation configuration
        
    Returns:
        List of map candidates
    """
    # Read the binary file
    data = file_path.read_bytes()
    
    # Use provided config or default
    if config is None:
        config = SegmentationConfig()
    
    # === STEP 1: SEGMENTATION ===
    # Find low-entropy "bookshelf" regions
    blocks = find_candidate_blocks(data, config)
    
    # Align boundaries to a reliable ECU sector boundary (16 bytes)
    blocks = find_aligned_boundaries(blocks, alignment=16)
    
    # Get all supported data types to test
    all_interpretations = get_supported_element_types()
    
    all_candidates = []
    
    # === STEP 2: HYPOTHESIS GENERATION ===
    # Iterate over each "bookshelf" block
    print(f"Processing {len(blocks)} blocks...", file=sys.stderr)
    
    for block_idx, (start_offset, end_offset) in enumerate(blocks):
        if block_idx % 10 == 0:  # Progress indicator every 10 blocks
            print(f"Processing block {block_idx}/{len(blocks)}...", file=sys.stderr)
        
        block_data = data[start_offset:end_offset]
        
        # Test this block for all supported data types
        for interpretation in all_interpretations:
            
            # Find all precise map hypotheses within this block
            hypotheses = generate_hypotheses(
                block_data,
                start_offset,
                interpretation
            )
            
            # === STEP 3: HYPOTHESIS TESTING (SCORING & FILTERING) ===
            for hypothesis in hypotheses:
                
                # The hypothesis already contains the precise 2D array.
                # Now we can *accurately* score it.
                map_metrics = compute_map_metrics(hypothesis.map_data, hypothesis.element_type)
                metrics_dict = metrics_to_dict(map_metrics)
                # Structural (autocorrelation) score - complements Shannon-based detection
                metrics_dict['structural_score'] = compute_structural_autocorrelation_score(hypothesis.map_data)
                
                # Get block stats for *this specific map region*
                map_size_bytes = hypothesis.end_offset - hypothesis.start_offset
                
                candidate = {
                    "id": len(all_candidates) + 1,
                    "axis_start": hypothesis.axis_start_offset,
                    "axis_start_hex": f"0x{hypothesis.axis_start_offset:x}",
                    "start": hypothesis.start_offset, # This is the map data
                    "end": hypothesis.end_offset, # Note: This is now the *precise* end
                    "start_hex": f"0x{hypothesis.start_offset:x}", # This is the map data
                    "end_hex": f"0x{hypothesis.end_offset:x}",
                    "element_size": hypothesis.element_size,
                    "endianness": "little" if hypothesis.endianness == "<" else "big",
                    "dtype": hypothesis.element_type,
                    "width": hypothesis.width,
                    "height": hypothesis.height,
                    "score": 0.0,  # Will be calculated by ranker
                    "metrics": {
                        # Real map detection metrics from Epic 4
                        "entropy": metrics_dict['entropy'],
                        "mean_abs_dx_norm": metrics_dict['mean_abs_dx_norm'],
                        "mean_abs_dy_norm": metrics_dict['mean_abs_dy_norm'],
                        "row_diff_mean": metrics_dict['row_diff_mean'],
                        "col_var_mean": metrics_dict['col_var_mean'],
                        "row_var_mean": metrics_dict['row_var_mean'],
                        "monotonic_rows": metrics_dict['monotonic_rows'],
                        "monotonic_cols": metrics_dict['monotonic_cols'],
                        "value_range_score": metrics_dict['value_range_score'],
                        "nan_frequency": metrics_dict['nan_frequency'],
                        "inf_frequency": metrics_dict['inf_frequency'],
                        "edge_consistency": metrics_dict['edge_consistency'],
                        "value_coherence": metrics_dict['value_coherence'],
                        "jump_anomaly": metrics_dict['jump_anomaly'],
                        "local_coherence": metrics_dict['local_coherence'],
                        "gradient_distribution_quality": metrics_dict['gradient_distribution_quality'],
                        "structural_score": metrics_dict.get('structural_score', 0.5),
                        # Basic size/value stats
                        "size_bytes": map_size_bytes,
                        "min_value": float(np.min(hypothesis.map_data)),
                        "max_value": float(np.max(hypothesis.map_data)),
                        "mean_value": float(np.mean(hypothesis.map_data)),
                        "std_value": float(np.std(hypothesis.map_data)),
                    },
                    "preview_rows": hypothesis.map_data[:3].tolist() if hypothesis.height >= 3 else hypothesis.map_data.tolist()
                }
                
                # === STEP 4: FILTERING ===
                # Use the *existing* realistic filter, which will now work correctly
                if filter_candidate(candidate, hypothesis.map_data):
                    all_candidates.append(candidate)
    
    # === STEP 5: RANKING ===
    # Rank all candidates (this is fast)
    ranked_candidates = rank_candidates(all_candidates)
    
    # === STEP 6: OPTIMIZED DEDUPLICATION ===
    # Take a much larger slice than top_k for deduplication
    # (e.g., 10x top_k, or at least 200)
    pre_dedup_slice = ranked_candidates[:max(top_k * 10, 200)]
    
    # NOW run the expensive O(n^2) deduplication on the *small* slice
    deduplicated_candidates = deduplicate_by_overlap(pre_dedup_slice)
    
    # Select top K from the deduplicated list
    top_candidates = deduplicated_candidates[:top_k]
    
    return top_candidates


def exhaustive_axis_search(data: bytes, top_k: int = 20) -> List[Dict[str, Any]]:
    """
    Fast search across entire file for maps that might span block boundaries.
    This is a light-weight pass that only looks at high-potential regions.
    
    Args:
        data: Binary file data
        top_k: Number of top candidates to return
        
    Returns:
        List of map candidates
    """
    all_candidates = []
    
    # Use fewer interpretations for speed - focus on common types
    # Skip the exotic ones in exhaustive search
    common_interpretations = [
        interp for interp in get_supported_element_types()
        if interp.element_type.value in ['uint16', 'int16', 'float32']
    ]
    
    # Reduce search density for speed
    search_window = 4096  # 4KB windows (smaller for speed)
    step = 2048  # Larger step (less overlap)
    
    print(f"Running quick scan across {len(data)} bytes...", file=sys.stderr)
    
    for offset in range(0, len(data) - search_window, step):
        if offset % 50000 == 0:  # Progress indicator
            print(f"  Scan: {offset}/{len(data)-search_window}...", file=sys.stderr)
        
        window_data = data[offset:offset + search_window]
        
        for interpretation in common_interpretations:
            hypotheses = generate_hypotheses(
                window_data,
                offset,
                interpretation
            )
            
            for hypothesis in hypotheses:
                # Process each hypothesis
                map_metrics = compute_map_metrics(hypothesis.map_data, hypothesis.element_type)
                metrics_dict = metrics_to_dict(map_metrics)
                metrics_dict['structural_score'] = compute_structural_autocorrelation_score(hypothesis.map_data)
                
                map_size_bytes = hypothesis.end_offset - hypothesis.start_offset
                
                candidate = {
                    "id": len(all_candidates) + 1,
                    "axis_start": hypothesis.axis_start_offset,
                    "axis_start_hex": f"0x{hypothesis.axis_start_offset:x}",
                    "start": hypothesis.start_offset,
                    "end": hypothesis.end_offset,
                    "start_hex": f"0x{hypothesis.start_offset:x}",
                    "end_hex": f"0x{hypothesis.end_offset:x}",
                    "element_size": hypothesis.element_size,
                    "endianness": "little" if hypothesis.endianness == "<" else "big",
                    "dtype": hypothesis.element_type,
                    "width": hypothesis.width,
                    "height": hypothesis.height,
                    "score": 0.0,
                    "metrics": {
                        "entropy": metrics_dict['entropy'],
                        "mean_abs_dx_norm": metrics_dict['mean_abs_dx_norm'],
                        "mean_abs_dy_norm": metrics_dict['mean_abs_dy_norm'],
                        "row_diff_mean": metrics_dict['row_diff_mean'],
                        "col_var_mean": metrics_dict['col_var_mean'],
                        "row_var_mean": metrics_dict['row_var_mean'],
                        "monotonic_rows": metrics_dict['monotonic_rows'],
                        "monotonic_cols": metrics_dict['monotonic_cols'],
                        "value_range_score": metrics_dict['value_range_score'],
                        "nan_frequency": metrics_dict['nan_frequency'],
                        "inf_frequency": metrics_dict['inf_frequency'],
                        "edge_consistency": metrics_dict['edge_consistency'],
                        "value_coherence": metrics_dict['value_coherence'],
                        "jump_anomaly": metrics_dict['jump_anomaly'],
                        "local_coherence": metrics_dict['local_coherence'],
                        "gradient_distribution_quality": metrics_dict['gradient_distribution_quality'],
                        "structural_score": metrics_dict.get('structural_score', 0.5),
                        "size_bytes": map_size_bytes,
                        "min_value": float(np.min(hypothesis.map_data)),
                        "max_value": float(np.max(hypothesis.map_data)),
                        "mean_value": float(np.mean(hypothesis.map_data)),
                        "std_value": float(np.std(hypothesis.map_data)),
                    },
                    "preview_rows": hypothesis.map_data[:3].tolist() if hypothesis.height >= 3 else hypothesis.map_data.tolist()
                }
                
                # Filter candidate
                if filter_candidate(candidate, hypothesis.map_data):
                    all_candidates.append(candidate)
    
    # Rank and return top candidates
    ranked_candidates = rank_candidates(all_candidates)
    
    # Deduplicate
    pre_dedup_slice = ranked_candidates[:max(top_k * 10, 200)]
    deduplicated_candidates = deduplicate_by_overlap(pre_dedup_slice)
    
    return deduplicated_candidates[:top_k]


def filter_statistical_outliers(
    candidates: List[Dict[str, Any]], 
    z_threshold: float = 2.0
) -> List[Dict[str, Any]]:
    """
    Remove statistical outliers based on score distribution.
    If a candidate's score is > z_threshold standard deviations below the mean, reject it.
    
    Args:
        candidates: List of candidates
        z_threshold: Z-score threshold for filtering
        
    Returns:
        Filtered list of candidates
    """
    if len(candidates) < 3:
        return candidates
    
    scores = [c['score'] for c in candidates]
    mean_score = np.mean(scores)
    std_score = np.std(scores)
    
    if std_score == 0:
        return candidates
    
    # Calculate z-scores and filter
    filtered = []
    for candidate in candidates:
        z_score = (candidate['score'] - mean_score) / std_score
        
        # Keep if z-score > -z_threshold (not a low outlier)
        if z_score > -z_threshold:
            filtered.append(candidate)
    
    return filtered


def deduplicate_by_overlap(
    candidates: List[Dict[str, Any]], 
    overlap_threshold: float = 0.5
) -> List[Dict[str, Any]]:
    """
    Deduplicates candidates based on byte-level overlap using Non-Maximal Suppression (NMS).
    
    Args:
        candidates: List of candidates, sorted by score (highest first).
        overlap_threshold: The IoU (Intersection over Union) or overlap ratio
                           threshold to suppress a candidate.
                           
    Returns:
        A deduplicated list of candidates.
    """
    # Assumes candidates are already sorted by score, descending
    # (rank_candidates already does this)
    
    final_candidates = []
    suppressed_indices = set()

    for i in range(len(candidates)):
        if i in suppressed_indices:
            continue
            
        # Keep this candidate
        cand_i = candidates[i]
        final_candidates.append(cand_i)
        
        # Suppress all other candidates that significantly overlap with this one
        start_i = cand_i['start']
        end_i = cand_i['end']
        range_i = set(range(start_i, end_i))
        len_i = len(range_i)
        
        for j in range(i + 1, len(candidates)):
            if j in suppressed_indices:
                continue
                
            cand_j = candidates[j]
            start_j = cand_j['start']
            end_j = cand_j['end']
            range_j = set(range(start_j, end_j))
            len_j = len(range_j)
            
            # Calculate overlap
            intersection = len(range_i.intersection(range_j))
            union = len_i + len_j - intersection
            
            if union == 0:
                iou = 0
            else:
                iou = intersection / union
            
            # If overlap is high, suppress the lower-scoring candidate (j)
            if iou > overlap_threshold:
                suppressed_indices.add(j)
                
    return final_candidates


def create_argument_parser() -> argparse.ArgumentParser:
    """
    Create and configure the argument parser.
    
    Returns:
        Configured ArgumentParser instance
    """
    parser = argparse.ArgumentParser(
        prog='find_maps.py',
        description='ECU Map Detection Tool - Find potential maps in ECU binary dumps',
        epilog="""
Examples:
  python find_maps.py ecu.bin
  python find_maps.py ecu.bin --out results.json
  python find_maps.py ecu.bin --top 10 --out maps.json
  
For more information, see the project documentation.
        """,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    parser.add_argument(
        'file',
        help='Path to the ECU binary file (.bin) to analyze'
    )
    
    parser.add_argument(
        '--out',
        metavar='FILE',
        help='Output file path for JSON results (default: stdout)'
    )
    
    parser.add_argument(
        '--top',
        type=int,
        default=20,
        metavar='N',
        help='Number of top candidates to return (default: 20)'
    )
    
    parser.add_argument(
        '--window-size',
        type=int,
        default=1024,
        metavar='SIZE',
        help='Sliding window size in bytes (default: 1024)'
    )
    
    parser.add_argument(
        '--entropy-threshold',
        type=float,
        default=7.2,
        metavar='THRESHOLD',
        help='Entropy threshold for structured data detection (default: 7.2)'
    )
    
    parser.add_argument(
        '--min-block-size',
        type=int,
        default=256,
        metavar='SIZE',
        help='Minimum block size in bytes (default: 256)'
    )
    
    parser.add_argument(
        '--version',
        action='version',
        version='%(prog)s 1.0.0'
    )
    
    return parser


def main() -> None:
    """
    Main entry point for the ECU map detection tool.
    """
    parser = create_argument_parser()
    args = parser.parse_args()
    
    # Validate input file
    file_path = validate_file_path(args.file)
    
    # Validate top parameter
    if args.top < 1:
        print("Error: --top must be a positive integer.", file=sys.stderr)
        sys.exit(1)
    
    try:
        # Create segmentation configuration from CLI arguments
        config = SegmentationConfig(
            window_size=args.window_size,
            step_size=256,  # Fixed step size
            entropy_threshold=args.entropy_threshold,
            min_block_size=args.min_block_size,
            ascii_threshold=0.3  # Fixed ASCII threshold
        )
        
        # Find maps using block-based approach (primary)
        candidates_blocks = find_maps_real(file_path, args.top * 3, config)
        
        # Optional: Exhaustive search for maps spanning block boundaries
        # This is slower but can catch additional maps. Disabled by default.
        # Uncomment the lines below to enable:
        # data = file_path.read_bytes()
        # candidates_exhaustive = exhaustive_axis_search(data, args.top * 3)
        # all_candidates = candidates_blocks + candidates_exhaustive
        all_candidates = candidates_blocks
        
        # Deduplicate, rank, and filter outliers
        deduplicated = deduplicate_by_overlap(all_candidates)
        final_ranked = rank_candidates(deduplicated)
        
        # Filter statistical outliers (remove low-scoring anomalies)
        filtered_candidates = filter_statistical_outliers(final_ranked, z_threshold=1.5)
        
        candidates = filtered_candidates[:args.top]
        
        # Create output schema
        output_data = create_output_schema(str(file_path), candidates)
        
        # Write output
        write_output(output_data, args.out)
        
    except KeyboardInterrupt:
        print("\nOperation cancelled by user.", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()