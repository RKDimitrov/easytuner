"""Pydantic schemas for checksum operations."""

from typing import List, Optional
from pydantic import BaseModel, Field


class ChecksumAlgorithm(str):
    """Checksum algorithm types."""
    SIMPLE_SUM = "simple_sum"
    CRC16 = "crc16"
    CRC32 = "crc32"
    XOR = "xor"
    TWOS_COMPLEMENT = "twos_complement"
    MODULAR = "modular"


class ChecksumRange(BaseModel):
    """Range for checksum calculation."""
    start: int = Field(..., ge=0, description="Start byte offset")
    end: int = Field(..., description="End byte offset (exclusive)")


class ExcludeRange(BaseModel):
    """Range to exclude from checksum calculation."""
    start: int = Field(..., ge=0, description="Start byte offset")
    end: int = Field(..., description="End byte offset (exclusive)")


class ChecksumConfigRequest(BaseModel):
    """Request to configure checksum calculation."""
    algorithm: str = Field(..., description="Checksum algorithm")
    checksum_range: ChecksumRange = Field(..., description="Range to include in checksum")
    checksum_location: int = Field(..., ge=0, description="Where checksum is stored")
    checksum_size: int = Field(default=2, ge=1, le=8, description="Size of checksum in bytes")
    endianness: str = Field(default="little", pattern="^(little|big)$", description="Endianness")
    exclude_ranges: Optional[List[ExcludeRange]] = Field(default=None, description="Ranges to exclude")
    modulo: Optional[int] = Field(default=None, ge=1, description="Modulo value for modular checksum")


class ChecksumValidationResponse(BaseModel):
    """Response from checksum validation."""
    is_valid: bool
    stored_checksum: int
    calculated_checksum: int
    stored_checksum_hex: str
    calculated_checksum_hex: str
    checksum_location: int


class ChecksumUpdateResponse(BaseModel):
    """Response from checksum update."""
    success: bool
    checksum_value: int
    checksum_value_hex: str
    checksum_location: int
    message: str

