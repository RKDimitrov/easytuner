"""
Checksum service for ECU firmware files.

This service handles checksum calculation and validation for ECU binary files.
Different ECU manufacturers use different checksum algorithms, so this service
is designed to be extensible.
"""

import logging
import struct
from typing import Optional, Tuple
from enum import Enum

logger = logging.getLogger(__name__)


class ChecksumAlgorithm(str, Enum):
    """Supported checksum algorithms."""
    
    SIMPLE_SUM = "simple_sum"  # Sum of all bytes
    CRC16 = "crc16"  # CRC-16
    CRC32 = "crc32"  # CRC-32
    XOR = "xor"  # XOR of all bytes
    TWOS_COMPLEMENT = "twos_complement"  # Two's complement sum
    MODULAR = "modular"  # Sum modulo 0xFFFF or 0x10000


class ChecksumConfig:
    """Configuration for checksum calculation."""
    
    def __init__(
        self,
        algorithm: ChecksumAlgorithm,
        checksum_range: Tuple[int, int],  # (start, end) bytes to include
        checksum_location: int,  # Where checksum is stored
        checksum_size: int = 2,  # Size of checksum in bytes (usually 2 or 4)
        endianness: str = "little",  # How checksum is stored
        exclude_ranges: Optional[list[Tuple[int, int]]] = None,  # Ranges to exclude
        modulo: Optional[int] = None,  # For modular checksum
    ):
        self.algorithm = algorithm
        self.checksum_range = checksum_range
        self.checksum_location = checksum_location
        self.checksum_size = checksum_size
        self.endianness = endianness
        self.exclude_ranges = exclude_ranges or []
        self.modulo = modulo


