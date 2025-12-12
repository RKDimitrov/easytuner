"""
Scan service for processing firmware files and detecting patterns.
Simplified synchronous implementation for MVP.
"""
import logging
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.detection.features import (
    extract_features_sliding_window,
    merge_overlapping_detections,
)
from app.detection.preprocessing import preprocess_binary
from app.detection.types import DataType, DetectionResult
from app.models.candidate import Candidate
from app.models.firmware_file import FirmwareFile
from app.models.project import Project
from app.models.scan_job import ScanJob
from app.services.file_storage import file_storage

logger = logging.getLogger(__name__)


class ScanService:
    """Service for managing firmware scans."""
    
    async def create_scan_job(
        self,
        db: AsyncSession,
        file_id: UUID,
        user_id: UUID,
        data_types: Optional[List[str]] = None,
        endianness_hint: Optional[str] = None,
        window_size: int = 64,
        stride: int = 32,
        min_confidence: float = 0.5
    ) -> ScanJob:
        """
        Create a new scan job.
        
        Args:
            db: Database session
            file_id: UUID of firmware file to scan
            user_id: UUID of user creating the scan
            data_types: List of data types to scan (e.g., ['u8', 'u16le'])
            endianness_hint: Optional endianness hint ('little', 'big')
            window_size: Window size for feature extraction
            stride: Stride for sliding window
            min_confidence: Minimum confidence threshold
            
        Returns:
            Created ScanJob
            
        Raises:
            ValueError: If file doesn't exist or user doesn't own the file
        """
        # Verify file exists and user has access
        result = await db.execute(
            select(FirmwareFile)
            .join(FirmwareFile.project)
            .where(
                FirmwareFile.file_id == file_id,
                Project.owner_user_id == user_id,
                FirmwareFile.deleted_at.is_(None)
            )
        )
        firmware_file = result.scalar_one_or_none()
        
        if not firmware_file:
            raise ValueError("Firmware file not found or access denied")
        
        # Create scan job
        scan_config = {
            'data_types': data_types or ['u8', 'u16le', 'u16be', 'u32le'],
            'endianness_hint': endianness_hint,
            'window_size': window_size,
            'stride': stride,
            'min_confidence': min_confidence,
        }
        
        scan_job = ScanJob(
            file_id=file_id,
            status='queued',
            scan_config=scan_config
        )
        
        db.add(scan_job)
        await db.commit()
        await db.refresh(scan_job)
        
        logger.info(f"Created scan job {scan_job.scan_id} for file {file_id}")
        
        return scan_job
    
    async def execute_scan(
        self,
        db: AsyncSession,
        scan_id: UUID
    ) -> ScanJob:
        """
        Execute a scan job synchronously.
        
        Args:
            db: Database session
            scan_id: UUID of scan job to execute
            
        Returns:
            Updated ScanJob
            
        Raises:
            ValueError: If scan job doesn't exist
        """
        # Get scan job
        result = await db.execute(
            select(ScanJob).where(ScanJob.scan_id == scan_id)
        )
        scan_job = result.scalar_one_or_none()
        
        if not scan_job:
            raise ValueError("Scan job not found")
        
        # Update status to processing
        scan_job.status = 'processing'
        scan_job.started_at = datetime.utcnow()
        await db.commit()
        
        try:
            # Load firmware file
            logger.info(f"Loading firmware file {scan_job.file_id}")
            raw_bytes = file_storage.read_file(scan_job.file_id)
            
            # Extract config
            config = scan_job.scan_config or {}
            data_types = config.get('data_types', ['u8', 'u16le', 'u16be', 'u32le'])
            endianness_hint = config.get('endianness_hint')
            window_size = config.get('window_size', 64)
            stride = config.get('stride', 32)
            min_confidence = config.get('min_confidence', 0.5)
            
            # Preprocess binary
            logger.info(f"Preprocessing binary ({len(raw_bytes)} bytes)")
            metadata = preprocess_binary(raw_bytes, data_types, endianness_hint)
            
            # Extract features and detect patterns for each view
            all_detections: List[DetectionResult] = []
            
            for dtype, view in metadata.views.items():
                logger.info(f"Scanning {dtype.value} view ({len(view.data)} elements)")
                
                detections = extract_features_sliding_window(
                    view.data,
                    window_size=window_size,
                    stride=stride,
                    file_size=metadata.size_bytes,
                    min_confidence=min_confidence
                )
                
                all_detections.extend(detections)
                logger.info(f"Found {len(detections)} patterns in {dtype.value} view")
            
            # Merge overlapping detections
            merged_detections = merge_overlapping_detections(all_detections, overlap_threshold=0.5)
            
            # Save candidates to database
            candidates_created = 0
            for detection in merged_detections:
                # Map pattern_type to Candidate type
                # pattern_type: '1d_array', '2d_table', 'unknown'
                pattern_type_lower = detection.pattern_type.lower()
                if '1d' in pattern_type_lower or pattern_type_lower == '1d_array':
                    candidate_type = '1D'
                elif '2d' in pattern_type_lower or pattern_type_lower == '2d_table':
                    candidate_type = '2D'
                elif '3d' in pattern_type_lower:
                    candidate_type = '3D'
                else:
                    candidate_type = 'scalar'
                
                # Extract dimensions from features if available
                features_dict = detection.features.to_dict()
                dimensions = {}
                # Try to infer dimensions from size and data type
                # This is a simple heuristic - can be improved
                if detection.size > 0:
                    # Calculate element size based on data type
                    element_size = 1
                    if '32' in detection.data_type.value:
                        element_size = 4
                    elif '16' in detection.data_type.value:
                        element_size = 2
                    
                    # Estimate dimensions based on size
                    num_elements = detection.size // element_size
                    dimensions = {
                        'size_bytes': detection.size,
                        'estimated_elements': num_elements
                    }
                
                candidate = Candidate(
                    scan_id=scan_id,
                    type=candidate_type,
                    confidence=detection.confidence,
                    byte_offset_start=detection.offset,
                    byte_offset_end=detection.offset + detection.size,
                    data_type=detection.data_type.value,
                    dimensions=dimensions,
                    feature_scores=features_dict,
                    detection_method_version='1.0.0'  # MVP version
                )
                db.add(candidate)
                candidates_created += 1
            
            # Update scan job
            scan_job.status = 'completed'
            scan_job.completed_at = datetime.utcnow()
            scan_job.candidates_found = candidates_created
            
            if scan_job.started_at:
                delta = scan_job.completed_at - scan_job.started_at
                scan_job.processing_time_ms = int(delta.total_seconds() * 1000)
            
            await db.commit()
            await db.refresh(scan_job)
            
            logger.info(
                f"Scan {scan_id} completed: {candidates_created} candidates found "
                f"in {scan_job.processing_time_ms}ms"
            )
            
            return scan_job
            
        except Exception as e:
            logger.error(f"Scan {scan_id} failed: {e}", exc_info=True)
            
            # Update scan job with error
            scan_job.status = 'failed'
            scan_job.completed_at = datetime.utcnow()
            scan_job.error_message = str(e)
            
            if scan_job.started_at:
                delta = scan_job.completed_at - scan_job.started_at
                scan_job.processing_time_ms = int(delta.total_seconds() * 1000)
            
            await db.commit()
            await db.refresh(scan_job)
            
            raise
    
    async def get_scan_job(
        self,
        db: AsyncSession,
        scan_id: UUID,
        user_id: UUID
    ) -> Optional[ScanJob]:
        """
        Get a scan job by ID.
        
        Args:
            db: Database session
            scan_id: UUID of scan job
            user_id: UUID of user (for access control)
            
        Returns:
            ScanJob or None if not found or access denied
        """
        result = await db.execute(
            select(ScanJob)
            .join(ScanJob.file)
            .join(FirmwareFile.project)
            .where(
                ScanJob.scan_id == scan_id,
                Project.owner_user_id == user_id
            )
        )
        return result.scalar_one_or_none()
    
    async def get_scan_candidates(
        self,
        db: AsyncSession,
        scan_id: UUID,
        user_id: UUID,
        limit: int = 100,
        offset: int = 0
    ) -> List[Candidate]:
        """
        Get candidates for a scan job.
        
        Args:
            db: Database session
            scan_id: UUID of scan job
            user_id: UUID of user (for access control)
            limit: Maximum number of candidates to return
            offset: Offset for pagination
            
        Returns:
            List of Candidate objects
        """
        # Verify user has access to this scan
        scan = await self.get_scan_job(db, scan_id, user_id)
        if not scan:
            return []
        
        # Get candidates
        result = await db.execute(
            select(Candidate)
            .where(Candidate.scan_id == scan_id)
            .order_by(Candidate.confidence.desc())
            .limit(limit)
            .offset(offset)
        )
        
        return list(result.scalars().all())


# Singleton instance
scan_service = ScanService()

