#!/usr/bin/env python3
"""
Evaluate ECU map detection results against ground truth addresses.

This script compares detected map candidates from results.json against
known map addresses in addresses.json and calculates various metrics.
"""

import json
import sys
from collections import defaultdict
from typing import Dict, List, Tuple, Optional


def hex_to_int(hex_str: str) -> int:
    """Convert hex string (with or without 0x prefix) to integer."""
    hex_str = hex_str.strip().upper()
    if hex_str.startswith('0X'):
        hex_str = hex_str[2:]
    return int(hex_str, 16)


def parse_dimensions(dim_str: Optional[str]) -> Optional[Tuple[int, int]]:
    """Parse dimension string like '8x16' or '10x10' into (width, height)."""
    if not dim_str:
        return None
    try:
        parts = dim_str.split('x')
        if len(parts) == 2:
            return (int(parts[0]), int(parts[1]))
        elif len(parts) == 1:
            # Single dimension, assume square or 1D
            val = int(parts[0])
            return (val, 1)  # Default to 1D
    except (ValueError, AttributeError):
        pass
    return None


def find_best_match(candidate_start: int, ground_truth_addresses: Dict[str, Dict], 
                   max_distance: int = 256) -> Optional[Tuple[str, int]]:
    """
    Find the closest ground truth address to a candidate start address.
    
    Returns (address_hex, distance) if within max_distance, else None.
    """
    best_match = None
    best_distance = max_distance + 1
    
    for addr_hex, info in ground_truth_addresses.items():
        gt_addr = hex_to_int(addr_hex)
        distance = abs(candidate_start - gt_addr)
        
        if distance < best_distance:
            best_distance = distance
            best_match = (addr_hex, distance)
    
    if best_match and best_match[1] <= max_distance:
        return best_match
    return None


def compare_dimensions(detected: Tuple[int, int], expected: Optional[Tuple[int, int]]) -> bool:
    """Check if detected dimensions match expected dimensions."""
    if expected is None:
        return None  # Can't compare if expected is unknown
    return detected == expected


