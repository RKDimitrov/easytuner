"""Authentication API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.auth import MessageResponse, TokenRefresh, TokenResponse, UserLogin, UserRegistration, UserResponse
from app.services.auth_service import AuthService

router = APIRouter(
    prefix="/auth",
    tags=["authentication"],
)


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

