"""Authentication service for user registration and login."""

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import create_access_token, create_refresh_token, decode_token, verify_token_type
from app.auth.password import hash_password, validate_password_strength, verify_password
from app.config import settings
from app.models.session import Session
from app.models.user import User
from app.schemas.auth import AccessTokenResponse, TokenResponse, UserRegistration


class AuthService:
    """Service class for authentication operations."""

    def __init__(self, db: AsyncSession):
        """Initialize AuthService with database session.

        Args:
            db: Async database session
        """
        self.db = db

    async def register_user(
        self,
        registration: UserRegistration,
        tos_version: int = 1
    ) -> User:
        """Register a new user.

        Args:
            registration: User registration data
            tos_version: Version of Terms of Service (default: 1)

        Returns:
            Created User instance

        Raises:
            HTTPException:
                - 400: Password is too weak or email already registered
        """
        # Validate password strength
        is_valid, error_message = validate_password_strength(registration.password)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Password validation failed: {error_message}"
            )

        # Check if TOS is accepted
        if not registration.tos_accepted:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Terms of Service must be accepted"
            )

        # Check if email already exists
        result = await self.db.execute(
            select(User).where(User.email == registration.email)
        )
        existing_user = result.scalar_one_or_none()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email address is already registered"
            )

        # Hash the password
        password_hash = hash_password(registration.password)

        # Create new user
        user = User(
            email=registration.email,
            password_hash=password_hash,
            role="user",
            is_active=True,
            tos_accepted_at=datetime.utcnow() if registration.tos_accepted else None,
            tos_version=tos_version if registration.tos_accepted else None,
        )

        try:
            self.db.add(user)
            await self.db.commit()
            await self.db.refresh(user)
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email address is already registered"
            )

        return user

    async def authenticate_user(
        self,
        email: str,
        password: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> TokenResponse:
        """Authenticate a user and generate tokens.

        Args:
            email: User's email address
            password: User's password
            ip_address: Client IP address (optional)
            user_agent: Client user agent (optional)

        Returns:
            TokenResponse with access and refresh tokens

        Raises:
            HTTPException:
                - 401: Invalid credentials or user not found
                - 403: User account is inactive
        """
        # Find user by email
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        user = result.scalar_one_or_none()

        # Verify user exists and password is correct
        if not user or not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        # Check if user is active
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive"
            )

        # Update last login timestamp
        user.last_login_at = datetime.utcnow()

        # Create access and refresh tokens
        access_token = create_access_token({
            "sub": str(user.user_id),
            "email": user.email,
            "role": user.role,
        })

        refresh_token = create_refresh_token(str(user.user_id))

        # Hash refresh token for storage (using SHA-256)
        refresh_token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()

        # Calculate session expiration (same as refresh token expiration)
        # Using timezone-aware datetime for PostgreSQL TIMESTAMPTZ
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)

        # Create session record
        session = Session(
            user_id=user.user_id,
            refresh_token_hash=refresh_token_hash,
            expires_at=expires_at,
            ip_address=ip_address or "unknown",
            user_agent=user_agent or "unknown",
        )

        try:
            self.db.add(session)
            await self.db.commit()
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create session: {str(e)}"
            )

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer"
        )

    async def get_user_by_id(self, user_id: UUID) -> Optional[User]:
        """Get user by ID.

        Args:
            user_id: User's unique identifier

        Returns:
            User instance or None if not found
        """
        result = await self.db.execute(
            select(User).where(User.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email.

        Args:
            email: User's email address

        Returns:
            User instance or None if not found
        """
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()

    async def refresh_tokens(
        self,
        refresh_token: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> TokenResponse:
        """Refresh access and refresh tokens using a valid refresh token.

        Args:
            refresh_token: The current refresh token
            ip_address: Client IP address (optional)
            user_agent: Client user agent (optional)

        Returns:
            TokenResponse with new access and refresh tokens

        Raises:
            HTTPException:
                - 401: Invalid or expired refresh token, session not found
                - 403: User account is inactive
        """
        # Decode and validate refresh token
        payload = decode_token(refresh_token)

        # Verify it's a refresh token
        if not verify_token_type(payload, "refresh"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type, expected refresh token"
            )

        # Extract user ID
        user_id_str = payload.get("sub")
        if not user_id_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing user identifier"
            )

        try:
            user_id = UUID(user_id_str)
        except (ValueError, AttributeError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid user identifier in token"
            )

        # Hash the refresh token to look up in database
        refresh_token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()

        # Find the session
        result = await self.db.execute(
            select(Session).where(
                Session.user_id == user_id,
                Session.refresh_token_hash == refresh_token_hash
            )
        )
        session = result.scalar_one_or_none()

        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session not found or token has been revoked"
            )

        # Check if session has expired
        # Use timezone-aware datetime for comparison
        if session.expires_at < datetime.now(timezone.utc):
            # Clean up expired session
            await self.db.delete(session)
            await self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has expired"
            )

        # Fetch user
        user = await self.get_user_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )

        # Check if user is active
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive"
            )

        # Create new access and refresh tokens
        new_access_token = create_access_token({
            "sub": str(user.user_id),
            "email": user.email,
            "role": user.role,
        })

        new_refresh_token = create_refresh_token(str(user.user_id))

        # Hash new refresh token
        new_refresh_token_hash = hashlib.sha256(new_refresh_token.encode()).hexdigest()

        # Update session with new refresh token hash
        session.refresh_token_hash = new_refresh_token_hash
        session.expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
        
        # Update session metadata if provided
        if ip_address:
            session.ip_address = ip_address
        if user_agent:
            session.user_agent = user_agent

        try:
            await self.db.commit()
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update session: {str(e)}"
            )

        return TokenResponse(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            token_type="bearer"
        )

    async def logout(self, user_id: UUID, refresh_token: str) -> None:
        """Logout user by invalidating session.

        Args:
            user_id: User's unique identifier
            refresh_token: Refresh token to invalidate

        Raises:
            HTTPException:
                - 401: Session not found or already logged out
        """
        # Hash the refresh token to look up in database
        refresh_token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()

        # Find the session
        result = await self.db.execute(
            select(Session).where(
                Session.user_id == user_id,
                Session.refresh_token_hash == refresh_token_hash
            )
        )
        session = result.scalar_one_or_none()

        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session not found or already logged out"
            )

        # Delete the session
        await self.db.delete(session)
        await self.db.commit()

    async def cleanup_expired_sessions(self) -> int:
        """Clean up expired sessions from the database.

        Returns:
            Number of sessions deleted
        """
        # Find all expired sessions
        # Use timezone-aware datetime for comparison
        result = await self.db.execute(
            select(Session).where(Session.expires_at < datetime.now(timezone.utc))
        )
        expired_sessions = result.scalars().all()

        count = len(expired_sessions)

        # Delete expired sessions
        for session in expired_sessions:
            await self.db.delete(session)

        await self.db.commit()

        return count

