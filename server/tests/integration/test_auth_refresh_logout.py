"""Integration tests for token refresh and logout endpoints."""

from datetime import datetime, timedelta

import pytest
from httpx import AsyncClient

from app.auth.jwt import create_refresh_token
from app.models.user import User


@pytest.mark.asyncio
class TestTokenRefresh:
    """Tests for token refresh endpoint."""

    async def test_refresh_token_success(self, async_client_main: AsyncClient):
        """Test successful token refresh."""
        # Register and login
        await async_client_main.post(
            "/api/v1/auth/register",
            json={
                "email": "refresh@example.com",
                "password": "SecurePass123!",
                "tos_accepted": True
            }
        )
        
        login_response = await async_client_main.post(
            "/api/v1/auth/login",
            json={
                "email": "refresh@example.com",
                "password": "SecurePass123!"
            }
        )
        
        old_tokens = login_response.json()
        
        # Refresh tokens
        response = await async_client_main.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": old_tokens["refresh_token"]}
        )
        
        assert response.status_code == 200
        new_tokens = response.json()
        assert "access_token" in new_tokens
        assert "refresh_token" in new_tokens
        assert new_tokens["token_type"] == "bearer"
        
        # New tokens should be different from old ones
        assert new_tokens["access_token"] != old_tokens["access_token"]
        assert new_tokens["refresh_token"] != old_tokens["refresh_token"]

    async def test_refresh_token_invalidates_old_refresh_token(
        self,
        async_client_main: AsyncClient
    ):
        """Test that refreshing invalidates the old refresh token."""
        # Register and login
        await async_client_main.post(
            "/api/v1/auth/register",
            json={
                "email": "tokenrotation@example.com",
                "password": "SecurePass123!",
                "tos_accepted": True
            }
        )
        
        login_response = await async_client_main.post(
            "/api/v1/auth/login",
            json={
                "email": "tokenrotation@example.com",
                "password": "SecurePass123!"
            }
        )
        
        old_tokens = login_response.json()
        
        # Refresh tokens
        refresh_response = await async_client_main.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": old_tokens["refresh_token"]}
        )
        
        assert refresh_response.status_code == 200
        
        # Try to use old refresh token again (should fail)
        response = await async_client_main.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": old_tokens["refresh_token"]}
        )
        
        assert response.status_code == 401
        assert "session not found" in response.json()["detail"].lower() or \
               "revoked" in response.json()["detail"].lower()

    async def test_refresh_with_invalid_token(self, async_client_main: AsyncClient):
        """Test refresh with invalid token."""
        response = await async_client_main.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "invalid-token"}
        )
        
        assert response.status_code == 401

    async def test_refresh_with_access_token(self, async_client_main: AsyncClient):
        """Test that access token cannot be used for refresh."""
        # Register and login
        await async_client_main.post(
            "/api/v1/auth/register",
            json={
                "email": "wrongtype@example.com",
                "password": "SecurePass123!",
                "tos_accepted": True
            }
        )
        
        login_response = await async_client_main.post(
            "/api/v1/auth/login",
            json={
                "email": "wrongtype@example.com",
                "password": "SecurePass123!"
            }
        )
        
        tokens = login_response.json()
        
        # Try to refresh with access token instead of refresh token
        response = await async_client_main.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": tokens["access_token"]}
        )
        
        assert response.status_code == 401
        assert "token type" in response.json()["detail"].lower()

    async def test_refresh_with_nonexistent_session(
        self,
        async_client_main: AsyncClient,
        test_user: User
    ):
        """Test refresh with valid token but no session in database."""
        # Create a refresh token that won't have a session
        fake_refresh_token = create_refresh_token(str(test_user.user_id))
        
        response = await async_client_main.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": fake_refresh_token}
        )
        
        assert response.status_code == 401
        assert "session not found" in response.json()["detail"].lower() or \
               "revoked" in response.json()["detail"].lower()

    async def test_new_access_token_works(self, async_client_main: AsyncClient):
        """Test that refreshed access token works for protected endpoints."""
        # Register and login
        await async_client_main.post(
            "/api/v1/auth/register",
            json={
                "email": "newtokenworks@example.com",
                "password": "SecurePass123!",
                "tos_accepted": True
            }
        )
        
        login_response = await async_client_main.post(
            "/api/v1/auth/login",
            json={
                "email": "newtokenworks@example.com",
                "password": "SecurePass123!"
            }
        )
        
        old_tokens = login_response.json()
        
        # Refresh tokens
        refresh_response = await async_client_main.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": old_tokens["refresh_token"]}
        )
        
        new_tokens = refresh_response.json()
        
        # Use new access token on protected endpoint
        me_response = await async_client_main.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {new_tokens['access_token']}"}
        )
        
        assert me_response.status_code == 200
        assert me_response.json()["email"] == "newtokenworks@example.com"


