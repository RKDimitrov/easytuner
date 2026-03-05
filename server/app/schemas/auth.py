"""Pydantic schemas for authentication endpoints."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


# User Registration
class UserRegistration(BaseModel):
    """Schema for user registration request."""
    
    email: EmailStr = Field(
        ...,
        description="User's email address",
        examples=["user@example.com"]
    )
    password: str = Field(
        ...,
        description="User's password (minimum 12 characters)",
        examples=["MySecurePass123!"]
    )
    tos_accepted: bool = Field(
        ...,
        description="Whether user accepts Terms of Service",
        examples=[True]
    )
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "email": "user@example.com",
                "password": "MySecurePass123!",
                "tos_accepted": True
            }
        }
    }


# User Login
class UserLogin(BaseModel):
    """Schema for user login request."""
    
    email: EmailStr = Field(
        ...,
        description="User's email address",
        examples=["user@example.com"]
    )
    password: str = Field(
        ...,
        description="User's password",
        examples=["MySecurePass123!"]
    )
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "email": "user@example.com",
                "password": "MySecurePass123!"
            }
        }
    }


# Token Response
class TokenResponse(BaseModel):
    """Schema for token response after login/registration."""
    
    access_token: str = Field(
        ...,
        description="JWT access token (60 minutes expiry)"
    )
    refresh_token: str = Field(
        ...,
        description="JWT refresh token (30 days expiry)"
    )
    token_type: str = Field(
        default="bearer",
        description="Token type (always 'bearer')"
    )
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "bearer"
            }
        }
    }


# Token Refresh
class TokenRefresh(BaseModel):
    """Schema for token refresh request."""
    
    refresh_token: str = Field(
        ...,
        description="JWT refresh token"
    )
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            }
        }
    }


# Access Token Response (for refresh endpoint)
class AccessTokenResponse(BaseModel):
    """Schema for access token response after refresh."""
    
    access_token: str = Field(
        ...,
        description="New JWT access token"
    )
    token_type: str = Field(
        default="bearer",
        description="Token type (always 'bearer')"
    )
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "bearer"
            }
        }
    }


# User Response
class UserResponse(BaseModel):
    """Schema for user information response."""

    user_id: UUID = Field(
        ...,
        description="User's unique identifier"
    )
    email: str = Field(
        ...,
        description="User's email address"
    )
    role: str = Field(
        ...,
        description="User's role (user or admin)"
    )
    is_active: bool = Field(
        ...,
        description="Whether the user account is active"
    )
    last_login_at: Optional[datetime] = Field(
        None,
        description="Last successful login timestamp"
    )
    tos_accepted_at: Optional[datetime] = Field(
        None,
        description="When Terms of Service was accepted"
    )
    tos_version: Optional[int] = Field(
        None,
        description="Version of TOS accepted"
    )
    created_at: datetime = Field(
        ...,
        description="Account creation timestamp"
    )
    updated_at: datetime = Field(
        ...,
        description="Last update timestamp"
    )
    display_name: Optional[str] = Field(
        None,
        description="User's display name"
    )
    avatar_url: Optional[str] = Field(
        None,
        description="Profile picture filename (e.g. <user_id>.jpg) for URL /api/v1/avatars/<filename>"
    )

    model_config = {
        "from_attributes": True,  # Enable ORM mode
        "json_schema_extra": {
            "example": {
                "user_id": "123e4567-e89b-12d3-a456-426614174000",
                "email": "user@example.com",
                "role": "user",
                "is_active": True,
                "last_login_at": "2024-01-15T10:30:00Z",
                "tos_accepted_at": "2024-01-15T10:25:00Z",
                "tos_version": 1,
                "created_at": "2024-01-15T10:25:00Z",
                "updated_at": "2024-01-15T10:30:00Z",
                "display_name": "John",
                "avatar_url": "123e4567-e89b-12d3-a456-426614174000.jpg"
            }
        }
    }


# Profile Update (display name only; avatar is updated via separate upload)
class ProfileUpdate(BaseModel):
    """Schema for updating user profile."""

    display_name: Optional[str] = Field(
        None,
        max_length=100,
        description="Display name (null to leave unchanged)"
    )


# Password Change
class PasswordChange(BaseModel):
    """Schema for password change request."""
    
    current_password: str = Field(
        ...,
        description="User's current password"
    )
    new_password: str = Field(
        ...,
        min_length=12,
        description="New password (minimum 12 characters)"
    )
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "current_password": "MyOldPassword123!",
                "new_password": "MyNewPassword456!"
            }
        }
    }


# Terms of Service Acceptance
class TOSAcceptance(BaseModel):
    """Schema for Terms of Service acceptance."""
    
    tos_version: int = Field(
        ...,
        ge=1,
        description="Version of TOS being accepted"
    )
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "tos_version": 1
            }
        }
    }


# Success Message
class MessageResponse(BaseModel):
    """Schema for generic success/error message response."""
    
    message: str = Field(
        ...,
        description="Success or error message"
    )
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "message": "Operation completed successfully"
            }
        }
    }

