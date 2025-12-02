"""Integration tests for authentication dependencies."""

from datetime import datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import Depends, FastAPI
from httpx import AsyncClient

from app.auth.dependencies import (
    get_current_admin_user,
    get_current_user,
    require_tos_accepted,
)
from app.auth.jwt import create_access_token
from app.auth.password import hash_password
from app.database import Base, get_db
from app.models.user import User

# Create a test FastAPI app with protected routes
app = FastAPI()


@app.get("/test/protected")
async def protected_route(current_user: User = Depends(get_current_user)):
    """Test route requiring authentication."""
    return {
        "user_id": str(current_user.user_id),
        "email": current_user.email,
        "role": current_user.role
    }


@app.get("/test/admin-only")
async def admin_only_route(admin: User = Depends(get_current_admin_user)):
    """Test route requiring admin role."""
    return {
        "user_id": str(admin.user_id),
        "email": admin.email,
        "message": "Admin access granted"
    }


@app.get("/test/tos-required")
async def tos_required_route(current_user: User = Depends(require_tos_accepted)):
    """Test route requiring TOS acceptance."""
    return {
        "user_id": str(current_user.user_id),
        "message": "TOS accepted"
    }


@pytest.mark.asyncio
class TestAuthenticationDependencies:
    """Tests for authentication dependency functions."""

    async def test_protected_route_without_token(self, async_client: AsyncClient):
        """Test that protected route returns 403 without token (HTTPBearer behavior)."""
        response = await async_client.get("/test/protected")
        # HTTPBearer returns 403 when no credentials are provided
        assert response.status_code == 403
        assert "detail" in response.json()

    async def test_protected_route_with_invalid_token(self, async_client: AsyncClient):
        """Test that protected route returns 401 with invalid token."""
        response = await async_client.get(
            "/test/protected",
            headers={"Authorization": "Bearer invalid-token-here"}
        )
        assert response.status_code == 401

    async def test_protected_route_with_malformed_token(self, async_client: AsyncClient):
        """Test that protected route returns 401 with malformed token."""
        response = await async_client.get(
            "/test/protected",
            headers={"Authorization": "Bearer not.a.jwt"}
        )
        assert response.status_code == 401

    async def test_protected_route_with_expired_token(
        self,
        async_client: AsyncClient,
        test_user: User
    ):
        """Test that protected route returns 401 with expired token."""
        # Create an expired token (1 second ago)
        expired_token = create_access_token(
            {"sub": str(test_user.user_id), "email": test_user.email, "role": test_user.role},
            expires_delta=timedelta(seconds=-1)
        )
        
        response = await async_client.get(
            "/test/protected",
            headers={"Authorization": f"Bearer {expired_token}"}
        )
        assert response.status_code == 401
        assert "expired" in response.json()["detail"].lower()

    async def test_protected_route_with_valid_token(
        self,
        async_client: AsyncClient,
        test_user: User,
        access_token: str
    ):
        """Test that protected route works with valid token."""
        response = await async_client.get(
            "/test/protected",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == str(test_user.user_id)
        assert data["email"] == test_user.email
        assert data["role"] == test_user.role

    async def test_protected_route_with_inactive_user(
        self,
        async_client: AsyncClient,
        inactive_user: User,
        inactive_user_token: str
    ):
        """Test that protected route returns 403 for inactive user."""
        response = await async_client.get(
            "/test/protected",
            headers={"Authorization": f"Bearer {inactive_user_token}"}
        )
        assert response.status_code == 403
        assert "inactive" in response.json()["detail"].lower()

    async def test_protected_route_with_nonexistent_user(
        self,
        async_client: AsyncClient
    ):
        """Test that protected route returns 401 for non-existent user."""
        # Create token with non-existent user ID
        fake_user_id = str(uuid4())
        token = create_access_token({
            "sub": fake_user_id,
            "email": "nonexistent@example.com",
            "role": "user"
        })
        
        response = await async_client.get(
            "/test/protected",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 401
        assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
class TestAdminRoleAuthorization:
    """Tests for admin role authorization."""

    async def test_admin_route_as_admin(
        self,
        async_client: AsyncClient,
        admin_user: User,
        admin_token: str
    ):
        """Test that admin route works for admin user."""
        response = await async_client.get(
            "/test/admin-only",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == str(admin_user.user_id)
        assert "Admin access granted" in data["message"]

    async def test_admin_route_as_regular_user(
        self,
        async_client: AsyncClient,
        test_user: User,
        access_token: str
    ):
        """Test that admin route returns 403 for regular user."""
        response = await async_client.get(
            "/test/admin-only",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        assert response.status_code == 403
        assert "admin" in response.json()["detail"].lower()

    async def test_admin_route_without_token(self, async_client: AsyncClient):
        """Test that admin route returns 403 without token (HTTPBearer behavior)."""
        response = await async_client.get("/test/admin-only")
        # HTTPBearer returns 403 when no credentials are provided
        assert response.status_code == 403


@pytest.mark.asyncio
class TestTOSRequirement:
    """Tests for Terms of Service acceptance requirement."""

    async def test_tos_route_with_tos_accepted(
        self,
        async_client: AsyncClient,
        test_user: User,
        access_token: str
    ):
        """Test that TOS-protected route works when TOS is accepted."""
        response = await async_client.get(
            "/test/tos-required",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == str(test_user.user_id)

    async def test_tos_route_without_tos_acceptance(
        self,
        async_client: AsyncClient,
        user_without_tos: User,
        user_without_tos_token: str
    ):
        """Test that TOS-protected route returns 403 when TOS not accepted."""
        response = await async_client.get(
            "/test/tos-required",
            headers={"Authorization": f"Bearer {user_without_tos_token}"}
        )
        assert response.status_code == 403
        assert "terms of service" in response.json()["detail"].lower()

    async def test_tos_route_without_token(self, async_client: AsyncClient):
        """Test that TOS-protected route returns 403 without token (HTTPBearer behavior)."""
        response = await async_client.get("/test/tos-required")
        # HTTPBearer returns 403 when no credentials are provided
        assert response.status_code == 403


@pytest.mark.asyncio
class TestTokenValidation:
    """Tests for various token validation scenarios."""

    async def test_token_with_missing_sub_claim(self, async_client: AsyncClient):
        """Test that token without 'sub' claim is rejected."""
        # Create token without sub claim but with type claim
        from jose import jwt
        from app.config import settings
        from datetime import datetime, timezone
        
        payload = {
            "email": "test@example.com",
            "type": "access",  # Include type so it passes type check
            "exp": datetime.now(timezone.utc) + timedelta(minutes=60),
            "iat": datetime.now(timezone.utc)
        }
        token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
        
        response = await async_client.get(
            "/test/protected",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 401
        assert "user identifier" in response.json()["detail"].lower()

    async def test_token_with_invalid_sub_format(self, async_client: AsyncClient):
        """Test that token with invalid UUID format in sub is rejected."""
        # Create token with invalid UUID
        from jose import jwt
        from app.config import settings
        from datetime import datetime, timezone
        
        payload = {
            "sub": "not-a-uuid",
            "email": "test@example.com",
            "type": "access",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=60),
            "iat": datetime.now(timezone.utc)
        }
        token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
        
        response = await async_client.get(
            "/test/protected",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 401
        assert "invalid user identifier" in response.json()["detail"].lower()

    async def test_refresh_token_on_protected_route(
        self,
        async_client: AsyncClient,
        test_user: User
    ):
        """Test that refresh token is rejected on routes requiring access token."""
        from app.auth.jwt import create_refresh_token
        
        refresh_token = create_refresh_token(str(test_user.user_id))
        
        response = await async_client.get(
            "/test/protected",
            headers={"Authorization": f"Bearer {refresh_token}"}
        )
        assert response.status_code == 401
        assert "invalid token type" in response.json()["detail"].lower()

