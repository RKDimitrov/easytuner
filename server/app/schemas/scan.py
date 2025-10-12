"""
Schemas for scan operations.
"""
from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ScanCreate(BaseModel):
    """Request schema for creating a scan."""
    file_id: UUID = Field(..., description="UUID of firmware file to scan")
    data_types: Optional[List[str]] = Field(
        default=['u8', 'u16le', 'u16be', 'u32le'],
        description="List of data types to scan (e.g., 'u8', 'u16le', 'u32be')"
    )
    endianness_hint: Optional[str] = Field(
        default=None,
        description="Endianness hint: 'little', 'big', or None for auto-detect"
    )
    window_size: int = Field(
        default=64,
        ge=4,
        le=512,
        description="Window size for feature extraction (elements)"
    )
    stride: int = Field(
        default=32,
        ge=1,
        le=256,
        description="Stride for sliding window (elements)"
    )
    min_confidence: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Minimum confidence threshold for detections"
    )


class ScanResponse(BaseModel):
    """Response schema for scan job."""
    scan_id: UUID
    file_id: UUID
    status: str  # 'pending', 'processing', 'completed', 'failed'
    config: Dict
    candidates_found: Optional[int] = None
    processing_time_ms: Optional[int] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = {
        "from_attributes": True
    }


class CandidateResponse(BaseModel):
    """Response schema for a detected candidate."""
    candidate_id: UUID
    scan_id: UUID
    offset: int
    size: int
    data_type: str
    confidence: float
    pattern_type: str
    features: Dict
    created_at: datetime
    
    model_config = {
        "from_attributes": True
    }


class ScanResultsResponse(BaseModel):
    """Response schema for scan results with candidates."""
    scan: ScanResponse
    candidates: List[CandidateResponse]
    total_candidates: int
    page: int
    page_size: int

