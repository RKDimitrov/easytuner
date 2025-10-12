"""FastAPI authentication dependencies for protected routes.

This module provides dependency functions for authenticating and authorizing
users in FastAPI endpoints.
"""

from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import decode_token, verify_token_type
from app.database import get_db
from app.models.user import User

# HTTPBearer security scheme for extracting Bearer tokens
security = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Get the current authenticated user from JWT token.

    Extracts the Bearer token from the Authorization header, validates it,
    and fetches the corresponding user from the database.

    Args:
        credentials: HTTP Authorization credentials with Bearer token.
        db: Database session.

    Returns:
        The authenticated User model instance.

    Raises:
        HTTPException:
            - 401: If token is invalid, expired, or user not found
            - 403: If user account is inactive

    Example:
        ```python
        @router.get("/profile")
        async def get_profile(
            current_user: User = Depends(get_current_user)
        ):
            return {"email": current_user.email}
        ```
    """
    # Extract token from credentials
    token = credentials.credentials

    # Decode and validate JWT token (raises HTTPException if invalid)
    payload = decode_token(token)

    # Verify it's an access token
    if not verify_token_type(payload, "access"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extract user ID from token
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing user identifier",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Convert to UUID
    try:
        user_id = UUID(user_id_str)
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user identifier in token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Fetch user from database
    result = await db.execute(
        select(User).where(User.user_id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """Get the current authenticated and active user.

    This is a convenience dependency that explicitly checks for active status.
    Note: get_current_user already checks for active status, so this is
    somewhat redundant but provides clearer semantics.

    Args:
        current_user: The authenticated user from get_current_user.

    Returns:
        The authenticated and active User model instance.

    Raises:
        HTTPException: 403 if user is not active.

    Example:
        ```python
        @router.post("/upload")
        async def upload_file(
            current_user: User = Depends(get_current_active_user)
        ):
            return {"message": "Upload successful"}
        ```
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )
    return current_user


async def get_current_admin_user(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """Get the current authenticated user and verify admin role.

    Args:
        current_user: The authenticated user from get_current_user.

    Returns:
        The authenticated User model instance with admin role.

    Raises:
        HTTPException: 403 if user is not an admin.

    Example:
        ```python
        @router.delete("/users/{user_id}")
        async def delete_user(
            user_id: str,
            admin: User = Depends(get_current_admin_user)
        ):
            return {"message": "User deleted"}
        ```
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user


async def require_tos_accepted(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """Require that the current user has accepted Terms of Service.

    Args:
        current_user: The authenticated user from get_current_user.

    Returns:
        The authenticated User model instance who has accepted TOS.

    Raises:
        HTTPException: 403 if user has not accepted Terms of Service.

    Example:
        ```python
        @router.post("/projects")
        async def create_project(
            project_data: ProjectCreate,
            current_user: User = Depends(require_tos_accepted)
        ):
            return {"message": "Project created"}
        ```
    """
    if current_user.tos_accepted_at is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Terms of Service acceptance required",
        )
    return current_user


# Type aliases for cleaner dependency injection
CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentActiveUser = Annotated[User, Depends(get_current_active_user)]
CurrentAdminUser = Annotated[User, Depends(get_current_admin_user)]
TOSAcceptedUser = Annotated[User, Depends(require_tos_accepted)]

