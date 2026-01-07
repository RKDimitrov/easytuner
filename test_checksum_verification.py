#!/usr/bin/env python3
"""
Standalone script to verify checksum service implementation.
Tests the checksum functionality without requiring pytest.
"""

import sys
import os

# Add server directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'server'))

from app.services.checksum_service import (
    ChecksumService,
    ChecksumConfig,
    ChecksumAlgorithm,
)


def test_simple_sum_basic():
    """Test basic simple sum checksum."""
    print("Testing simple sum checksum...")
    service = ChecksumService()
    
    # Create test data: 10 bytes
    data = bytes([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x00, 0x00])
    file_data = bytearray(data)
    
    config = ChecksumConfig(
        algorithm=ChecksumAlgorithm.SIMPLE_SUM,
        checksum_range=(0, 9),  # Bytes 0-8 (exclude last 2 for checksum)
        checksum_location=9,
        checksum_size=2,
        endianness="little"
    )
    
    # Calculate expected checksum: sum of bytes 0-8
    expected_sum = sum(range(1, 10))  # 1+2+...+9 = 45
    calculated = service.calculate_checksum(data, config)
    
    print(f"  Expected sum: {expected_sum}, Calculated: {calculated}")
    assert calculated == expected_sum, f"Expected {expected_sum}, got {calculated}"
    
    # Update checksum
    service.update_checksum(file_data, config)
    
    # Read checksum bytes (little endian)
    checksum_bytes = file_data[9:11]
    stored_value = int.from_bytes(checksum_bytes, byteorder='little', signed=False)
    
    print(f"  Stored checksum: {stored_value} (bytes: {checksum_bytes.hex()})")
    assert stored_value == expected_sum, f"Stored {stored_value}, expected {expected_sum}"
    
    # Validate checksum
    is_valid, stored, calculated = service.validate_checksum(bytes(file_data), config)
    print(f"  Validation: valid={is_valid}, stored={stored}, calculated={calculated}")
    assert is_valid, "Checksum validation should pass after update"
    assert stored == calculated, "Stored and calculated should match"
    
    print("  ✓ Simple sum test passed!\n")


def test_checksum_after_modification():
    """Test that checksum updates correctly after file modification."""
    print("Testing checksum update after modification...")
    service = ChecksumService()
    
    data = bytes([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x00, 0x00])
    file_data = bytearray(data)
    
    config = ChecksumConfig(
        algorithm=ChecksumAlgorithm.SIMPLE_SUM,
        checksum_range=(0, 9),
        checksum_location=9,
        checksum_size=2,
        endianness="little"
    )
    
    # Initial checksum
    service.update_checksum(file_data, config)
    is_valid1, stored1, _ = service.validate_checksum(bytes(file_data), config)
    print(f"  Initial: valid={is_valid1}, checksum={stored1}")
    assert is_valid1, "Initial checksum should be valid"
    
    # Modify data at offset 5
    file_data[5] = 0xFF
    print(f"  Modified byte at offset 5 to 0xFF")
    
    # Checksum should now be invalid
    is_valid2, stored2, calculated2 = service.validate_checksum(bytes(file_data), config)
    print(f"  After modification: valid={is_valid2}, stored={stored2}, calculated={calculated2}")
    assert not is_valid2, "Checksum should be invalid after modification"
    
    # Update checksum again
    service.update_checksum(file_data, config)
    is_valid3, stored3, calculated3 = service.validate_checksum(bytes(file_data), config)
    print(f"  After update: valid={is_valid3}, stored={stored3}, calculated={calculated3}")
    assert is_valid3, "Checksum should be valid after update"
    assert stored3 == calculated3, "Stored and calculated should match"
    assert stored3 != stored1, "Checksum value should have changed"
    
    print("  ✓ Modification test passed!\n")


