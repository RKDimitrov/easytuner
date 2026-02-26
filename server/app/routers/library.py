"""
Library endpoints for browsing published projects (no auth required for read).
"""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.file_storage import file_storage
from app.models.project import Project
from app.models.firmware_file import FirmwareFile
from app.models.scan_job import ScanJob
from app.models.candidate import Candidate
from app.models.user import User
from app.schemas.scan import (
    CandidateResponse,
    ScanResponse,
    ScanResultsResponse,
)
from app.services.scan_service import scan_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/library", tags=["library"])


@router.get(
    "",
    status_code=status.HTTP_200_OK,
    summary="List published projects",
    description="Get all projects published to the library (public)"
)
async def list_library_projects(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """List projects that are published (published_at is set and is_private is False)."""
    query = (
        select(
            Project,
            User.email.label("owner_email"),
            func.count(FirmwareFile.file_id).label("file_count"),
        )
        .join(User, User.user_id == Project.owner_user_id)
        .outerjoin(
            FirmwareFile,
            (FirmwareFile.project_id == Project.project_id) & (FirmwareFile.deleted_at.is_(None))
        )
        .where(
            Project.deleted_at.is_(None),
            Project.is_private.is_(False),
            Project.published_at.isnot(None),
        )
        .group_by(Project.project_id, User.user_id, User.email)
        .order_by(desc(Project.published_at))
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(query)
    rows = result.all()
    projects = []
    for project, owner_email, file_count in rows:
        projects.append({
            "project_id": str(project.project_id),
            "owner_user_id": str(project.owner_user_id),
            "owner_email": owner_email,
            "name": project.name,
            "description": project.description,
            "published_at": project.published_at.isoformat() if project.published_at else None,
            "created_at": project.created_at.isoformat(),
            "updated_at": project.updated_at.isoformat(),
            "file_count": file_count or 0,
        })
    return {"projects": projects, "count": len(projects)}


@router.get(
    "/{project_id}",
    status_code=status.HTTP_200_OK,
    summary="Get published project",
    description="Get a single published project with its files (public)"
)
async def get_library_project(
    project_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get published project detail and list of files with scan status."""
    result = await db.execute(
        select(Project, User.email.label("owner_email"))
        .join(User, User.user_id == Project.owner_user_id)
        .where(
            Project.project_id == project_id,
            Project.deleted_at.is_(None),
            Project.is_private.is_(False),
            Project.published_at.isnot(None),
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or not published"
        )
    project, owner_email = row

    files_result = await db.execute(
        select(FirmwareFile)
        .where(
            FirmwareFile.project_id == project_id,
            FirmwareFile.deleted_at.is_(None)
        )
        .order_by(FirmwareFile.uploaded_at.desc())
    )
    files_list = files_result.scalars().all()
    files = []
    for f in files_list:
        latest_scan_result = await db.execute(
            select(ScanJob)
            .where(
                ScanJob.file_id == f.file_id,
                ScanJob.status == "completed"
            )
            .order_by(desc(ScanJob.created_at))
            .limit(1)
        )
        latest_scan = latest_scan_result.scalar_one_or_none()
        cand_count = 0
        if latest_scan:
            cand_result = await db.execute(
                select(func.count(Candidate.candidate_id)).where(Candidate.scan_id == latest_scan.scan_id)
            )
            cand_count = cand_result.scalar() or 0
        files.append({
            "file_id": str(f.file_id),
            "filename": f.filename,
            "size_bytes": f.size_bytes,
            "uploaded_at": f.uploaded_at.isoformat(),
            "has_scan": latest_scan is not None,
            "latest_scan_id": str(latest_scan.scan_id) if latest_scan else None,
            "latest_scan_at": latest_scan.created_at.isoformat() if latest_scan else None,
            "candidates_count": cand_count,
        })

    return {
        "project_id": str(project.project_id),
        "owner_user_id": str(project.owner_user_id),
        "owner_email": owner_email,
        "name": project.name,
        "description": project.description,
        "published_at": project.published_at.isoformat() if project.published_at else None,
        "created_at": project.created_at.isoformat(),
        "updated_at": project.updated_at.isoformat(),
        "file_count": len(files),
        "files": files,
    }


@router.get(
    "/{project_id}/files/{file_id}/scan-results",
    status_code=status.HTTP_200_OK,
    summary="Get file scan results (published project)",
    description="Get latest scan results for a file in a published project (public)"
)
async def get_library_file_scan_results(
    project_id: UUID,
    file_id: UUID,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """Get scan results for a file. Only allowed if the file belongs to a published project."""
    # Verify file belongs to this published project
    proj_result = await db.execute(
        select(Project).where(
            Project.project_id == project_id,
            Project.deleted_at.is_(None),
            Project.is_private.is_(False),
            Project.published_at.isnot(None),
        )
    )
    if not proj_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found or not published")

    file_result = await db.execute(
        select(FirmwareFile).where(
            FirmwareFile.file_id == file_id,
            FirmwareFile.project_id == project_id,
            FirmwareFile.deleted_at.is_(None),
        )
    )
    firmware_file = file_result.scalar_one_or_none()
    if not firmware_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    # Get latest completed scan for this file
    scan_result = await db.execute(
        select(ScanJob)
        .where(
            ScanJob.file_id == file_id,
            ScanJob.status == "completed"
        )
        .order_by(desc(ScanJob.created_at))
        .limit(1)
    )
    scan_job = scan_result.scalar_one_or_none()
    if not scan_job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No completed scan for this file")

    candidates = await scan_service.get_scan_candidates_for_library(db, scan_job.scan_id, limit=limit, offset=offset)
    candidate_responses = []
    for c in candidates:
        try:
            candidate_responses.append(CandidateResponse.model_validate(c))
        except Exception as e:
            logger.warning(f"Skip invalid candidate {c.candidate_id}: {e}")
            continue

    return ScanResultsResponse(
        scan=ScanResponse.model_validate(scan_job),
        candidates=candidate_responses,
        total_candidates=len(candidate_responses),
        page=offset // limit if limit > 0 else 0,
        page_size=limit,
    )


@router.get(
    "/scans",
    status_code=status.HTTP_200_OK,
    summary="List scanned files from published projects",
    description="Get all files that have completed scans from published projects (public)"
)
async def list_library_scans(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """List all scanned files from published projects, ordered by scan date."""
    query = (
        select(
            FirmwareFile,
            Project.project_id.label("project_id"),
            Project.name.label("project_name"),
            User.email.label("owner_email"),
            ScanJob.scan_id.label("scan_id"),
            ScanJob.created_at.label("scanned_at"),
            ScanJob.processing_time_ms.label("processing_time_ms"),
            func.count(Candidate.candidate_id).label("candidates_count"),
        )
        .join(Project, FirmwareFile.project_id == Project.project_id)
        .join(User, User.user_id == Project.owner_user_id)
        .join(ScanJob, ScanJob.file_id == FirmwareFile.file_id)
        .outerjoin(Candidate, Candidate.scan_id == ScanJob.scan_id)
        .where(
            Project.deleted_at.is_(None),
            Project.is_private.is_(False),
            Project.published_at.isnot(None),
            FirmwareFile.deleted_at.is_(None),
            ScanJob.status == "completed",
        )
        .group_by(
            FirmwareFile.file_id,
            Project.project_id,
            Project.name,
            User.user_id,
            User.email,
            ScanJob.scan_id,
            ScanJob.created_at,
            ScanJob.processing_time_ms,
        )
        .order_by(desc(ScanJob.created_at))
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(query)
    rows = result.all()
    scans = []
    for f, project_id, project_name, owner_email, scan_id, scanned_at, proc_ms, cand_count in rows:
        scans.append({
            "file_id": str(f.file_id),
            "filename": f.filename,
            "size_bytes": f.size_bytes,
            "sha256": f.sha256,
            "project_id": str(project_id),
            "project_name": project_name,
            "owner_email": owner_email,
            "scan_id": str(scan_id),
            "scanned_at": scanned_at.isoformat() if scanned_at else None,
            "processing_time_ms": proc_ms,
            "candidates_count": cand_count or 0,
        })
    return {"scans": scans, "count": len(scans)}


@router.get(
    "/check-hash",
    status_code=status.HTTP_200_OK,
    summary="Check if a file hash has an existing scan in the library",
    description="Returns scan info if a file with this SHA-256 exists in any published project"
)
async def check_hash(
    sha256: str = Query(..., min_length=64, max_length=64, description="SHA-256 hex hash of the file"),
    db: AsyncSession = Depends(get_db)
):
    """
    Check if a file with this hash has already been scanned in a published project.
    Used on upload to offer reusing an existing scan.
    """
    result = await db.execute(
        select(
            FirmwareFile,
            Project.project_id.label("project_id"),
            Project.name.label("project_name"),
            User.email.label("owner_email"),
            ScanJob.scan_id.label("scan_id"),
            ScanJob.created_at.label("scanned_at"),
            func.count(Candidate.candidate_id).label("candidates_count"),
        )
        .join(Project, FirmwareFile.project_id == Project.project_id)
        .join(User, User.user_id == Project.owner_user_id)
        .join(ScanJob, ScanJob.file_id == FirmwareFile.file_id)
        .outerjoin(Candidate, Candidate.scan_id == ScanJob.scan_id)
        .where(
            FirmwareFile.sha256 == sha256,
            FirmwareFile.deleted_at.is_(None),
            Project.deleted_at.is_(None),
            Project.is_private.is_(False),
            Project.published_at.isnot(None),
            ScanJob.status == "completed",
        )
        .group_by(
            FirmwareFile.file_id,
            Project.project_id,
            Project.name,
            User.user_id,
            User.email,
            ScanJob.scan_id,
            ScanJob.created_at,
        )
        .order_by(desc(ScanJob.created_at))
        .limit(1)
    )
    row = result.first()
    if not row:
        return {"found": False}
    f, project_id, project_name, owner_email, scan_id, scanned_at, cand_count = row
    return {
        "found": True,
        "file_id": str(f.file_id),
        "filename": f.filename,
        "size_bytes": f.size_bytes,
        "project_id": str(project_id),
        "project_name": project_name,
        "owner_email": owner_email,
        "scan_id": str(scan_id),
        "scanned_at": scanned_at.isoformat() if scanned_at else None,
        "candidates_count": cand_count or 0,
    }


@router.get(
    "/{project_id}/files/{file_id}/download",
    status_code=status.HTTP_200_OK,
    summary="Download file (published project)",
    description="Download file bytes for a file in a published project (public, for hex/map view)"
)
async def download_library_file(
    project_id: UUID,
    file_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Return raw file bytes. Only allowed if the file belongs to a published project."""
    proj_result = await db.execute(
        select(Project).where(
            Project.project_id == project_id,
            Project.deleted_at.is_(None),
            Project.is_private.is_(False),
            Project.published_at.isnot(None),
        )
    )
    if not proj_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found or not published")

    file_result = await db.execute(
        select(FirmwareFile).where(
            FirmwareFile.file_id == file_id,
            FirmwareFile.project_id == project_id,
            FirmwareFile.deleted_at.is_(None),
        )
    )
    firmware_file = file_result.scalar_one_or_none()
    if not firmware_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    try:
        file_content = file_storage.read_file(file_id)
        return Response(
            content=file_content,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{firmware_file.filename}"',
                "Content-Length": str(len(file_content)),
            },
        )
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found in storage")
    except Exception as e:
        logger.error(f"Failed to read library file {file_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to read file",
        )