class ChecksumService:
    """
    Service for calculating and validating checksums in ECU firmware files.
    
    This is a placeholder implementation. Real checksum algorithms need to be
    implemented based on ECU-specific requirements.
    """
    
    def __init__(self):
        """Initialize the checksum service."""
        # CRC-16-CCITT polynomial: x^16 + x^12 + x^5 + 1 (0x1021)
        self.crc16_table = self._generate_crc16_table()
        
        # CRC-32 polynomial: x^32 + x^26 + x^23 + x^22 + x^16 + x^12 + x^11 + x^10 + x^8 + x^7 + x^5 + x^4 + x^2 + x + 1 (0xEDB88320)
        self.crc32_table = self._generate_crc32_table()
    
    def _generate_crc16_table(self) -> list[int]:
        """Generate CRC-16 lookup table (CCITT polynomial)."""
        table = []
        polynomial = 0x1021  # CRC-16-CCITT
        
        for i in range(256):
            crc = i << 8
            for _ in range(8):
                if crc & 0x8000:
                    crc = (crc << 1) ^ polynomial
                else:
                    crc = crc << 1
                crc = crc & 0xFFFF
            table.append(crc)
        
        return table
    
    def _generate_crc32_table(self) -> list[int]:
        """Generate CRC-32 lookup table (IEEE 802.3 polynomial)."""
        table = []
        polynomial = 0xEDB88320
        
        for i in range(256):
            crc = i
            for _ in range(8):
                if crc & 1:
                    crc = (crc >> 1) ^ polynomial
                else:
                    crc = crc >> 1
            table.append(crc & 0xFFFFFFFF)
        
        return table
    
    def _calculate_crc16(self, data: bytearray) -> int:
        """
        Calculate CRC-16-CCITT checksum.
        
        Args:
            data: Data to checksum
            
        Returns:
            CRC-16 value
        """
        crc = 0xFFFF  # Initial value
        
        for byte in data:
            index = ((crc >> 8) ^ byte) & 0xFF
            crc = ((crc << 8) ^ self.crc16_table[index]) & 0xFFFF
        
        return crc
    
    def _calculate_crc32(self, data: bytearray) -> int:
        """
        Calculate CRC-32 checksum (IEEE 802.3).
        
        Args:
            data: Data to checksum
            
        Returns:
            CRC-32 value
        """
        crc = 0xFFFFFFFF  # Initial value
        
        for byte in data:
            index = (crc ^ byte) & 0xFF
            crc = (crc >> 8) ^ self.crc32_table[index]
        
        # Final XOR
        crc = crc ^ 0xFFFFFFFF
        
        return crc & 0xFFFFFFFF
    
    def calculate_checksum(
        self,
        file_data: bytes,
        config: ChecksumConfig
    ) -> int:
        """
        Calculate checksum for a file region.
        
        Args:
            file_data: File data
            config: Checksum configuration
            
        Returns:
            Calculated checksum value
            
        Raises:
            NotImplementedError: If algorithm is not yet implemented
            ValueError: If configuration is invalid
        """
        # Validate configuration
        start, end = config.checksum_range
        if start < 0 or end > len(file_data) or start >= end:
            raise ValueError(f"Invalid checksum range: {start}-{end}")
        
        if config.checksum_location < 0 or config.checksum_location + config.checksum_size > len(file_data):
            raise ValueError(f"Invalid checksum location: {config.checksum_location}")
        
        # Extract data to checksum (excluding checksum location and excluded ranges)
        data_to_checksum = bytearray()
        for i in range(start, end):
            # Skip checksum location
            if i >= config.checksum_location and i < config.checksum_location + config.checksum_size:
                continue
            
            # Skip excluded ranges
            skip = False
            for excl_start, excl_end in config.exclude_ranges:
                if i >= excl_start and i < excl_end:
                    skip = True
                    break
            
            if not skip:
                data_to_checksum.append(file_data[i])
        
        # Calculate checksum based on algorithm
        if config.algorithm == ChecksumAlgorithm.SIMPLE_SUM:
            return sum(data_to_checksum) & 0xFFFFFFFF
        
        elif config.algorithm == ChecksumAlgorithm.XOR:
            result = 0
            for byte in data_to_checksum:
                result ^= byte
            return result & 0xFFFFFFFF
        
        elif config.algorithm == ChecksumAlgorithm.TWOS_COMPLEMENT:
            total = sum(data_to_checksum)
            # Two's complement: negate and mask
            return (~total + 1) & 0xFFFFFFFF
        
        elif config.algorithm == ChecksumAlgorithm.MODULAR:
            total = sum(data_to_checksum)
            modulo = config.modulo or 0xFFFF
            return total % modulo
        
        elif config.algorithm == ChecksumAlgorithm.CRC16:
            return self._calculate_crc16(data_to_checksum)
        
        elif config.algorithm == ChecksumAlgorithm.CRC32:
            return self._calculate_crc32(data_to_checksum)
        
        else:
            raise ValueError(f"Unknown checksum algorithm: {config.algorithm}")
    
    def update_checksum(
        self,
        file_data: bytearray,
        config: ChecksumConfig
    ) -> bytearray:
        """
        Update checksum in file data.
        
        Args:
            file_data: File data to modify (will be modified in-place)
            config: Checksum configuration
            
        Returns:
            Modified file data
        """
        # Calculate new checksum
        checksum_value = self.calculate_checksum(file_data, config)
        
        # Write checksum to file
        checksum_bytes = checksum_value.to_bytes(
            config.checksum_size,
            byteorder=config.endianness,
            signed=False
        )
        
        file_data[config.checksum_location:config.checksum_location + config.checksum_size] = checksum_bytes
        
        logger.info(
            f"Updated checksum at offset {config.checksum_location}: "
            f"0x{checksum_value:X} ({checksum_value})"
        )
        
        return file_data
    
    def validate_checksum(
        self,
        file_data: bytes,
        config: ChecksumConfig
    ) -> Tuple[bool, Optional[int], Optional[int]]:
        """
        Validate checksum in file.
        
        Args:
            file_data: File data to validate
            config: Checksum configuration
            
        Returns:
            Tuple of (is_valid, stored_checksum, calculated_checksum)
        """
        # Read stored checksum
        stored_bytes = file_data[
            config.checksum_location:config.checksum_location + config.checksum_size
        ]
        stored_checksum = int.from_bytes(
            stored_bytes,
            byteorder=config.endianness,
            signed=False
        )
        
        # Calculate expected checksum
        calculated_checksum = self.calculate_checksum(file_data, config)
        
        # Compare
        is_valid = stored_checksum == calculated_checksum
        
        if not is_valid:
            logger.warning(
                f"Checksum mismatch at {config.checksum_location}: "
                f"stored=0x{stored_checksum:X}, calculated=0x{calculated_checksum:X}"
            )
        
        return is_valid, stored_checksum, calculated_checksum


# Singleton instance
checksum_service = ChecksumService()

