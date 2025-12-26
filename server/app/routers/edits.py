"""API endpoints for editing firmware files."""

import hashlib
import logging
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.firmware_file import FirmwareFile
from app.models.project import Project
from app.models.user import User
from app.schemas.edit import (
    EditBatchRequest,
    EditHistoryEntry,
    EditHistoryResponse,
    EditOperation,
    EditResponse,
)
from app.services.edit_service import edit_service
from app.services.file_storage import file_storage
from app.services.scan_service import scan_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/files", tags=["edits"])


@router.post(
    "/{file_id}/edits",
    response_model=EditResponse,
    status_code=status.HTTP_200_OK,
    summary="Apply edits to a firmware file",
    description="Apply one or more edits to a firmware file and optionally create a new version"
)
async def apply_edits(
    file_id: UUID,
    request: EditBatchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Apply edits to a firmware file.
    
    Args:
        file_id: UUID of the file to edit
        request: Batch edit request
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Edit response with new file ID if new version created
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
    original_file = result.scalar_one_or_none()
    
    if not original_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or access denied"
        )
    
    # Validate edits
    if not request.edits:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No edits provided"
        )
    
    try:
        # Apply edits
        modified_data, errors = edit_service.apply_edits(file_id, request.edits)
        
        if errors:
            # Some edits failed
            error_messages = [f"Edit {i}: {msg}" for i, msg in errors]
            logger.warning(f"Some edits failed for file {file_id}: {error_messages}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Some edits failed: {'; '.join(error_messages)}"
            )
        
        # Calculate new hash
        new_hash = hashlib.sha256(modified_data).hexdigest()
        
        # Determine if we should create a new file or overwrite
        if request.create_new_version:
            # Create new file version
            new_file_id = uuid4()
            
            # Generate new filename with version number
            original_name = original_file.filename
            
            # Check if this is already a modified file (has version pattern)
            import re
            version_match = re.search(r'_v(\d+)$', original_name.rsplit('.', 1)[0] if '.' in original_name else original_name)
            
            if version_match:
                # Increment version number
                current_version = int(version_match.group(1))
                new_version = current_version + 1
                if '.' in original_name:
                    name, ext = original_name.rsplit('.', 1)
                    base_name = re.sub(r'_v\d+$', '', name)
                    new_filename = f"{base_name}_v{new_version}.{ext}"
                else:
                    base_name = re.sub(r'_v\d+$', '', original_name)
                    new_filename = f"{base_name}_v{new_version}"
            else:
                # First modification - create v2 (original is v1)
                if '.' in original_name:
                    name, ext = original_name.rsplit('.', 1)
                    new_filename = f"{name}_v2.{ext}"
                else:
                    new_filename = f"{original_name}_v2"
            
            # Save new file
            storage_path = file_storage.save_file(new_file_id, bytes(modified_data))
            
            # Create database record
            new_file = FirmwareFile(
                file_id=new_file_id,
                project_id=original_file.project_id,
                filename=new_filename,
                size_bytes=len(modified_data),
                sha256=new_hash,
                storage_path=storage_path,
                endianness_hint=original_file.endianness_hint
            )
            
            db.add(new_file)
            await db.commit()
            await db.refresh(new_file)
            
            # Copy scan results from original file to new file
            # Map locations don't change, so we can reuse the scan results
            try:
                copied_scan = await scan_service.copy_scan_results(
                    db=db,
                    source_file_id=file_id,
                    target_file_id=new_file_id,
                    user_id=current_user.user_id
                )
                if copied_scan:
                    logger.info(
                        f"Copied scan results to new file {new_file_id} "
                        f"(inherited from {file_id})"
                    )
            except Exception as e:
                # Don't fail the edit operation if scan copy fails
                logger.warning(
                    f"Failed to copy scan results to new file {new_file_id}: {e}",
                    exc_info=True
                )
            
            logger.info(
                f"Created new file version {new_file_id} from {file_id} "
                f"with {len(request.edits)} edits"
            )
            
            return EditResponse(
                success=True,
                file_id=new_file_id,
                original_file_id=file_id,
                edits_applied=len(request.edits),
                file_size=len(modified_data)
            )
        else:
            # Overwrite original (not recommended, but supported)
            # Update file in storage
            file_storage.save_file(file_id, bytes(modified_data))
            
            # Update database record
            original_file.size_bytes = len(modified_data)
            original_file.sha256 = new_hash
            
            await db.commit()
            await db.refresh(original_file)
            
            logger.info(
                f"Overwritten file {file_id} with {len(request.edits)} edits"
            )
            
            return EditResponse(
                success=True,
                file_id=file_id,
                original_file_id=None,
                edits_applied=len(request.edits),
                file_size=len(modified_data)
            )
            
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Edit validation error for file {file_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to apply edits to file {file_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to apply edits"
        )


@router.get(
    "/{file_id}/read-value",
    summary="Read a value from a file",
    description="Read a value at a specific offset with a given data type"
)
async def read_value(
    file_id: UUID,
    offset: int,
    data_type: str = "u8",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Read a value from a file at a specific offset.
    
    Args:
        file_id: UUID of the file
        offset: Byte offset
        data_type: Data type (u8, u16le, u16be, u32le, u32be)
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Value at the offset
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
        # Read file
        file_data = file_storage.read_file(file_id)
        
        # Read value
        value, success, error = edit_service.read_value(file_data, offset, data_type)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error
            )
        
        return {
            "offset": offset,
            "value": value,
            "value_hex": f"0x{value:X}",
            "data_type": data_type
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to read value from file {file_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to read value"
        )

