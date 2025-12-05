"""
File upload and download endpoints.
"""
import hashlib
import logging
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.config import settings
from app.database import get_db
from app.models.firmware_file import FirmwareFile
from app.models.project import Project
from app.models.user import User
from app.services.file_storage import file_storage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/files", tags=["files"])


@router.post(
    "/upload",
    status_code=status.HTTP_201_CREATED,
    summary="Upload a firmware file",
    description="Upload a firmware file to a project"
)
async def upload_file(
    project_id: UUID = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload a firmware file to a project.
    
    Args:
        project_id: UUID of the project to upload to
        file: The file to upload
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Created firmware file metadata
        
    Raises:
        400: If file is too large or invalid
        404: If project not found or access denied
        500: If upload fails
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
    
    # Validate file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in settings.allowed_file_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File extension {file_ext} not allowed. Allowed: {settings.allowed_file_extensions}"
        )
    
    # Read file content
    try:
        file_content = await file.read()
    except Exception as e:
        logger.error(f"Failed to read uploaded file: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to read file"
        )
    
    # Validate file size
    if len(file_content) > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size: {settings.max_upload_size_mb}MB"
        )
    
    # Calculate SHA-256 hash
    file_hash = hashlib.sha256(file_content).hexdigest()
    
    # Check for duplicate file (same hash in same project)
    result = await db.execute(
        select(FirmwareFile)
        .where(
            FirmwareFile.project_id == project_id,
            FirmwareFile.sha256 == file_hash,
            FirmwareFile.deleted_at.is_(None)
        )
    )
    existing_file = result.scalar_one_or_none()
    
    if existing_file:
        logger.info(f"File with hash {file_hash[:16]}... already exists: {existing_file.file_id}")
        return {
            "file_id": str(existing_file.file_id),
            "filename": existing_file.filename,
            "size_bytes": existing_file.size_bytes,
            "sha256": existing_file.sha256,
            "uploaded_at": existing_file.uploaded_at.isoformat(),
            "duplicate": True
        }
    
    # Create file record
    file_id = uuid4()
    
    try:
        # Save file to storage
        storage_path = file_storage.save_file(file_id, file_content)
        
        # Create database record
        firmware_file = FirmwareFile(
            file_id=file_id,
            project_id=project_id,
            filename=file.filename or "unnamed.bin",
            size_bytes=len(file_content),
            sha256=file_hash,
            storage_path=storage_path
        )
        
        db.add(firmware_file)
        await db.commit()
        await db.refresh(firmware_file)
        
        logger.info(f"Uploaded file {file_id} ({file.filename}, {len(file_content)} bytes) to project {project_id}")
        
        return {
            "file_id": str(firmware_file.file_id),
            "filename": firmware_file.filename,
            "size_bytes": firmware_file.size_bytes,
            "sha256": firmware_file.sha256,
            "uploaded_at": firmware_file.uploaded_at.isoformat(),
            "duplicate": False
        }
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to upload file: {e}", exc_info=True)
        # Try to clean up storage if file was saved but DB commit failed
        try:
            file_storage.delete_file(file_id)
        except:
            pass
        error_detail = str(e) if str(e) else "Failed to upload file"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_detail
        )


@router.get(
    "/{file_id}",
    summary="Download a firmware file",
    description="Download a firmware file by ID"
)
async def download_file(
    file_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Download a firmware file.
    
    Args:
        file_id: UUID of the file to download
        current_user: Authenticated user
        db: Database session
        
    Returns:
        File content as binary response
        
    Raises:
        404: If file not found or access denied
        500: If file read fails
    """
    # Verify file exists and user has access
    result = await db.execute(
        select(FirmwareFile)
        .join(FirmwareFile.project)
        .where(
            FirmwareFile.file_id == file_id,
            Project.owner_user_id == current_user.user_id,
            FirmwareFile.deleted_at.is_(None)
        )
    )
    firmware_file = result.scalar_one_or_none()
    
    if not firmware_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or access denied"
        )
    
    try:
        # Read file from storage
        file_content = file_storage.read_file(file_id)
        
        return Response(
            content=file_content,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{firmware_file.filename}"',
                "Content-Length": str(len(file_content))
            }
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found in storage"
        )
    except Exception as e:
        logger.error(f"Failed to read file {file_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to read file"
        )


@router.get(
    "/{file_id}/metadata",
    summary="Get file metadata",
    description="Get metadata for a firmware file"
)
async def get_file_metadata(
    file_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get metadata for a firmware file.
    
    Args:
        file_id: UUID of the file
        current_user: Authenticated user
        db: Database session
        
    Returns:
        File metadata
        
    Raises:
        404: If file not found or access denied
    """
    # Verify file exists and user has access
    result = await db.execute(
        select(FirmwareFile)
        .join(FirmwareFile.project)
        .where(
            FirmwareFile.file_id == file_id,
            Project.owner_user_id == current_user.user_id,
            FirmwareFile.deleted_at.is_(None)
        )
    )
    firmware_file = result.scalar_one_or_none()
    
    if not firmware_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or access denied"
        )
    
    return {
        "file_id": str(firmware_file.file_id),
        "filename": firmware_file.filename,
        "size_bytes": firmware_file.size_bytes,
        "sha256": firmware_file.sha256,
        "project_id": str(firmware_file.project_id),
        "uploaded_at": firmware_file.uploaded_at.isoformat(),
        "created_at": firmware_file.created_at.isoformat(),
        "updated_at": firmware_file.updated_at.isoformat()
    }

