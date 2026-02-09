"""
Unit tests for checksum service.

Tests verify that checksum calculation, validation, and update work correctly
for all supported algorithms and edge cases.
"""

import pytest
from app.services.checksum_service import (
    ChecksumService,
    ChecksumConfig,
    ChecksumAlgorithm,
)


class TestChecksumService:
    """Test suite for ChecksumService."""
    
    @pytest.fixture
    def service(self):
        """Create a checksum service instance."""
        return ChecksumService()
    
    @pytest.fixture
    def sample_data(self):
        """Create sample binary data for testing."""
        # Create 100 bytes of test data: 0x00, 0x01, 0x02, ..., 0x63
        return bytes(range(100))
    
    def test_simple_sum_checksum(self, service, sample_data):
        """Test simple sum checksum calculation."""
        config = ChecksumConfig(
            algorithm=ChecksumAlgorithm.SIMPLE_SUM,
            checksum_range=(0, 98),  # Exclude last 2 bytes for checksum
            checksum_location=98,
            checksum_size=2,
            endianness="little"
        )
        
        # Calculate checksum
        checksum = service.calculate_checksum(sample_data, config)
        
        # Expected: sum of bytes 0-97 = 0+1+2+...+97 = 97*98/2 = 4753
        expected_sum = sum(range(98))
        assert checksum == expected_sum
        
        # Verify it's masked to 32 bits
        assert checksum == (expected_sum & 0xFFFFFFFF)
    
    def test_simple_sum_update_and_validate(self, service, sample_data):
        """Test updating and validating simple sum checksum."""
        # Create mutable copy
        file_data = bytearray(sample_data)
        
        config = ChecksumConfig(
            algorithm=ChecksumAlgorithm.SIMPLE_SUM,
            checksum_range=(0, 98),
            checksum_location=98,
            checksum_size=2,
            endianness="little"
        )
        
        # Update checksum
        service.update_checksum(file_data, config)
        
        # Validate checksum
        is_valid, stored, calculated = service.validate_checksum(bytes(file_data), config)
        
        assert is_valid, f"Checksum validation failed: stored={stored}, calculated={calculated}"
        assert stored == calculated
    
    def test_simple_sum_after_modification(self, service, sample_data):
        """Test that checksum updates correctly after file modification."""
        # Create mutable copy
        file_data = bytearray(sample_data)
        
        config = ChecksumConfig(
            algorithm=ChecksumAlgorithm.SIMPLE_SUM,
            checksum_range=(0, 98),
            checksum_location=98,
            checksum_size=2,
            endianness="little"
        )
        
        # Initial checksum
        service.update_checksum(file_data, config)
        is_valid1, _, _ = service.validate_checksum(bytes(file_data), config)
        assert is_valid1, "Initial checksum should be valid"
        
        # Modify data at offset 50
        file_data[50] = 0xFF
        # Checksum should now be invalid
        is_valid2, stored2, calculated2 = service.validate_checksum(bytes(file_data), config)
        assert not is_valid2, "Checksum should be invalid after modification"
        
        # Update checksum again
        service.update_checksum(file_data, config)
        is_valid3, stored3, calculated3 = service.validate_checksum(bytes(file_data), config)
        assert is_valid3, "Checksum should be valid after update"
        assert stored3 == calculated3
        
        # Verify the checksum value changed
        assert stored2 != stored3, "Checksum value should have changed"
    
    def test_xor_checksum(self, service, sample_data):
        """Test XOR checksum calculation."""
        config = ChecksumConfig(
            algorithm=ChecksumAlgorithm.XOR,
            checksum_range=(0, 98),
            checksum_location=98,
            checksum_size=2,
            endianness="little"
        )
        
        checksum = service.calculate_checksum(sample_data, config)
        
        # Expected: XOR of bytes 0-97
        expected_xor = 0
        for i in range(98):
            expected_xor ^= sample_data[i]
        
        assert checksum == (expected_xor & 0xFFFFFFFF)
    
    def test_xor_update_and_validate(self, service, sample_data):
        """Test XOR checksum update and validation."""
        file_data = bytearray(sample_data)
        
        config = ChecksumConfig(
            algorithm=ChecksumAlgorithm.XOR,
            checksum_range=(0, 98),
            checksum_location=98,
            checksum_size=2,
            endianness="little"
        )
        
        service.update_checksum(file_data, config)
        is_valid, stored, calculated = service.validate_checksum(bytes(file_data), config)
        
        assert is_valid
        assert stored == calculated
    
    def test_twos_complement_checksum(self, service, sample_data):
        """Test two's complement checksum calculation."""
        config = ChecksumConfig(
            algorithm=ChecksumAlgorithm.TWOS_COMPLEMENT,
            checksum_range=(0, 98),
            checksum_location=98,
            checksum_size=2,
            endianness="little"
        )
        
        checksum = service.calculate_checksum(sample_data, config)
        
        # Expected: two's complement of sum
        total = sum(range(98))
        expected = (~total + 1) & 0xFFFFFFFF
        
        assert checksum == expected
    
    def test_twos_complement_update_and_validate(self, service, sample_data):
        """Test two's complement checksum update and validation."""
        file_data = bytearray(sample_data)
        
        config = ChecksumConfig(
            algorithm=ChecksumAlgorithm.TWOS_COMPLEMENT,
            checksum_range=(0, 98),
            checksum_location=98,
            checksum_size=2,
            endianness="little"
        )
        
        service.update_checksum(file_data, config)
        is_valid, stored, calculated = service.validate_checksum(bytes(file_data), config)
        
        assert is_valid
        assert stored == calculated
    
    def test_modular_checksum(self, service, sample_data):
        """Test modular checksum calculation."""
        config = ChecksumConfig(
            algorithm=ChecksumAlgorithm.MODULAR,
            checksum_range=(0, 98),
            checksum_location=98,
            checksum_size=2,
            endianness="little",
            modulo=0xFFFF
        )
        
        checksum = service.calculate_checksum(sample_data, config)
        
        # Expected: sum modulo 0xFFFF
        total = sum(range(98))
        expected = total % 0xFFFF
        
        assert checksum == expected
    
    def test_modular_update_and_validate(self, service, sample_data):
        """Test modular checksum update and validation."""
        file_data = bytearray(sample_data)
        
        config = ChecksumConfig(
            algorithm=ChecksumAlgorithm.MODULAR,
            checksum_range=(0, 98),
            checksum_location=98,
            checksum_size=2,
            endianness="little",
            modulo=0xFFFF
        )
        
        service.update_checksum(file_data, config)
        is_valid, stored, calculated = service.validate_checksum(bytes(file_data), config)
        
        assert is_valid
        assert stored == calculated

    def test_ones_complement_checksum(self, service, sample_data):
        """Test ones' complement checksum (0xFFFF - (sum & 0xFFFF)), common in Bosch EDC15/EDC16."""
        config = ChecksumConfig(
            algorithm=ChecksumAlgorithm.ONES_COMPLEMENT,
            checksum_range=(0, 98),
            checksum_location=98,
            checksum_size=2,
            endianness="little",
        )
        checksum = service.calculate_checksum(sample_data, config)
        total = sum(range(98))
        expected = (0xFFFF - (total & 0xFFFF)) & 0xFFFF
        assert checksum == expected

    def test_ones_complement_update_and_validate(self, service, sample_data):
        """Test ones' complement checksum update and validation."""
        file_data = bytearray(sample_data)
        config = ChecksumConfig(
            algorithm=ChecksumAlgorithm.ONES_COMPLEMENT,
            checksum_range=(0, 98),
            checksum_location=98,
            checksum_size=2,
            endianness="little",
        )
        service.update_checksum(file_data, config)
        is_valid, stored, calculated = service.validate_checksum(bytes(file_data), config)
        assert is_valid
        assert stored == calculated

    def test_modular_16bit_checksum(self, service, sample_data):
        """Test 16-bit word sum then modulo (EDC15-style)."""
        config = ChecksumConfig(
            algorithm=ChecksumAlgorithm.MODULAR_16BIT,
            checksum_range=(0, 98),
            checksum_location=98,
            checksum_size=2,
            endianness="little",
            modulo=0x10000,
        )
        checksum = service.calculate_checksum(sample_data, config)
        assert 0 <= checksum <= 0xFFFF

    def test_modular_16bit_update_and_validate(self, service, sample_data):
        """Test modular 16-bit update and validation."""
        file_data = bytearray(sample_data)
        config = ChecksumConfig(
            algorithm=ChecksumAlgorithm.MODULAR_16BIT,
            checksum_range=(0, 98),
            checksum_location=98,
            checksum_size=2,
            endianness="little",
            modulo=0x10000,
        )
        service.update_checksum(file_data, config)
        is_valid, stored, calculated = service.validate_checksum(bytes(file_data), config)
        assert is_valid
        assert stored == calculated

    def test_ones_complement_16bit_update_and_validate(self, service, sample_data):
        """Test ones' complement 16-bit word sum update and validation."""
        file_data = bytearray(sample_data)
        config = ChecksumConfig(
            algorithm=ChecksumAlgorithm.ONES_COMPLEMENT_16BIT,
            checksum_range=(0, 98),
            checksum_location=98,
            checksum_size=2,
            endianness="little",
        )
        service.update_checksum(file_data, config)
        is_valid, stored, calculated = service.validate_checksum(bytes(file_data), config)
        assert is_valid
        assert stored == calculated

    def test_crc16_checksum(self, service, sample_data):
        """Test CRC-16 checksum calculation."""
        config = ChecksumConfig(
            algorithm=ChecksumAlgorithm.CRC16,
            checksum_range=(0, 98),
            checksum_location=98,
            checksum_size=2,
            endianness="little"
        )
        
        checksum = service.calculate_checksum(sample_data, config)
        
        # Verify it's a 16-bit value
        assert 0 <= checksum <= 0xFFFF
        
        # Verify it's not zero for non-zero data
        assert checksum != 0
    
    def test_crc16_update_and_validate(self, service, sample_data):
        """Test CRC-16 checksum update and validation."""
        file_data = bytearray(sample_data)
        
        config = ChecksumConfig(
            algorithm=ChecksumAlgorithm.CRC16,
            checksum_range=(0, 98),
            checksum_location=98,
            checksum_size=2,
            endianness="little"
        )
        
        service.update_checksum(file_data, config)
        is_valid, stored, calculated = service.validate_checksum(bytes(file_data), config)
        
        assert is_valid
        assert stored == calculated
    
    def test_crc32_checksum(self, service, sample_data):
        """Test CRC-32 checksum calculation."""
        config = ChecksumConfig(
            algorithm=ChecksumAlgorithm.CRC32,
            checksum_range=(0, 96),  # Need space for 4-byte checksum
            checksum_location=96,
            checksum_size=4,
            endianness="little"
        )
        
        checksum = service.calculate_checksum(sample_data, config)
        
        # Verify it's a 32-bit value
        assert 0 <= checksum <= 0xFFFFFFFF
    
    def test_crc32_update_and_validate(self, service, sample_data):
        """Test CRC-32 checksum update and validation."""
        file_data = bytearray(sample_data)
        
        config = ChecksumConfig(
            algorithm=ChecksumAlgorithm.CRC32,
            checksum_range=(0, 96),
            checksum_location=96,
            checksum_size=4,
            endianness="little"
        )
        
        service.update_checksum(file_data, config)
        is_valid, stored, calculated = service.validate_checksum(bytes(file_data), config)
        
        assert is_valid
        assert stored == calculated
    
    def test_checksum_excludes_checksum_location(self, service):
        """Test that checksum calculation excludes the checksum location itself."""
        # Create data where checksum location is in the middle
        data = bytes([0x01, 0x02, 0x03, 0x00, 0x00, 0x04, 0x05, 0x06])
        
        config = ChecksumConfig(
            algorithm=ChecksumAlgorithm.SIMPLE_SUM,
            checksum_range=(0, 8),  # Entire range
            checksum_location=3,     # Checksum at offset 3-4 (2 bytes)
            checksum_size=2,
            endianness="little"
        )
        
        # Calculate checksum (should exclude bytes at 3-4)
        checksum = service.calculate_checksum(data, config)
        
        # Expected: sum of bytes at 0,1,2,5,6,7 (excluding 3,4)
        expected = 0x01 + 0x02 + 0x03 + 0x04 + 0x05 + 0x06
        assert checksum == expected
        
        # Update checksum
        file_data = bytearray(data)
        service.update_checksum(file_data, config)
        
        # Validate - should be valid
        is_valid, stored, calculated = service.validate_checksum(bytes(file_data), config)
        assert is_valid
        assert stored == calculated
    
    def test_exclude_ranges(self, service, sample_data):
        """Test that exclude_ranges work correctly."""
        config = ChecksumConfig(
            algorithm=ChecksumAlgorithm.SIMPLE_SUM,
            checksum_range=(0, 98),
            checksum_location=98,
            checksum_size=2,
            endianness="little",
            exclude_ranges=[(10, 20), (50, 60)]  # Exclude these ranges
        )
        
        checksum = service.calculate_checksum(sample_data, config)
        
        # Expected: sum excluding bytes 10-19 and 50-59 and 98-99
        expected = 0
        for i in range(98):
            # Skip checksum location
            if i >= 98:
                continue
            # Skip excluded ranges
            if 10 <= i < 20 or 50 <= i < 60:
                continue
            expected += sample_data[i]
        
        assert checksum == expected
    
    def test_big_endian_checksum(self, service, sample_data):
        """Test that big endian checksum storage works correctly."""
        file_data = bytearray(sample_data)
        
        config = ChecksumConfig(
            algorithm=ChecksumAlgorithm.SIMPLE_SUM,
            checksum_range=(0, 98),
            checksum_location=98,
            checksum_size=2,
            endianness="big"  # Big endian
        )
        
        # Update checksum
        service.update_checksum(file_data, config)
        
        # Read checksum bytes
        checksum_bytes = file_data[98:100]
        
        # Verify big endian encoding
        stored_value = int.from_bytes(checksum_bytes, byteorder='big', signed=False)
        calculated_value = service.calculate_checksum(bytes(file_data), config)
        
        # Note: stored_value includes the old checksum in calculation, so recalculate
        # with zeroed checksum location for comparison
        temp_data = bytearray(file_data)
        temp_data[98:100] = b'\x00\x00'
        calculated_expected = service.calculate_checksum(bytes(temp_data), config)
        
        assert stored_value == calculated_expected
        
        # Validate should work
        is_valid, stored, calculated = service.validate_checksum(bytes(file_data), config)
        assert is_valid
    
    def test_checksum_size_4_bytes(self, service):
        """Test 4-byte checksum."""
        data = bytes(range(100))
        file_data = bytearray(data)
        
        config = ChecksumConfig(
            algorithm=ChecksumAlgorithm.SIMPLE_SUM,
            checksum_range=(0, 96),
            checksum_location=96,
            checksum_size=4,  # 4 bytes
            endianness="little"
        )
        
        service.update_checksum(file_data, config)
        is_valid, stored, calculated = service.validate_checksum(bytes(file_data), config)
        
        assert is_valid
        assert stored == calculated
    
    def test_invalid_range(self, service, sample_data):
        """Test that invalid ranges raise ValueError."""
        config = ChecksumConfig(
            algorithm=ChecksumAlgorithm.SIMPLE_SUM,
            checksum_range=(100, 200),  # Out of bounds
            checksum_location=98,
            checksum_size=2,
            endianness="little"
        )
        
        with pytest.raises(ValueError):
            service.calculate_checksum(sample_data, config)
    
    def test_invalid_checksum_location(self, service, sample_data):
        """Test that invalid checksum location raises ValueError."""
        config = ChecksumConfig(
            algorithm=ChecksumAlgorithm.SIMPLE_SUM,
            checksum_range=(0, 98),
            checksum_location=99,  # Out of bounds for 2-byte checksum
            checksum_size=2,
            endianness="little"
        )
        
        with pytest.raises(ValueError):
            service.calculate_checksum(sample_data, config)
    
    def test_checksum_location_in_range(self, service, sample_data):
        """Test that checksum location can be anywhere, even inside range."""
        # This is a valid scenario - checksum location is excluded from calculation
        file_data = bytearray(sample_data)
        
        config = ChecksumConfig(
            algorithm=ChecksumAlgorithm.SIMPLE_SUM,
            checksum_range=(0, 100),  # Full range
            checksum_location=50,      # Checksum in the middle
            checksum_size=2,
            endianness="little"
        )
        
        service.update_checksum(file_data, config)
        is_valid, stored, calculated = service.validate_checksum(bytes(file_data), config)
        
        assert is_valid
        assert stored == calculated