@pytest.mark.asyncio
class TestLogout:
    """Tests for logout endpoint."""

    async def test_logout_success(self, async_client_main: AsyncClient):
        """Test successful logout."""
        # Register and login
        await async_client_main.post(
            "/api/v1/auth/register",
            json={
                "email": "logout@example.com",
                "password": "SecurePass123!",
                "tos_accepted": True
            }
        )
        
        login_response = await async_client_main.post(
            "/api/v1/auth/login",
            json={
                "email": "logout@example.com",
                "password": "SecurePass123!"
            }
        )
        
        tokens = login_response.json()
        
        # Logout
        response = await async_client_main.post(
            "/api/v1/auth/logout",
            json={"refresh_token": tokens["refresh_token"]},
            headers={"Authorization": f"Bearer {tokens['access_token']}"}
        )
        
        assert response.status_code == 204
        assert response.content == b''  # No content

    async def test_logout_invalidates_refresh_token(
        self,
        async_client_main: AsyncClient
    ):
        """Test that logout prevents further token refresh."""
        # Register and login
        await async_client_main.post(
            "/api/v1/auth/register",
            json={
                "email": "logoutinvalidate@example.com",
                "password": "SecurePass123!",
                "tos_accepted": True
            }
        )
        
        login_response = await async_client_main.post(
            "/api/v1/auth/login",
            json={
                "email": "logoutinvalidate@example.com",
                "password": "SecurePass123!"
            }
        )
        
        tokens = login_response.json()
        
        # Logout
        logout_response = await async_client_main.post(
            "/api/v1/auth/logout",
            json={"refresh_token": tokens["refresh_token"]},
            headers={"Authorization": f"Bearer {tokens['access_token']}"}
        )
        
        assert logout_response.status_code == 204
        
        # Try to refresh with logged-out token (should fail)
        refresh_response = await async_client_main.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": tokens["refresh_token"]}
        )
        
        assert refresh_response.status_code == 401

    async def test_logout_without_authentication(self, async_client_main: AsyncClient):
        """Test that logout requires authentication."""
        response = await async_client_main.post(
            "/api/v1/auth/logout",
            json={"refresh_token": "some-token"}
        )
        
        # HTTPBearer returns 403 when no credentials provided
        assert response.status_code == 403

    async def test_logout_with_invalid_refresh_token(
        self,
        async_client_main: AsyncClient
    ):
        """Test logout with non-existent refresh token."""
        # Register and login
        await async_client_main.post(
            "/api/v1/auth/register",
            json={
                "email": "invalidlogout@example.com",
                "password": "SecurePass123!",
                "tos_accepted": True
            }
        )
        
        login_response = await async_client_main.post(
            "/api/v1/auth/login",
            json={
                "email": "invalidlogout@example.com",
                "password": "SecurePass123!"
            }
        )
        
        tokens = login_response.json()
        
        # Try to logout with fake refresh token
        fake_refresh_token = create_refresh_token(str("fake-user-id"))
        
        response = await async_client_main.post(
            "/api/v1/auth/logout",
            json={"refresh_token": fake_refresh_token},
            headers={"Authorization": f"Bearer {tokens['access_token']}"}
        )
        
        assert response.status_code == 401

    async def test_logout_twice_fails(self, async_client_main: AsyncClient):
        """Test that logging out twice with same token fails."""
        # Register and login
        await async_client_main.post(
            "/api/v1/auth/register",
            json={
                "email": "logouttwice@example.com",
                "password": "SecurePass123!",
                "tos_accepted": True
            }
        )
        
        login_response = await async_client_main.post(
            "/api/v1/auth/login",
            json={
                "email": "logouttwice@example.com",
                "password": "SecurePass123!"
            }
        )
        
        tokens = login_response.json()
        
        # First logout
        response1 = await async_client_main.post(
            "/api/v1/auth/logout",
            json={"refresh_token": tokens["refresh_token"]},
            headers={"Authorization": f"Bearer {tokens['access_token']}"}
        )
        
        assert response1.status_code == 204
        
        # Second logout with same token (should fail)
        response2 = await async_client_main.post(
            "/api/v1/auth/logout",
            json={"refresh_token": tokens["refresh_token"]},
            headers={"Authorization": f"Bearer {tokens['access_token']}"}
        )
        
        assert response2.status_code == 401


