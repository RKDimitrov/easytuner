"""
Project endpoints for managing user projects.
"""
import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.project import Project
from app.models.firmware_file import FirmwareFile
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["projects"])


# Request/Response schemas
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_private: bool = True


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_private: Optional[bool] = None


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
        "created_at": project.created_at.isoformat(),
        "updated_at": project.updated_at.isoformat(),
        "file_count": file_count or 0
    }


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
            is_private=project_data.is_private
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
    
    # Update fields
    if project_data.name is not None:
        project.name = project_data.name
    if project_data.description is not None:
        project.description = project_data.description
    if project_data.is_private is not None:
        project.is_private = project_data.is_private
    
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

