"""
Scan endpoints for firmware analysis.
"""
import logging
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.scan import (
    CandidateResponse,
    ScanCreate,
    ScanResponse,
    ScanResultsResponse,
)
from app.services.scan_service import scan_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/scans", tags=["scans"])


@router.post(
    "",
    response_model=ScanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create and start a scan",
    description="Create a new scan job and execute it synchronously"
)
async def create_scan(
    scan_request: ScanCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ScanResponse:
    """
    Create and execute a firmware scan.
    
    This endpoint creates a scan job and executes it immediately (synchronous).
    For MVP, scans are processed in the request lifecycle.
    
    Args:
        scan_request: Scan configuration
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Created scan job with results
        
    Raises:
        400: If file doesn't exist or invalid configuration
        500: If scan execution fails
    """
    try:
        # Create scan job
        scan_job = await scan_service.create_scan_job(
            db=db,
            file_id=scan_request.file_id,
            user_id=current_user.user_id,
            data_types=scan_request.data_types,
            endianness_hint=scan_request.endianness_hint,
            window_size=scan_request.window_size,
            stride=scan_request.stride,
            min_confidence=scan_request.min_confidence
        )
        
        # Execute scan immediately
        scan_job = await scan_service.execute_scan(db, scan_job.scan_id)
        
        return ScanResponse.model_validate(scan_job)
        
    except ValueError as e:
        logger.warning(f"Invalid scan request: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Scan execution failed: {e}", exc_info=True)
        error_detail = str(e)
        # Include error message from scan job if available
        if hasattr(e, 'args') and e.args:
            error_detail = str(e.args[0])
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scan execution failed: {error_detail}"
        )


@router.get(
    "/{scan_id}",
    response_model=ScanResponse,
    summary="Get scan job status",
    description="Get details and status of a scan job"
)
async def get_scan(
    scan_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ScanResponse:
    """
    Get scan job details.
    
    Args:
        scan_id: UUID of scan job
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Scan job details
        
    Raises:
        404: If scan job not found or access denied
    """
    scan_job = await scan_service.get_scan_job(db, scan_id, current_user.user_id)
    
    if not scan_job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan job not found"
        )
    
    return ScanResponse.model_validate(scan_job)


@router.get(
    "/{scan_id}/candidates",
    response_model=List[CandidateResponse],
    summary="Get scan candidates",
    description="Get detected candidates for a scan job"
)
async def get_scan_candidates(
    scan_id: UUID,
    limit: int = 100,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> List[CandidateResponse]:
    """
    Get candidates detected by a scan.
    
    Args:
        scan_id: UUID of scan job
        limit: Maximum number of candidates to return (default 100)
        offset: Offset for pagination (default 0)
        current_user: Authenticated user
        db: Database session
        
    Returns:
        List of detected candidates
        
    Raises:
        404: If scan job not found or access denied
    """
    # Verify access
    scan_job = await scan_service.get_scan_job(db, scan_id, current_user.user_id)
    if not scan_job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan job not found"
        )
    
    # Get candidates
    candidates = await scan_service.get_scan_candidates(
        db, scan_id, current_user.user_id, limit, offset
    )
    
    return [CandidateResponse.model_validate(c) for c in candidates]


@router.get(
    "/{scan_id}/results",
    response_model=ScanResultsResponse,
    summary="Get complete scan results",
    description="Get scan job details with candidates in one response"
)
async def get_scan_results(
    scan_id: UUID,
    limit: int = 100,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ScanResultsResponse:
    """
    Get complete scan results (job + candidates).
    
    Args:
        scan_id: UUID of scan job
        limit: Maximum number of candidates per page (default 100)
        offset: Offset for pagination (default 0)
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Complete scan results with candidates
        
    Raises:
        404: If scan job not found or access denied
    """
    # Get scan job
    scan_job = await scan_service.get_scan_job(db, scan_id, current_user.user_id)
    if not scan_job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan job not found"
        )
    
    try:
        # Get candidates
        candidates = await scan_service.get_scan_candidates(
            db, scan_id, current_user.user_id, limit, offset
        )
        
        # Convert candidates to response format
        candidate_responses = []
        for c in candidates:
            try:
                candidate_responses.append(CandidateResponse.model_validate(c))
            except Exception as e:
                logger.error(f"Failed to validate candidate {c.candidate_id}: {e}", exc_info=True)
                # Skip invalid candidates but continue processing
                continue
        
        return ScanResultsResponse(
            scan=ScanResponse.model_validate(scan_job),
            candidates=candidate_responses,
            total_candidates=scan_job.candidates_found or 0,
            page=offset // limit if limit > 0 else 0,
            page_size=limit
        )
    except Exception as e:
        logger.error(f"Failed to get scan results for {scan_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get scan results: {str(e)}"
        )