@pytest.mark.asyncio
class TestMultipleSessions:
    """Tests for multiple session management."""

    async def test_multiple_sessions_per_user(self, async_client_main: AsyncClient):
        """Test that user can have multiple active sessions."""
        # Register
        await async_client_main.post(
            "/api/v1/auth/register",
            json={
                "email": "multisession@example.com",
                "password": "SecurePass123!",
                "tos_accepted": True
            }
        )
        
        # Login from "device 1"
        login1 = await async_client_main.post(
            "/api/v1/auth/login",
            json={
                "email": "multisession@example.com",
                "password": "SecurePass123!"
            }
        )
        tokens1 = login1.json()
        
        # Login from "device 2"
        login2 = await async_client_main.post(
            "/api/v1/auth/login",
            json={
                "email": "multisession@example.com",
                "password": "SecurePass123!"
            }
        )
        tokens2 = login2.json()
        
        # Both refresh tokens should be different
        assert tokens1["refresh_token"] != tokens2["refresh_token"]
        
        # Both should work for refresh
        refresh1 = await async_client_main.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": tokens1["refresh_token"]}
        )
        assert refresh1.status_code == 200
        
        refresh2 = await async_client_main.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": tokens2["refresh_token"]}
        )
        assert refresh2.status_code == 200

    async def test_logout_one_session_keeps_others(
        self,
        async_client_main: AsyncClient
    ):
        """Test that logging out one session keeps other sessions active."""
        # Register
        await async_client_main.post(
            "/api/v1/auth/register",
            json={
                "email": "multisessionlogout@example.com",
                "password": "SecurePass123!",
                "tos_accepted": True
            }
        )
        
        # Login twice
        login1 = await async_client_main.post(
            "/api/v1/auth/login",
            json={
                "email": "multisessionlogout@example.com",
                "password": "SecurePass123!"
            }
        )
        tokens1 = login1.json()
        
        login2 = await async_client_main.post(
            "/api/v1/auth/login",
            json={
                "email": "multisessionlogout@example.com",
                "password": "SecurePass123!"
            }
        )
        tokens2 = login2.json()
        
        # Logout session 1
        logout_response = await async_client_main.post(
            "/api/v1/auth/logout",
            json={"refresh_token": tokens1["refresh_token"]},
            headers={"Authorization": f"Bearer {tokens1['access_token']}"}
        )
        assert logout_response.status_code == 204
        
        # Session 1 should be invalid
        refresh1 = await async_client_main.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": tokens1["refresh_token"]}
        )
        assert refresh1.status_code == 401
        
        # Session 2 should still work
        refresh2 = await async_client_main.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": tokens2["refresh_token"]}
        )
        assert refresh2.status_code == 200


@pytest.mark.asyncio
class TestCompleteAuthFlow:
    """Tests for complete authentication flow with refresh and logout."""

    async def test_full_lifecycle(self, async_client_main: AsyncClient):
        """Test complete user lifecycle: register → login → refresh → logout."""
        # 1. Register
        register_response = await async_client_main.post(
            "/api/v1/auth/register",
            json={
                "email": "lifecycle@example.com",
                "password": "SecurePass123!",
                "tos_accepted": True
            }
        )
        assert register_response.status_code == 201
        
        # 2. Login
        login_response = await async_client_main.post(
            "/api/v1/auth/login",
            json={
                "email": "lifecycle@example.com",
                "password": "SecurePass123!"
            }
        )
        assert login_response.status_code == 200
        tokens = login_response.json()
        
        # 3. Access protected endpoint
        me_response = await async_client_main.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {tokens['access_token']}"}
        )
        assert me_response.status_code == 200
        
        # 4. Refresh tokens
        refresh_response = await async_client_main.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": tokens["refresh_token"]}
        )
        assert refresh_response.status_code == 200
        new_tokens = refresh_response.json()
        
        # 5. Use new access token
        me_response2 = await async_client_main.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {new_tokens['access_token']}"}
        )
        assert me_response2.status_code == 200
        
        # 6. Logout
        logout_response = await async_client_main.post(
            "/api/v1/auth/logout",
            json={"refresh_token": new_tokens["refresh_token"]},
            headers={"Authorization": f"Bearer {new_tokens['access_token']}"}
        )
        assert logout_response.status_code == 204
        
        # 7. Verify tokens no longer work
        refresh_after_logout = await async_client_main.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": new_tokens["refresh_token"]}
        )
        assert refresh_after_logout.status_code == 401

    async def test_session_metadata_updates_on_refresh(
        self,
        async_client_main: AsyncClient
    ):
        """Test that session metadata can be updated on refresh."""
        # Register and login
        await async_client_main.post(
            "/api/v1/auth/register",
            json={
                "email": "metadata@example.com",
                "password": "SecurePass123!",
                "tos_accepted": True
            }
        )
        
        login_response = await async_client_main.post(
            "/api/v1/auth/login",
            json={
                "email": "metadata@example.com",
                "password": "SecurePass123!"
            }
        )
        
        tokens = login_response.json()
        
        # Refresh with different user agent
        refresh_response = await async_client_main.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": tokens["refresh_token"]},
            headers={"User-Agent": "NewDevice/1.0"}
        )
        
        assert refresh_response.status_code == 200
        # Session should be updated with new metadata

