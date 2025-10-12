"""JWT token creation and validation utilities.

This module provides functions for creating and validating JWT tokens
for authentication and authorization.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import HTTPException, status
from jose import JWTError, jwt

from app.config import settings


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """Create a JWT access token.

    Args:
        data: The payload data to include in the token (e.g., sub, email, role).
        expires_delta: Optional custom expiration time. If not provided,
                      uses settings.access_token_expire_minutes.

    Returns:
        Encoded JWT token string.

    Example:
        >>> token = create_access_token(
        ...     {"sub": "user-id", "email": "user@example.com", "role": "user"}
        ... )
        >>> len(token) > 0
        True
    """
    to_encode = data.copy()
    
    # Set expiration time
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.access_token_expire_minutes
        )
    
    # Add standard JWT claims
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid.uuid4()),  # JWT ID for tracking
        "type": "access",
    })
    
    # Encode the token
    encoded_jwt = jwt.encode(
        to_encode,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm
    )
    
    return encoded_jwt


def create_refresh_token(user_id: str) -> str:
    """Create a JWT refresh token for session renewal.

    Refresh tokens have a longer expiration time and minimal payload
    for security.

    Args:
        user_id: The user's unique identifier (UUID).

    Returns:
        Encoded JWT refresh token string.

    Example:
        >>> token = create_refresh_token("user-uuid-123")
        >>> len(token) > 0
        True
    """
    # Set expiration time (30 days default)
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.refresh_token_expire_days
    )
    
    # Minimal payload for security
    to_encode = {
        "sub": user_id,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid.uuid4()),
        "type": "refresh",
    }
    
    # Encode the token
    encoded_jwt = jwt.encode(
        to_encode,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm
    )
    
    return encoded_jwt


def decode_token(token: str) -> Dict[str, Any]:
    """Decode and validate a JWT token.

    Args:
        token: The JWT token string to decode.

    Returns:
        The decoded token payload as a dictionary.

    Raises:
        HTTPException: If the token is invalid, expired, or malformed.
                      Returns 401 Unauthorized with appropriate error message.

    Example:
        >>> token = create_access_token({"sub": "user-123"})
        >>> payload = decode_token(token)
        >>> payload["sub"]
        'user-123'
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm]
        )
        return payload
    
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    except jwt.JWTClaimsError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token claims are invalid",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def verify_token_type(payload: Dict[str, Any], expected_type: str) -> bool:
    """Verify the token type claim matches the expected type.

    Args:
        payload: The decoded JWT payload dictionary.
        expected_type: The expected token type ("access" or "refresh").

    Returns:
        True if the token type matches, False otherwise.

    Example:
        >>> refresh_token = create_refresh_token("user-123")
        >>> payload = decode_token(refresh_token)
        >>> verify_token_type(payload, "refresh")
        True
        >>> verify_token_type(payload, "access")
        False
    """
    token_type = payload.get("type")
    return token_type == expected_type


def get_token_jti(payload: Dict[str, Any]) -> Optional[str]:
    """Extract the JWT ID (jti) from a token payload.

    Args:
        payload: The decoded JWT payload dictionary.

    Returns:
        The JWT ID string, or None if not present.

    Example:
        >>> token = create_access_token({"sub": "user-123"})
        >>> payload = decode_token(token)
        >>> jti = get_token_jti(payload)
        >>> jti is not None
        True
    """
    return payload.get("jti")