def main():
    # Load results
    print("Loading results.json...")
    with open('results.json', 'r') as f:
        results = json.load(f)
    
    # Load ground truth addresses
    print("Loading addresses.json...")
    with open('data/addresses.json', 'r') as f:
        ground_truth = json.load(f)
    
    candidates = results.get('candidates', [])
    print(f"\nFound {len(candidates)} detected candidates")
    print(f"Found {len(ground_truth)} ground truth addresses\n")
    
    # Statistics
    matches = []  # (candidate, gt_addr, distance, dim_match)
    false_positives = []  # Candidates not matching any GT
    matched_gt_addresses = set()  # Track which GT addresses were matched
    
    # Match candidates to ground truth
    print("Matching candidates to ground truth addresses...")
    print("=" * 80)
    
    for candidate in candidates:
        candidate_start = candidate['start']
        candidate_start_hex = candidate['start_hex']
        candidate_dims = (candidate['width'], candidate['height'])
        
        # Find best match
        match = find_best_match(candidate_start, ground_truth, max_distance=256)
        
        if match:
            gt_addr_hex, distance = match
            gt_info = ground_truth[gt_addr_hex]
            expected_dims = parse_dimensions(gt_info.get('dimensions'))
            dim_match = compare_dimensions(candidate_dims, expected_dims)
            
            matches.append({
                'candidate_id': candidate['id'],
                'candidate_start_hex': candidate_start_hex,
                'candidate_start': candidate_start,
                'gt_address_hex': gt_addr_hex,
                'gt_address': hex_to_int(gt_addr_hex),
                'distance': distance,
                'description': gt_info.get('description', 'Unknown'),
                'detected_dims': candidate_dims,
                'expected_dims': expected_dims,
                'dim_match': dim_match,
                'score': candidate['score']
            })
            matched_gt_addresses.add(gt_addr_hex)
        else:
            false_positives.append({
                'candidate_id': candidate['id'],
                'start_hex': candidate_start_hex,
                'start': candidate_start,
                'dims': candidate_dims,
                'score': candidate['score']
            })
    
    # Find false negatives (GT addresses not detected)
    false_negatives = []
    for gt_addr_hex, gt_info in ground_truth.items():
        if gt_addr_hex not in matched_gt_addresses:
            false_negatives.append({
                'address_hex': gt_addr_hex,
                'address': hex_to_int(gt_addr_hex),
                'description': gt_info.get('description', 'Unknown'),
                'dimensions': gt_info.get('dimensions')
            })
    
    # Calculate statistics
    num_matches = len(matches)
    num_false_positives = len(false_positives)
    num_false_negatives = len(false_negatives)
    num_gt = len(ground_truth)
    
    precision = num_matches / len(candidates) if candidates else 0
    recall = num_matches / num_gt if num_gt > 0 else 0
    f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
    
    # Print summary
    print("\n" + "=" * 80)
    print("EVALUATION SUMMARY")
    print("=" * 80)
    print(f"Total candidates detected:     {len(candidates)}")
    print(f"Ground truth addresses:        {num_gt}")
    print(f"\nTrue Positives (matches):      {num_matches}")
    print(f"False Positives (bad detections): {num_false_positives}")
    print(f"False Negatives (missed):      {num_false_negatives}")
    print(f"\nPrecision:                    {precision:.2%}")
    print(f"Recall:                       {recall:.2%}")
    print(f"F1 Score:                     {f1_score:.2%}")
    
    # Distance statistics
    if matches:
        distances = [m['distance'] for m in matches]
        avg_distance = sum(distances) / len(distances)
        max_distance = max(distances)
        min_distance = min(distances)
        
        print(f"\nMatch Distance Statistics:")
        print(f"  Average distance:          {avg_distance:.2f} bytes")
        print(f"  Minimum distance:          {min_distance} bytes")
        print(f"  Maximum distance:          {max_distance} bytes")
        
        # Distance distribution
        exact_matches = sum(1 for d in distances if d == 0)
        within_10 = sum(1 for d in distances if d <= 10)
        within_50 = sum(1 for d in distances if d <= 50)
        within_100 = sum(1 for d in distances if d <= 100)
        
        print(f"\nDistance Distribution:")
        print(f"  Exact matches (0 bytes):   {exact_matches} ({exact_matches/len(matches):.1%})")
        print(f"  Within 10 bytes:           {within_10} ({within_10/len(matches):.1%})")
        print(f"  Within 50 bytes:           {within_50} ({within_50/len(matches):.1%})")
        print(f"  Within 100 bytes:          {within_100} ({within_100/len(matches):.1%})")
    
    # Dimension accuracy
    if matches:
        dim_comparable = [m for m in matches if m['dim_match'] is not None]
        if dim_comparable:
            dim_correct = sum(1 for m in dim_comparable if m['dim_match'] is True)
            dim_accuracy = dim_correct / len(dim_comparable)
            print(f"\nDimension Accuracy:")
            print(f"  Comparable matches:       {len(dim_comparable)}")
            print(f"  Correct dimensions:       {dim_correct} ({dim_accuracy:.1%})")
    
    # Print matches
    print("\n" + "=" * 80)
    print("MATCHES (True Positives)")
    print("=" * 80)
    if matches:
        # Sort by distance
        matches_sorted = sorted(matches, key=lambda x: x['distance'])
        for i, match in enumerate(matches_sorted[:20], 1):  # Show top 20
            dim_info = ""
            if match['expected_dims']:
                dim_match_str = "[OK]" if match['dim_match'] else "[X]"
                dim_info = f" | Dims: {match['detected_dims']} vs {match['expected_dims']} {dim_match_str}"
            print(f"{i:2d}. ID {match['candidate_id']:5d} | "
                  f"Detected: {match['candidate_start_hex']:>8s} | "
                  f"GT: {match['gt_address_hex']:>6s} | "
                  f"Distance: {match['distance']:3d} bytes | "
                  f"Score: {match['score']:.3f}{dim_info}")
            print(f"    Description: {match['description']}")
        if len(matches) > 20:
            print(f"\n... and {len(matches) - 20} more matches")
    else:
        print("No matches found!")
    
    # Print false positives
    print("\n" + "=" * 80)
    print("FALSE POSITIVES (Bad Detections)")
    print("=" * 80)
    if false_positives:
        # Sort by score (descending)
        false_positives_sorted = sorted(false_positives, key=lambda x: x['score'], reverse=True)
        print(f"Showing top 20 false positives (by score):")
        for i, fp in enumerate(false_positives_sorted[:20], 1):
            print(f"{i:2d}. ID {fp['candidate_id']:5d} | "
                  f"Address: {fp['start_hex']:>8s} | "
                  f"Dims: {fp['dims']} | "
                  f"Score: {fp['score']:.3f}")
        if len(false_positives) > 20:
            print(f"\n... and {len(false_positives) - 20} more false positives")
    else:
        print("No false positives! (Perfect precision!)")
    
    # Print false negatives
    print("\n" + "=" * 80)
    print("FALSE NEGATIVES (Missed Addresses)")
    print("=" * 80)
    if false_negatives:
        for i, fn in enumerate(false_negatives, 1):
            dims_str = f" | Dims: {fn['dimensions']}" if fn['dimensions'] else ""
            print(f"{i:2d}. Address: {fn['address_hex']:>6s} (0x{fn['address']:x}){dims_str}")
            print(f"    Description: {fn['description']}")
    else:
        print("No false negatives! All ground truth addresses were detected! (Perfect recall!)")
    
    # Save detailed results to JSON
    output = {
        'summary': {
            'total_candidates': len(candidates),
            'total_ground_truth': num_gt,
            'true_positives': num_matches,
            'false_positives': num_false_positives,
            'false_negatives': num_false_negatives,
            'precision': precision,
            'recall': recall,
            'f1_score': f1_score
        },
        'matches': matches,
        'false_positives': false_positives,
        'false_negatives': false_negatives
    }
    
    if matches:
        distances = [m['distance'] for m in matches]
        output['summary']['distance_stats'] = {
            'average': sum(distances) / len(distances),
            'min': min(distances),
            'max': max(distances)
        }
    
    output_file = 'evaluation_results.json'
    with open(output_file, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"\n" + "=" * 80)
    print(f"Detailed results saved to: {output_file}")
    print("=" * 80)


if __name__ == '__main__':
    main()

