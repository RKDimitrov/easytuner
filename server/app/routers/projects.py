"""
Project endpoints for managing user projects.
"""
import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.project import Project
from app.models.firmware_file import FirmwareFile
from app.models.user import User
from app.models.scan_job import ScanJob
from app.models.candidate import Candidate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["projects"])


# Request/Response schemas
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_private: bool = True
    vehicle_model: str


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_private: Optional[bool] = None
    vehicle_model: Optional[str] = None


@router.get(
    "",
    status_code=status.HTTP_200_OK,
    summary="List projects",
    description="Get all projects for the authenticated user"
)
async def list_projects(
    limit: int = Query(default=100, ge=1, le=1000),
    cursor: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all projects for the authenticated user.
    
    Args:
        limit: Maximum number of projects to return
        cursor: Pagination cursor (not yet implemented)
        current_user: Authenticated user
        db: Database session
        
    Returns:
        List of projects with pagination info
    """
    try:
        # Build query for user's projects
        query = (
            select(
                Project,
                func.count(FirmwareFile.file_id).label('file_count')
            )
            .outerjoin(
                FirmwareFile,
                (FirmwareFile.project_id == Project.project_id) & 
                (FirmwareFile.deleted_at.is_(None))
            )
            .where(
                Project.owner_user_id == current_user.user_id,
                Project.deleted_at.is_(None)
            )
            .group_by(Project.project_id)
            .order_by(Project.created_at.desc())
            .limit(limit)
        )
        
        result = await db.execute(query)
        rows = result.all()
        
        # Format response
        projects = []
        for project, file_count in rows:
            projects.append({
                "project_id": str(project.project_id),
                "owner_user_id": str(project.owner_user_id),
                "name": project.name,
                "description": project.description,
                "is_private": project.is_private,
                "vehicle_model": project.vehicle_model,
                "published_at": project.published_at.isoformat() if project.published_at else None,
                "created_at": project.created_at.isoformat(),
                "updated_at": project.updated_at.isoformat(),
                "file_count": file_count or 0
            })
        
        return {
            "projects": projects,
            "pagination": {
                "next_cursor": None,  # TODO: Implement cursor-based pagination
                "has_more": False
            }
        }
    except Exception as e:
        logger.error(f"Failed to list projects: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch projects"
        )


@router.get(
    "/{project_id}",
    status_code=status.HTTP_200_OK,
    summary="Get project",
    description="Get a single project by ID"
)
async def get_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a single project by ID.
    
    Args:
        project_id: UUID of the project
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Project details
        
    Raises:
        404: If project not found or access denied
    """
    result = await db.execute(
        select(
            Project,
            func.count(FirmwareFile.file_id).label('file_count')
        )
        .outerjoin(
            FirmwareFile,
            (FirmwareFile.project_id == Project.project_id) & 
            (FirmwareFile.deleted_at.is_(None))
        )
        .where(
            Project.project_id == project_id,
            Project.owner_user_id == current_user.user_id,
            Project.deleted_at.is_(None)
        )
        .group_by(Project.project_id)
    )
    
    row = result.first()
    
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied"
        )
    
    project, file_count = row
    
    return {
        "project_id": str(project.project_id),
        "owner_user_id": str(project.owner_user_id),
        "name": project.name,
        "description": project.description,
        "is_private": project.is_private,
        "vehicle_model": project.vehicle_model,
        "published_at": project.published_at.isoformat() if project.published_at else None,
        "created_at": project.created_at.isoformat(),
        "updated_at": project.updated_at.isoformat(),
        "file_count": file_count or 0
    }


