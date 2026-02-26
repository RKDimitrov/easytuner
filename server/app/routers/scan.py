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
    QueueStatusResponse,
    ScanCreate,
    ScanResponse,
    ScanResultsResponse,
)
from app.services.scan_queue import scan_queue
from app.services.scan_service import scan_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/scans", tags=["scans"])


def _enrich_with_queue_info(scan_response: ScanResponse, scan_id: UUID) -> ScanResponse:
    """Attach live queue position and ETA to a ScanResponse if still active."""
    if scan_response.status in ("queued", "processing"):
        pos = scan_queue.position_of(scan_id)
        eta = scan_queue.estimated_wait_seconds(scan_id)
        scan_response.queue_position = pos
        scan_response.estimated_wait_seconds = eta
    return scan_response


@router.get(
    "/queue/status",
    response_model=QueueStatusResponse,
    summary="Get global scan queue status",
    description="Returns the current queue depth and estimated wait time for a new job"
)
async def get_queue_status(
    current_user: User = Depends(get_current_user),
) -> QueueStatusResponse:
    """Return global queue metrics."""
    return QueueStatusResponse(
        queued_count=scan_queue.queued_count,
        processing_count=scan_queue.processing_count,
        total_active=scan_queue.queued_count + scan_queue.processing_count,
        estimated_wait_seconds=scan_queue.global_estimated_wait_seconds(),
        avg_scan_duration_seconds=scan_queue.avg_scan_duration_seconds,
    )


@router.post(
    "",
    response_model=ScanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create and queue a scan",
    description="Create a new scan job and add it to the processing queue"
)
async def create_scan(
    scan_request: ScanCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ScanResponse:
    """
    Create a firmware scan job and enqueue it for processing.

    The job is created with status ``queued`` and immediately returned.
    Poll ``GET /scans/{scan_id}`` to track progress.

    Raises:
        400: If file doesn't exist or invalid configuration
        500: If job creation fails
    """
    try:
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

        # Enqueue — the background worker will call execute_scan()
        queue_position = await scan_queue.enqueue(scan_job.scan_id)

        response = ScanResponse.model_validate(scan_job)
        response.queue_position = queue_position
        response.estimated_wait_seconds = scan_queue.estimated_wait_seconds(scan_job.scan_id)
        return response

    except ValueError as e:
        logger.warning(f"Invalid scan request: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to create scan job: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create scan: {str(e)}"
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

    While the job is ``queued`` or ``processing``, the response includes
    ``queue_position`` and ``estimated_wait_seconds``.

    Raises:
        404: If scan job not found or access denied
    """
    scan_job = await scan_service.get_scan_job(db, scan_id, current_user.user_id)

    if not scan_job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan job not found"
        )

    response = ScanResponse.model_validate(scan_job)
    return _enrich_with_queue_info(response, scan_id)


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

    Raises:
        404: If scan job not found or access denied
    """
    scan_job = await scan_service.get_scan_job(db, scan_id, current_user.user_id)
    if not scan_job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan job not found"
        )

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

    Raises:
        404: If scan job not found or access denied
    """
    scan_job = await scan_service.get_scan_job(db, scan_id, current_user.user_id)
    if not scan_job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan job not found"
        )

    try:
        candidates = await scan_service.get_scan_candidates(
            db, scan_id, current_user.user_id, limit, offset
        )

        candidate_responses = []
        for c in candidates:
            try:
                candidate_responses.append(CandidateResponse.model_validate(c))
            except Exception as e:
                logger.error(f"Failed to validate candidate {c.candidate_id}: {e}", exc_info=True)
                continue

        total_candidates = len(candidate_responses)

        scan_response = ScanResponse.model_validate(scan_job)
        _enrich_with_queue_info(scan_response, scan_id)

        return ScanResultsResponse(
            scan=scan_response,
            candidates=candidate_responses,
            total_candidates=total_candidates,
            page=offset // limit if limit > 0 else 0,
            page_size=limit,
        )
    except Exception as e:
        logger.error(f"Failed to get scan results for {scan_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get scan results: {str(e)}"
        )
