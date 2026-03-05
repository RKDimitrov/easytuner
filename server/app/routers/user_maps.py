"""Routes for user-defined maps (My Maps) per firmware file."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import FirmwareFile, User, UserMap
from app.schemas.user_map import (
    UserMapCreateRequest,
    UserMapPayload,
    UserMapResponse,
)

router = APIRouter(prefix="/files/{file_id}/user-maps", tags=["user-maps"])


async def _get_file_for_user(
    file_id: UUID,
    current_user: User,
    db: AsyncSession,
) -> FirmwareFile:
    stmt = (
        select(FirmwareFile)
        .where(
            FirmwareFile.file_id == file_id,
            FirmwareFile.deleted_at.is_(None),
        )
        .options(selectinload(FirmwareFile.project))
    )
    result = await db.execute(stmt)
    file = result.scalar_one_or_none()
    if file is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found",
        )
    # Basic ownership enforcement – only project owner can see/edit user maps
    if file.project.owner_user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access maps for this file",
        )
    return file


def _payload_to_user_map_fields(
    payload: UserMapPayload,
) -> dict:
    """Convert the loose payload into indexed fields and config."""
    dimensions = payload.dimensions or {}
    config = dict(payload.config)
    # Ensure core fields are mirrored into config so the client can round-trip
    config.update(
        {
            "type": payload.type,
            "offset": payload.offset,
            "size": payload.size,
            "dataType": payload.dataType or "u16le",
            "dimensions": dimensions,
            "name": payload.name,
            "description": payload.description,
            "unit": payload.unit,
        }
    )
    return {
        "name": payload.name,
        "type": payload.type,
        "byte_offset_start": payload.offset,
        "size_bytes": payload.size,
        "data_type": payload.dataType or "u16le",
        "dimensions": dimensions,
        "config": config,
    }


def _user_map_to_response(um: UserMap) -> UserMapResponse:
    base = {
        "id": str(um.user_map_id),
        "file_id": um.file_id,
        "project_id": um.project_id,
        "type": um.type,
        "offset": um.byte_offset_start,
        "size": um.size_bytes,
        "dataType": um.data_type,
        "dimensions": um.dimensions or {},
        "name": um.name,
        "description": (um.config or {}).get("description"),
        "unit": (um.config or {}).get("unit"),
        "config": um.config or {},
    }
    return UserMapResponse(**base)


@router.get(
    "",
    response_model=list[UserMapResponse],
    summary="List user-defined maps for a file",
)
async def list_user_maps_for_file(
    file_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[UserMapResponse]:
    """Return all user-defined maps for the given file for the current user."""
    file = await _get_file_for_user(file_id, current_user, db)
    await db.refresh(file, attribute_names=["user_maps"])
    return [_user_map_to_response(um) for um in file.user_maps if um.user_id == current_user.user_id]


@router.post(
    "",
    response_model=UserMapResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create or update a user-defined map for a file",
)
async def upsert_user_map_for_file(
    file_id: UUID,
    request: UserMapCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserMapResponse:
    """Create a new user map, or update an existing one if id matches."""
    file = await _get_file_for_user(file_id, current_user, db)
    payload = request.map

    # Try to find existing user_map owned by this user with the same id (if provided)
    existing: UserMap | None = None
    if payload.id:
        stmt = select(UserMap).where(
            UserMap.user_map_id == payload.id,
            UserMap.file_id == file.file_id,
            UserMap.user_id == current_user.user_id,
        )
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()

    fields = _payload_to_user_map_fields(payload)

    if existing is None:
        um = UserMap(
            project_id=file.project_id,
            file_id=file.file_id,
            user_id=current_user.user_id,
            **fields,
        )
        db.add(um)
    else:
        for key, value in fields.items():
            setattr(existing, key, value)
        um = existing

    await db.commit()
    await db.refresh(um)
    return _user_map_to_response(um)