@router.post(
    "/{project_id}/publish",
    status_code=status.HTTP_200_OK,
    summary="Publish project to library",
    description="Publish a public project to the library so others can view it"
)
async def publish_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Publish project to library. Project must be public (is_private=False)."""
    result = await db.execute(
        select(Project)
        .where(
            Project.project_id == project_id,
            Project.owner_user_id == current_user.user_id,
            Project.deleted_at.is_(None)
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied"
        )
    if project.is_private:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Make the project public first (Settings → uncheck Private) to publish to the library"
        )
    project.published_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(project)
    file_count_result = await db.execute(
        select(func.count(FirmwareFile.file_id))
        .where(
            FirmwareFile.project_id == project_id,
            FirmwareFile.deleted_at.is_(None)
        )
    )
    file_count = file_count_result.scalar() or 0
    return {
        "project_id": str(project.project_id),
        "owner_user_id": str(project.owner_user_id),
        "name": project.name,
        "description": project.description,
        "is_private": project.is_private,
        "vehicle_model": project.vehicle_model,
        "published_at": project.published_at.isoformat(),
        "created_at": project.created_at.isoformat(),
        "updated_at": project.updated_at.isoformat(),
        "file_count": file_count
    }


@router.delete(
    "/{project_id}/publish",
    status_code=status.HTTP_200_OK,
    summary="Unpublish project from library",
    description="Remove project from the public library"
)
async def unpublish_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Unpublish project from library."""
    result = await db.execute(
        select(Project)
        .where(
            Project.project_id == project_id,
            Project.owner_user_id == current_user.user_id,
            Project.deleted_at.is_(None)
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied"
        )
    project.published_at = None
    await db.commit()
    await db.refresh(project)
    file_count_result = await db.execute(
        select(func.count(FirmwareFile.file_id))
        .where(
            FirmwareFile.project_id == project_id,
            FirmwareFile.deleted_at.is_(None)
        )
    )
    file_count = file_count_result.scalar() or 0
    return {
        "project_id": str(project.project_id),
        "owner_user_id": str(project.owner_user_id),
        "name": project.name,
        "description": project.description,
        "is_private": project.is_private,
        "vehicle_model": project.vehicle_model,
        "published_at": None,
        "created_at": project.created_at.isoformat(),
        "updated_at": project.updated_at.isoformat(),
        "file_count": file_count
    }


@router.get(
    "/{project_id}/scans",
    status_code=status.HTTP_200_OK,
    summary="List project scans",
    description="Get all scans for files in this project"
)
async def list_project_scans(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List scans for all files in the project."""
    result = await db.execute(
        select(Project)
        .where(
            Project.project_id == project_id,
            Project.owner_user_id == current_user.user_id,
            Project.deleted_at.is_(None)
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied"
        )
    # Get all files and their scans
    files_result = await db.execute(
        select(FirmwareFile)
        .where(
            FirmwareFile.project_id == project_id,
            FirmwareFile.deleted_at.is_(None)
        )
        .order_by(FirmwareFile.uploaded_at.desc())
    )
    files_list = files_result.scalars().all()
    scans = []
    for f in files_list:
        scans_result = await db.execute(
            select(ScanJob)
            .where(ScanJob.file_id == f.file_id)
            .order_by(ScanJob.created_at.desc())
        )
        for scan in scans_result.scalars().all():
            cand_count_result = await db.execute(
                select(func.count(Candidate.candidate_id)).where(Candidate.scan_id == scan.scan_id)
            )
            cand_count = cand_count_result.scalar() or 0
            scans.append({
                "scan_id": str(scan.scan_id),
                "file_id": str(f.file_id),
                "filename": f.filename,
                "status": scan.status,
                "candidates_found": cand_count,
                "processing_time_ms": scan.processing_time_ms,
                "error_message": scan.error_message,
                "started_at": scan.started_at.isoformat() if scan.started_at else None,
                "completed_at": scan.completed_at.isoformat() if scan.completed_at else None,
                "created_at": scan.created_at.isoformat(),
            })
    return {"scans": scans, "count": len(scans)}


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create project",
    description="Create a new project"
)
async def create_project(
    project_data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new project.
    
    Args:
        project_data: Project creation data
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Created project
    """
    try:
        # Create project
        project = Project(
            owner_user_id=current_user.user_id,
            name=project_data.name,
            description=project_data.description,
            is_private=project_data.is_private,
            vehicle_model=project_data.vehicle_model,
        )
        
        db.add(project)
        await db.commit()
        await db.refresh(project)
        
        logger.info(f"Created project {project.project_id} for user {current_user.user_id}")
        
        return {
            "project_id": str(project.project_id),
            "owner_user_id": str(project.owner_user_id),
            "name": project.name,
            "description": project.description,
            "is_private": project.is_private,
            "vehicle_model": project.vehicle_model,
            "published_at": project.published_at.isoformat() if project.published_at else None,
            "created_at": project.created_at.isoformat(),
            "updated_at": project.updated_at.isoformat(),
            "file_count": 0
        }
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to create project: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create project"
        )


@router.patch(
    "/{project_id}",
    status_code=status.HTTP_200_OK,
    summary="Update project",
    description="Update an existing project"
)
async def update_project(
    project_id: UUID,
    project_data: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update an existing project.
    
    Args:
        project_id: UUID of the project
        project_data: Project update data
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Updated project
        
    Raises:
        404: If project not found or access denied
    """
    # Get project
    result = await db.execute(
        select(Project)
        .where(
            Project.project_id == project_id,
            Project.owner_user_id == current_user.user_id,
            Project.deleted_at.is_(None)
        )
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied"
        )
    
    # Update only fields that were sent
    update_data = project_data.model_dump(exclude_unset=True)
    if "name" in update_data:
        project.name = update_data["name"]
    if "description" in update_data:
        project.description = update_data["description"]
    if "is_private" in update_data:
        project.is_private = update_data["is_private"]
        if update_data["is_private"]:
            project.published_at = None
    if "vehicle_model" in update_data:
        project.vehicle_model = update_data["vehicle_model"]
    
    try:
        await db.commit()
        await db.refresh(project)
        
        # Get file count
        file_count_result = await db.execute(
            select(func.count(FirmwareFile.file_id))
            .where(
                FirmwareFile.project_id == project_id,
                FirmwareFile.deleted_at.is_(None)
            )
        )
        file_count = file_count_result.scalar() or 0
        
        return {
            "project_id": str(project.project_id),
            "owner_user_id": str(project.owner_user_id),
            "name": project.name,
            "description": project.description,
            "is_private": project.is_private,
            "vehicle_model": project.vehicle_model,
            "published_at": project.published_at.isoformat() if project.published_at else None,
            "created_at": project.created_at.isoformat(),
            "updated_at": project.updated_at.isoformat(),
            "file_count": file_count
        }
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to update project: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update project"
        )


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete project",
    description="Soft delete a project"
)
async def delete_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Soft delete a project.
    
    Args:
        project_id: UUID of the project
        current_user: Authenticated user
        db: Database session
        
    Raises:
        404: If project not found or access denied
    """
    # Get project
    result = await db.execute(
        select(Project)
        .where(
            Project.project_id == project_id,
            Project.owner_user_id == current_user.user_id,
            Project.deleted_at.is_(None)
        )
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied"
        )
    
    # Soft delete
    project.soft_delete()
    
    try:
        await db.commit()
        logger.info(f"Deleted project {project_id} for user {current_user.user_id}")
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to delete project: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete project"
        )


@router.get(
    "/{project_id}/files",
    status_code=status.HTTP_200_OK,
    summary="Get project files",
    description="Get all files for a project"
)
async def get_project_files(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all files for a project.
    
    Args:
        project_id: UUID of the project
        current_user: Authenticated user
        db: Database session
        
    Returns:
        List of files with their latest scan status
        
    Raises:
        404: If project not found or access denied
    """
    # Verify project exists and user has access
    result = await db.execute(
        select(Project)
        .where(
            Project.project_id == project_id,
            Project.owner_user_id == current_user.user_id,
            Project.deleted_at.is_(None)
        )
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied"
        )
    
    # Get files
    files_query = (
        select(FirmwareFile)
        .where(
            FirmwareFile.project_id == project_id,
            FirmwareFile.deleted_at.is_(None)
        )
        .order_by(FirmwareFile.uploaded_at.desc())
    )
    files_result = await db.execute(files_query)
    files_list = files_result.scalars().all()
    
    # Get scan counts and latest scans for each file
    files = []
    for file in files_list:
        # Count total scans
        scan_count_result = await db.execute(
            select(func.count(ScanJob.scan_id))
            .where(ScanJob.file_id == file.file_id)
        )
        scan_count = scan_count_result.scalar() or 0
        
        # Get latest completed scan
        latest_scan_result = await db.execute(
            select(ScanJob)
            .where(
                ScanJob.file_id == file.file_id,
                ScanJob.status == 'completed'
            )
            .order_by(desc(ScanJob.created_at))
            .limit(1)
        )
        latest_scan = latest_scan_result.scalar_one_or_none()

        # Get active (queued or processing) scan if any
        active_scan_result = await db.execute(
            select(ScanJob)
            .where(
                ScanJob.file_id == file.file_id,
                ScanJob.status.in_(['queued', 'processing'])
            )
            .order_by(desc(ScanJob.created_at))
            .limit(1)
        )
        active_scan = active_scan_result.scalar_one_or_none()

        files.append({
            "file_id": str(file.file_id),
            "filename": file.filename,
            "size_bytes": file.size_bytes,
            "sha256": file.sha256,
            "uploaded_at": file.uploaded_at.isoformat(),
            "created_at": file.created_at.isoformat(),
            "updated_at": file.updated_at.isoformat(),
            "has_scan": latest_scan is not None,
            "latest_scan_id": str(latest_scan.scan_id) if latest_scan else None,
            "latest_scan_at": latest_scan.created_at.isoformat() if latest_scan else None,
            "scan_count": scan_count,
            "active_scan_id": str(active_scan.scan_id) if active_scan else None,
            "active_scan_status": active_scan.status if active_scan else None,
        })
    
    return {
        "files": files,
        "count": len(files)
    }

