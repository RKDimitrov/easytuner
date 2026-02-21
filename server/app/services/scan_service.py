"""
Scan service for processing firmware files and detecting patterns.
Uses the ecumap module for accurate map detection.
"""
import logging
import sys
import io
from contextlib import redirect_stderr
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ecumap.find_maps import find_maps_real, deduplicate_by_overlap, filter_statistical_outliers
from ecumap.scorer import rank_candidates
from ecumap.segmentation import SegmentationConfig
from app.models.candidate import Candidate
from app.models.firmware_file import FirmwareFile
from app.models.project import Project
from app.models.scan_job import ScanJob
from app.services.file_storage import file_storage

logger = logging.getLogger(__name__)


class ScanService:
    """Service for managing firmware scans."""
    
    def _convert_dtype_to_data_type(self, dtype: str, endianness: str) -> str:
        """
        Convert ecumap dtype format to data_type string format.
        
        Args:
            dtype: Data type from ecumap (e.g., 'uint16', 'float32')
            endianness: Endianness ('little' or 'big')
            
        Returns:
            Data type string (e.g., 'u16le', 'f32be')
        """
        dtype_lower = dtype.lower()
        endian_suffix = 'le' if endianness == 'little' else 'be'
        
        # Map common types
        if dtype_lower == 'uint8' or dtype_lower == 'u8':
            return 'u8'
        elif dtype_lower == 'uint16' or dtype_lower == 'u16':
            return f'u16{endian_suffix}'
        elif dtype_lower == 'uint32' or dtype_lower == 'u32':
            return f'u32{endian_suffix}'
        elif dtype_lower == 'int16' or dtype_lower == 's16':
            return f's16{endian_suffix}'
        elif dtype_lower == 'int32' or dtype_lower == 's32':
            return f's32{endian_suffix}'
        elif dtype_lower == 'float32' or dtype_lower == 'f32':
            return f'float32{endian_suffix}'
        else:
            # Default: try to extract number and type
            if 'uint' in dtype_lower or 'u' in dtype_lower:
                if '16' in dtype_lower:
                    return f'u16{endian_suffix}'
                elif '32' in dtype_lower:
                    return f'u32{endian_suffix}'
                else:
                    return 'u8'
            elif 'int' in dtype_lower or 's' in dtype_lower:
                if '16' in dtype_lower:
                    return f's16{endian_suffix}'
                elif '32' in dtype_lower:
                    return f's32{endian_suffix}'
            elif 'float' in dtype_lower or 'f' in dtype_lower:
                return f'float32{endian_suffix}'
            
            # Fallback
            return f'u16{endian_suffix}'
    
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
            # Use ecumap defaults - window_size in ecumap is for entropy calculation (larger than old system)
            # If old small window_size is provided, use ecumap default instead
            old_window_size = config.get('window_size', 1024)
            window_size = 1024 if old_window_size < 512 else old_window_size  # Use ecumap default if too small
            entropy_threshold = config.get('entropy_threshold', 7.2)
            min_block_size = config.get('min_block_size', 256)
            top_k = config.get('top_k', 20)  # Number of top candidates to return
            min_confidence = float(config.get('min_confidence', 0.5))
            
            # Create segmentation configuration
            seg_config = SegmentationConfig(
                window_size=window_size,
                step_size=256,  # Fixed step size
                entropy_threshold=entropy_threshold,
                min_block_size=min_block_size,
                ascii_threshold=0.3  # Fixed ASCII threshold
            )
            
            # Create a temporary file path for find_maps_real
            # Since find_maps_real expects a Path, we'll write to a temp file
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False, suffix='.bin') as tmp_file:
                tmp_file.write(raw_bytes)
                tmp_file_path = Path(tmp_file.name)
            
            try:
                # Capture stderr output for progress logging
                stderr_capture = io.StringIO()
                
                # Run the ecumap detection algorithm
                logger.info(f"Starting map detection using ecumap algorithm ({len(raw_bytes)} bytes)")
                logger.info(f"Configuration: window_size={window_size}, entropy_threshold={entropy_threshold}, min_block_size={min_block_size}")
                
                # Redirect stderr to capture progress messages
                with redirect_stderr(stderr_capture):
                    # Get more candidates than requested for deduplication
                    candidates_blocks = find_maps_real(tmp_file_path, top_k * 3, seg_config)
                
                # Log captured progress messages
                stderr_output = stderr_capture.getvalue()
                if stderr_output:
                    for line in stderr_output.strip().split('\n'):
                        if line.strip():
                            logger.info(f"ECU Map Detection: {line}")
                
                logger.info(f"Found {len(candidates_blocks)} candidates before deduplication")
                
                # Deduplicate, rank, and filter outliers (same as find_maps.py main)
                deduplicated = deduplicate_by_overlap(candidates_blocks)
                final_ranked = rank_candidates(deduplicated)
                
                # Filter statistical outliers
                filtered_candidates = filter_statistical_outliers(final_ranked, z_threshold=1.5)
                
                # Select top K
                top_candidates = filtered_candidates[:top_k]
                
                logger.info(f"Processing {len(top_candidates)} candidates after ranking and filtering")
                
            finally:
                # Clean up temp file
                try:
                    tmp_file_path.unlink()
                except Exception as e:
                    logger.warning(f"Failed to delete temp file {tmp_file_path}: {e}")
            
            # Convert ecumap candidates to database Candidate models
            candidates_created = 0
            for ecumap_candidate in top_candidates:
                # Map ecumap candidate format to Candidate model
                # Determine candidate type from dimensions
                width = ecumap_candidate.get('width', 1)
                height = ecumap_candidate.get('height', 1)
                
                if width > 1 and height > 1:
                    candidate_type = '2D'
                elif width > 1 or height > 1:
                    candidate_type = '1D'
                else:
                    candidate_type = 'scalar'
                
                # Convert dtype to data_type format
                dtype = ecumap_candidate.get('dtype', 'uint16')
                endianness = ecumap_candidate.get('endianness', 'little')
                
                # Map dtype format: "uint16" + "little" -> "u16le"
                data_type_str = self._convert_dtype_to_data_type(dtype, endianness)
                
                # Extract dimensions - use x, y, z format for frontend compatibility
                dimensions = {
                    'x': width,
                    'y': height,
                    'size_bytes': ecumap_candidate.get('end', 0) - ecumap_candidate.get('start', 0),
                    'element_size': ecumap_candidate.get('element_size', 2)
                }
                
                # For 3D maps, we'd need to extract z dimension if available
                # For now, 2D maps use x and y
                
                # Get confidence from score (already normalized 0-1)
                confidence = float(ecumap_candidate.get('score', 0.0))
                confidence = max(0.0, min(1.0, confidence))
                
                # Skip candidates below min_confidence (removes low-confidence detections)
                if confidence < min_confidence:
                    continue
                
                # Extract metrics as feature scores
                metrics = ecumap_candidate.get('metrics', {})
                feature_scores = {
                    'entropy': metrics.get('entropy', 0.0),
                    'mean_abs_dx_norm': metrics.get('mean_abs_dx_norm', 0.0),
                    'mean_abs_dy_norm': metrics.get('mean_abs_dy_norm', 0.0),
                    'row_diff_mean': metrics.get('row_diff_mean', 0.0),
                    'col_var_mean': metrics.get('col_var_mean', 0.0),
                    'row_var_mean': metrics.get('row_var_mean', 0.0),
                    'monotonic_rows': metrics.get('monotonic_rows', 0.0),
                    'monotonic_cols': metrics.get('monotonic_cols', 0.0),
                    'value_range_score': metrics.get('value_range_score', 0.0),
                    'edge_consistency': metrics.get('edge_consistency', 0.0),
                    'value_coherence': metrics.get('value_coherence', 0.0),
                    'jump_anomaly': metrics.get('jump_anomaly', 0.0),
                    'local_coherence': metrics.get('local_coherence', 0.0),
                    'gradient_distribution_quality': metrics.get('gradient_distribution_quality', 0.0),
                    'structural_score': metrics.get('structural_score', 0.5),
                    'score': ecumap_candidate.get('score', 0.0)
                }
                
                candidate = Candidate(
                    scan_id=scan_id,
                    type=candidate_type,
                    confidence=confidence,
                    byte_offset_start=ecumap_candidate.get('start', 0),
                    byte_offset_end=ecumap_candidate.get('end', 0),
                    data_type=data_type_str,
                    dimensions=dimensions,
                    feature_scores=feature_scores,
                    detection_method_version='2.0.0'  # ecumap version
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
    
    async def copy_scan_results(
        self,
        db: AsyncSession,
        source_file_id: UUID,
        target_file_id: UUID,
        user_id: UUID
    ) -> Optional[ScanJob]:
        """
        Copy scan results from one file to another.
        
        This is used when a modified file is created - it inherits the scan
        results from the original file since map locations don't change.
        
        Args:
            db: Database session
            source_file_id: UUID of source file (original)
            target_file_id: UUID of target file (modified)
            user_id: UUID of user (for access control)
            
        Returns:
            New ScanJob with copied candidates, or None if no scan found
        """
        # Verify user has access to both files
        source_result = await db.execute(
            select(FirmwareFile)
            .join(FirmwareFile.project)
            .where(
                FirmwareFile.file_id == source_file_id,
                Project.owner_user_id == user_id,
                FirmwareFile.deleted_at.is_(None)
            )
        )
        source_file = source_result.scalar_one_or_none()
        
        if not source_file:
            logger.warning(f"Source file {source_file_id} not found or access denied")
            return None
        
        # Get latest completed scan from source file
        latest_scan_result = await db.execute(
            select(ScanJob)
            .where(
                ScanJob.file_id == source_file_id,
                ScanJob.status == 'completed'
            )
            .order_by(ScanJob.created_at.desc())
            .limit(1)
        )
        source_scan = latest_scan_result.scalar_one_or_none()
        
        if not source_scan:
            logger.info(f"No completed scan found for source file {source_file_id}")
            return None
        
        # Get all candidates from source scan
        candidates_result = await db.execute(
            select(Candidate)
            .where(Candidate.scan_id == source_scan.scan_id)
        )
        source_candidates = list(candidates_result.scalars().all())
        
        if not source_candidates:
            logger.info(f"No candidates found in source scan {source_scan.scan_id}")
            return None
        
        # Create new scan job for target file
        new_scan = ScanJob(
            file_id=target_file_id,
            status='completed',
            scan_config={
                **source_scan.scan_config,
                'inherited_from': str(source_scan.scan_id),
                'inherited_from_file': str(source_file_id)
            },
            started_at=source_scan.started_at,
            completed_at=datetime.utcnow(),
            processing_time_ms=0  # No processing time for copied scans
        )
        
        db.add(new_scan)
        await db.flush()  # Flush to get the scan_id
        
        # Copy all candidates
        candidates_copied = 0
        for source_candidate in source_candidates:
            new_candidate = Candidate(
                scan_id=new_scan.scan_id,
                type=source_candidate.type,
                confidence=source_candidate.confidence,
                byte_offset_start=source_candidate.byte_offset_start,
                byte_offset_end=source_candidate.byte_offset_end,
                data_type=source_candidate.data_type,
                dimensions=source_candidate.dimensions.copy() if source_candidate.dimensions else {},
                feature_scores=source_candidate.feature_scores.copy() if source_candidate.feature_scores else {},
                detection_method_version=source_candidate.detection_method_version
            )
            db.add(new_candidate)
            candidates_copied += 1
        
        await db.commit()
        await db.refresh(new_scan)
        
        logger.info(
            f"Copied scan results from {source_file_id} to {target_file_id}: "
            f"{candidates_copied} candidates copied"
        )
        
        return new_scan


# Singleton instance
scan_service = ScanService()