def test_checksum_excludes_location():
    """Test that checksum calculation excludes the checksum location."""
    print("Testing checksum location exclusion...")
    service = ChecksumService()
    
    # Checksum in the middle of data
    data = bytes([0x01, 0x02, 0x03, 0x00, 0x00, 0x04, 0x05, 0x06])
    file_data = bytearray(data)
    
    config = ChecksumConfig(
        algorithm=ChecksumAlgorithm.SIMPLE_SUM,
        checksum_range=(0, 8),  # Entire range
        checksum_location=3,     # Checksum at offset 3-4
        checksum_size=2,
        endianness="little"
    )
    
    # Calculate checksum (should exclude bytes at 3-4)
    checksum = service.calculate_checksum(data, config)
    
    # Expected: sum of bytes at 0,1,2,5,6,7 (excluding 3,4)
    expected = 0x01 + 0x02 + 0x03 + 0x04 + 0x05 + 0x06
    print(f"  Expected (excluding offset 3-4): {expected}, Calculated: {checksum}")
    assert checksum == expected, f"Expected {expected}, got {checksum}"
    
    # Update checksum
    service.update_checksum(file_data, config)
    
    # Validate
    is_valid, stored, calculated = service.validate_checksum(bytes(file_data), config)
    print(f"  Validation: valid={is_valid}, stored={stored}, calculated={calculated}")
    assert is_valid, "Checksum should be valid"
    
    print("  ✓ Exclusion test passed!\n")


def test_xor_checksum():
    """Test XOR checksum."""
    print("Testing XOR checksum...")
    service = ChecksumService()
    
    data = bytes([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x00, 0x00])
    file_data = bytearray(data)
    
    config = ChecksumConfig(
        algorithm=ChecksumAlgorithm.XOR,
        checksum_range=(0, 9),
        checksum_location=9,
        checksum_size=2,
        endianness="little"
    )
    
    # Expected XOR of bytes 0-8
    expected_xor = 0x01 ^ 0x02 ^ 0x03 ^ 0x04 ^ 0x05 ^ 0x06 ^ 0x07 ^ 0x08 ^ 0x09
    calculated = service.calculate_checksum(data, config)
    
    print(f"  Expected XOR: {expected_xor}, Calculated: {calculated}")
    assert calculated == expected_xor, f"Expected {expected_xor}, got {calculated}"
    
    # Update and validate
    service.update_checksum(file_data, config)
    is_valid, stored, calculated = service.validate_checksum(bytes(file_data), config)
    print(f"  Validation: valid={is_valid}, stored={stored}, calculated={calculated}")
    assert is_valid, "XOR checksum should be valid"
    
    print("  ✓ XOR test passed!\n")


def test_twos_complement():
    """Test two's complement checksum."""
    print("Testing two's complement checksum...")
    service = ChecksumService()
    
    data = bytes([0x01, 0x02, 0x03, 0x04, 0x00, 0x00])
    file_data = bytearray(data)
    
    config = ChecksumConfig(
        algorithm=ChecksumAlgorithm.TWOS_COMPLEMENT,
        checksum_range=(0, 4),
        checksum_location=4,
        checksum_size=2,
        endianness="little"
    )
    
    # Sum of bytes 0-3 = 1+2+3+4 = 10
    # Two's complement of 10 = -(10) = -10
    # But as unsigned 16-bit: 65536 - 10 = 65526 (0xFFF6)
    total = 0x01 + 0x02 + 0x03 + 0x04
    calculated = service.calculate_checksum(data, config)
    
    # Two's complement: (~total + 1) & 0xFFFFFFFF
    expected = (~total + 1) & 0xFFFFFFFF
    
    print(f"  Sum: {total}, Two's complement: {expected}, Calculated: {calculated}")
    assert calculated == expected, f"Expected {expected}, got {calculated}"
    
    # Update and validate
    service.update_checksum(file_data, config)
    is_valid, stored, calculated = service.validate_checksum(bytes(file_data), config)
    print(f"  Validation: valid={is_valid}, stored={stored}, calculated={calculated}")
    assert is_valid, "Two's complement checksum should be valid"
    
    print("  ✓ Two's complement test passed!\n")


