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
    status: str  # 'queued', 'processing', 'completed', 'failed'
    config: Dict = Field(alias='scan_config')  # Map scan_config from model to config in response
    candidates_found: Optional[int] = None
    processing_time_ms: Optional[int] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    # Queue info (only populated while queued/processing)
    queue_position: Optional[int] = None
    estimated_wait_seconds: Optional[int] = None

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class QueueStatusResponse(BaseModel):
    """Response schema for global queue status."""
    queued_count: int
    processing_count: int
    total_active: int
    estimated_wait_seconds: int
    avg_scan_duration_seconds: int


class CandidateResponse(BaseModel):
    """Response schema for a detected candidate."""
    candidate_id: UUID
    scan_id: UUID
    offset: int  # Mapped from byte_offset_start
    size: int  # Calculated from byte_offset_end - byte_offset_start
    data_type: str
    confidence: float
    pattern_type: str  # Mapped from type
    features: Dict  # Mapped from feature_scores
    dimensions: Dict  # Structure dimensions (e.g., {x: 16, y: 16})
    created_at: datetime
    
    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }
    
    @classmethod
    def model_validate(cls, obj, **kwargs):
        """Override to map Candidate model fields to API response fields."""
        try:
            if hasattr(obj, 'byte_offset_start'):
                # Create a dict with mapped fields
                data = {
                    'candidate_id': obj.candidate_id,
                    'scan_id': obj.scan_id,
                    'offset': int(obj.byte_offset_start),
                    'size': int(obj.size_bytes),  # Use property
                    'data_type': str(obj.data_type),
                    'confidence': float(obj.confidence),
                    'pattern_type': str(obj.type),  # Map type to pattern_type
                    'features': dict(obj.feature_scores) if obj.feature_scores else {},  # Map feature_scores to features
                    'dimensions': dict(obj.dimensions) if obj.dimensions else {},  # Include dimensions
                    'created_at': obj.created_at,
                }
                return cls(**data)
            return super().model_validate(obj, **kwargs)
        except Exception as e:
            # If validation fails, try to get more info
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to validate candidate: {e}, obj type: {type(obj)}, obj: {obj}")
            raise


class ScanResultsResponse(BaseModel):
    """Response schema for scan results with candidates."""
    scan: ScanResponse
    candidates: List[CandidateResponse]
    total_candidates: int
    page: int
    page_size: int

