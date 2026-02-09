"""API endpoints for checksum operations."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.firmware_file import FirmwareFile
from app.models.project import Project
from app.models.user import User
from app.schemas.checksum import (
    ChecksumConfigRequest,
    ChecksumUpdateResponse,
    ChecksumValidationResponse,
)
from app.services.checksum_service import ChecksumAlgorithm as ChecksumAlgorithmEnum, ChecksumConfig, checksum_service
from app.services.file_storage import file_storage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/files", tags=["checksum"])


def _convert_algorithm(algorithm: str) -> ChecksumAlgorithmEnum:
    """Convert string algorithm to enum."""
    algorithm_map = {
        "simple_sum": ChecksumAlgorithmEnum.SIMPLE_SUM,
        "crc16": ChecksumAlgorithmEnum.CRC16,
        "crc32": ChecksumAlgorithmEnum.CRC32,
        "xor": ChecksumAlgorithmEnum.XOR,
        "twos_complement": ChecksumAlgorithmEnum.TWOS_COMPLEMENT,
        "modular": ChecksumAlgorithmEnum.MODULAR,
        "ones_complement": ChecksumAlgorithmEnum.ONES_COMPLEMENT,
        "modular_16bit": ChecksumAlgorithmEnum.MODULAR_16BIT,
        "ones_complement_16bit": ChecksumAlgorithmEnum.ONES_COMPLEMENT_16BIT,
        "modular_16bit_be": ChecksumAlgorithmEnum.MODULAR_16BIT_BE,
        "ones_complement_16bit_be": ChecksumAlgorithmEnum.ONES_COMPLEMENT_16BIT_BE,
    }
    
    if algorithm not in algorithm_map:
        raise ValueError(f"Unknown algorithm: {algorithm}")
    
    return algorithm_map[algorithm]


@router.post(
    "/{file_id}/checksum/validate",
    response_model=ChecksumValidationResponse,
    summary="Validate checksum",
    description="Validate the checksum in a firmware file"
)
async def validate_checksum(
    file_id: UUID,
    config: ChecksumConfigRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Validate checksum in a firmware file.
    
    Args:
        file_id: UUID of the file
        config: Checksum configuration
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Validation result with stored and calculated checksums
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
        
        # Convert request to service config
        exclude_ranges = None
        if config.exclude_ranges:
            exclude_ranges = [(r.start, r.end) for r in config.exclude_ranges]
        
        checksum_config = ChecksumConfig(
            algorithm=_convert_algorithm(config.algorithm),
            checksum_range=(config.checksum_range.start, config.checksum_range.end),
            checksum_location=config.checksum_location,
            checksum_size=config.checksum_size,
            endianness=config.endianness,
            exclude_ranges=exclude_ranges,
            modulo=config.modulo
        )
        
        # Validate checksum
        is_valid, stored, calculated = checksum_service.validate_checksum(file_data, checksum_config)
        
        return ChecksumValidationResponse(
            is_valid=is_valid,
            stored_checksum=stored,
            calculated_checksum=calculated,
            stored_checksum_hex=f"0x{stored:X}",
            calculated_checksum_hex=f"0x{calculated:X}",
            checksum_location=config.checksum_location
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to validate checksum for file {file_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to validate checksum"
        )


@router.post(
    "/{file_id}/checksum/update",
    response_model=ChecksumUpdateResponse,
    summary="Update checksum",
    description="Calculate and update checksum in a firmware file"
)
async def update_checksum(
    file_id: UUID,
    config: ChecksumConfigRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update checksum in a firmware file.
    
    Args:
        file_id: UUID of the file
        config: Checksum configuration
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Update result with new checksum value
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
        file_data = bytearray(file_storage.read_file(file_id))
        
        # Convert request to service config
        exclude_ranges = None
        if config.exclude_ranges:
            exclude_ranges = [(r.start, r.end) for r in config.exclude_ranges]
        
        checksum_config = ChecksumConfig(
            algorithm=_convert_algorithm(config.algorithm),
            checksum_range=(config.checksum_range.start, config.checksum_range.end),
            checksum_location=config.checksum_location,
            checksum_size=config.checksum_size,
            endianness=config.endianness,
            exclude_ranges=exclude_ranges,
            modulo=config.modulo
        )
        
        # Calculate checksum before update
        old_checksum = checksum_service.calculate_checksum(bytes(file_data), checksum_config)
        
        # Update checksum
        checksum_service.update_checksum(file_data, checksum_config)
        
        # Calculate new checksum to verify
        new_checksum = checksum_service.calculate_checksum(bytes(file_data), checksum_config)
        
        # Save updated file
        file_storage.save_file(file_id, bytes(file_data))
        
        # Update file hash in database
        import hashlib
        new_hash = hashlib.sha256(file_data).hexdigest()
        firmware_file.sha256 = new_hash
        await db.commit()
        
        logger.info(
            f"Updated checksum for file {file_id}: "
            f"0x{old_checksum:X} -> 0x{new_checksum:X}"
        )
        
        return ChecksumUpdateResponse(
            success=True,
            checksum_value=new_checksum,
            checksum_value_hex=f"0x{new_checksum:X}",
            checksum_location=config.checksum_location,
            message=f"Checksum updated successfully: 0x{new_checksum:X}"
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to update checksum for file {file_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update checksum"
        )