def test_crc16():
    """Test CRC-16 checksum."""
    print("Testing CRC-16 checksum...")
    service = ChecksumService()
    
    data = bytes([0x01, 0x02, 0x03, 0x04, 0x00, 0x00])
    file_data = bytearray(data)
    
    config = ChecksumConfig(
        algorithm=ChecksumAlgorithm.CRC16,
        checksum_range=(0, 4),
        checksum_location=4,
        checksum_size=2,
        endianness="little"
    )
    
    calculated = service.calculate_checksum(data, config)
    print(f"  Calculated CRC-16: {calculated} (0x{calculated:04X})")
    
    # Verify it's 16-bit
    assert 0 <= calculated <= 0xFFFF, f"CRC-16 should be 16-bit, got {calculated}"
    
    # Update and validate
    service.update_checksum(file_data, config)
    is_valid, stored, calculated = service.validate_checksum(bytes(file_data), config)
    print(f"  Validation: valid={is_valid}, stored={stored} (0x{stored:04X}), calculated={calculated} (0x{calculated:04X})")
    assert is_valid, "CRC-16 checksum should be valid"
    
    print("  ✓ CRC-16 test passed!\n")


def test_big_endian():
    """Test big endian checksum storage."""
    print("Testing big endian storage...")
    service = ChecksumService()
    
    data = bytes([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x00, 0x00])
    file_data = bytearray(data)
    
    config = ChecksumConfig(
        algorithm=ChecksumAlgorithm.SIMPLE_SUM,
        checksum_range=(0, 9),
        checksum_location=9,
        checksum_size=2,
        endianness="big"
    )
    
    expected_sum = sum(range(1, 10))
    service.update_checksum(file_data, config)
    
    # Read as big endian
    checksum_bytes = file_data[9:11]
    stored_value = int.from_bytes(checksum_bytes, byteorder='big', signed=False)
    
    print(f"  Expected: {expected_sum}, Stored (BE): {stored_value}, Bytes: {checksum_bytes.hex()}")
    assert stored_value == expected_sum, f"Expected {expected_sum}, got {stored_value}"
    
    # Validate
    is_valid, stored, calculated = service.validate_checksum(bytes(file_data), config)
    print(f"  Validation: valid={is_valid}, stored={stored}, calculated={calculated}")
    assert is_valid, "Big endian checksum should be valid"
    
    print("  ✓ Big endian test passed!\n")


def test_exclude_ranges():
    """Test exclude ranges."""
    print("Testing exclude ranges...")
    service = ChecksumService()
    
    data = bytes(range(20))  # 0-19
    file_data = bytearray(data)
    
    config = ChecksumConfig(
        algorithm=ChecksumAlgorithm.SIMPLE_SUM,
        checksum_range=(0, 18),
        checksum_location=18,
        checksum_size=2,
        endianness="little",
        exclude_ranges=[(5, 10), (12, 15)]  # Exclude 5-9 and 12-14
    )
    
    # Calculate expected: sum of 0-17 excluding 5-9, 12-14, and 18-19
    expected = 0
    for i in range(18):
        if 5 <= i < 10 or 12 <= i < 15:
            continue
        expected += i
    
    calculated = service.calculate_checksum(data, config)
    print(f"  Expected (with exclusions): {expected}, Calculated: {calculated}")
    assert calculated == expected, f"Expected {expected}, got {calculated}"
    
    # Update and validate
    service.update_checksum(file_data, config)
    is_valid, stored, calculated = service.validate_checksum(bytes(file_data), config)
    print(f"  Validation: valid={is_valid}, stored={stored}, calculated={calculated}")
    assert is_valid, "Checksum with exclude ranges should be valid"
    
    print("  ✓ Exclude ranges test passed!\n")


def main():
    """Run all tests."""
    print("=" * 60)
    print("Checksum Service Verification Tests")
    print("=" * 60)
    print()
    
    try:
        test_simple_sum_basic()
        test_checksum_after_modification()
        test_checksum_excludes_location()
        test_xor_checksum()
        test_twos_complement()
        test_crc16()
        test_big_endian()
        test_exclude_ranges()
        
        print("=" * 60)
        print("✓ ALL TESTS PASSED!")
        print("=" * 60)
        return 0
    except AssertionError as e:
        print(f"\n✗ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return 1
    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
