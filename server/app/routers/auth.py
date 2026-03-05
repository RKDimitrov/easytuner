"""Authentication API endpoints."""

import re
from pathlib import Path
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    PasswordChange,
    ProfileUpdate,
    TokenRefresh,
    TokenResponse,
    UserLogin,
    UserRegistration,
    UserResponse,
)
from app.services.auth_service import AuthService

router = APIRouter(
    prefix="/auth",
    tags=["authentication"],
)

# Safe avatar filename: <uuid>.<ext> only (no path traversal)
AVATAR_FILENAME_RE = re.compile(r"^[0-9a-fA-F-]{36}\.(jpe?g|png|webp)$")


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register new user",
    description="Create a new user account and receive access and refresh tokens",
)
async def register(
    registration: UserRegistration,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """Register a new user account and authenticate them.

    Args:
        registration: User registration data (email, password, tos_accepted)
        request: FastAPI request object (for IP and user agent)
        db: Database session

    Returns:
        Access and refresh tokens

    Raises:
        400: If password is weak, email is already registered, or TOS not accepted
    """
    # Extract client information
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    auth_service = AuthService(db)
    return await auth_service.register_and_authenticate_user(
        registration=registration,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="User login",
    description="Authenticate user and receive access and refresh tokens",
)
async def login(
    credentials: UserLogin,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """Authenticate user and generate tokens.

    Args:
        credentials: User login credentials (email, password)
        request: FastAPI request object (for IP and user agent)
        db: Database session

    Returns:
        Access and refresh tokens

    Raises:
        401: If credentials are invalid
        403: If user account is inactive
    """
    # Extract client information
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    auth_service = AuthService(db)
    return await auth_service.authenticate_user(
        email=credentials.email,
        password=credentials.password,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user",
    description="Get information about the currently authenticated user",
)
async def get_current_user_info(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserResponse:
    """Get current authenticated user information.

    Args:
        current_user: Authenticated user from dependency

    Returns:
        Current user information
    """
    return UserResponse.model_validate(current_user)


@router.patch(
    "/me",
    response_model=UserResponse,
    summary="Update profile",
    description="Update the current user's profile (e.g. display name)",
)
async def update_profile(
    body: ProfileUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    """Update current user profile."""
    if body.display_name is not None:
        current_user.display_name = body.display_name.strip() or None
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


def _avatars_dir() -> Path:
    """Return the absolute path to the avatars directory."""
    upload_path = Path(settings.upload_dir)
    if not upload_path.is_absolute():
        server_root = Path(__file__).parent.parent.parent
        base = server_root / upload_path
    else:
        base = upload_path
    avatars_dir = base / "avatars"
    avatars_dir.mkdir(parents=True, exist_ok=True)
    return avatars_dir


@router.post(
    "/me/avatar",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload profile picture",
    description="Upload or replace the current user's profile picture. Max size and dimensions apply.",
)
async def upload_avatar(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(..., description="Image file (JPEG, PNG, WebP)"),
) -> UserResponse:
    """Upload or replace the current user's avatar. Validates type and size."""
    if not file.content_type or file.content_type not in settings.allowed_avatar_content_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {settings.allowed_avatar_content_types}",
        )
    content = await file.read()
    if len(content) > settings.avatar_max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size is {settings.avatar_max_size_mb} MB.",
        )
    ext = "jpg" if file.content_type == "image/jpeg" else "png" if file.content_type == "image/png" else "webp"
    filename = f"{current_user.user_id}.{ext}"
    avatars_dir = _avatars_dir()
    path = avatars_dir / filename
    path.write_bytes(content)
    current_user.avatar_url = filename
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.delete(
    "/me/avatar",
    response_model=UserResponse,
    summary="Remove profile picture",
    description="Remove the current user's profile picture",
)
async def remove_avatar(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    """Remove current user's avatar."""
    if current_user.avatar_url:
        avatars_dir = _avatars_dir()
        path = avatars_dir / current_user.avatar_url
        if path.is_file():
            path.unlink()
        current_user.avatar_url = None
        db.add(current_user)
        await db.commit()
        await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.get(
    "/avatars/{filename}",
    response_class=FileResponse,
    summary="Get avatar image",
    description="Serve a user's profile picture by filename (public).",
)
async def get_avatar(filename: str) -> FileResponse:
    """Serve avatar image. Filename must be <uuid>.<ext> for security."""
    if not AVATAR_FILENAME_RE.match(filename):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    avatars_dir = _avatars_dir()
    path = avatars_dir / filename
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    media_type = "image/jpeg" if filename.lower().endswith((".jpg", ".jpeg")) else "image/png" if filename.lower().endswith(".png") else "image/webp"
    return FileResponse(path, media_type=media_type)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token",
    description="Get new access and refresh tokens using a valid refresh token",
)
async def refresh_token(
    token_data: TokenRefresh,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """Refresh access and refresh tokens.

    Args:
        token_data: Refresh token data
        request: FastAPI request object
        db: Database session

    Returns:
        New access and refresh tokens

    Raises:
        401: If refresh token is invalid or expired
        403: If user account is inactive
    """
    # Extract client information
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    auth_service = AuthService(db)
    return await auth_service.refresh_tokens(
        refresh_token=token_data.refresh_token,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.post(
    "/change-password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Change password",
    description="Change the authenticated user's password",
)
async def change_password(
    body: PasswordChange,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Change the current user's password.

    Args:
        body: Current and new password
        current_user: Authenticated user from dependency
        db: Database session

    Raises:
        401: Current password is incorrect
        400: New password fails strength validation (min 12 chars, etc.)
    """
    auth_service = AuthService(db)
    await auth_service.change_password(
        user_id=current_user.user_id,
        current_password=body.current_password,
        new_password=body.new_password,
    )


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Logout user",
    description="Invalidate the current session by removing it from the database",
)
async def logout(
    token_data: TokenRefresh,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Logout user and invalidate session.

    Args:
        token_data: Refresh token to invalidate
        current_user: Authenticated user from dependency
        db: Database session

    Raises:
        401: If session not found or already logged out
    """
    auth_service = AuthService(db)
    await auth_service.logout(
        user_id=current_user.user_id,
        refresh_token=token_data.refresh_token
    )

