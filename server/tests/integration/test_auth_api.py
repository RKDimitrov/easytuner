"""Integration tests for authentication API endpoints."""

import pytest
from httpx import AsyncClient

from app.main import app
from app.models.user import User


@pytest.mark.asyncio
class TestUserRegistration:
    """Tests for user registration endpoint."""

    async def test_register_user_success(self, async_client_main: AsyncClient):
        """Test successful user registration."""
        response = await async_client_main.post(
            "/api/v1/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "SecurePass123!",
                "tos_accepted": True
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "newuser@example.com"
        assert data["role"] == "user"
        assert data["is_active"] is True
        assert "user_id" in data
        assert "tos_accepted_at" in data
        assert data["tos_accepted_at"] is not None

    async def test_register_duplicate_email(self, async_client_main: AsyncClient):
        """Test that duplicate email registration is prevented."""
        # First registration
        await async_client_main.post(
            "/api/v1/auth/register",
            json={
                "email": "duplicate@example.com",
                "password": "SecurePass123!",
                "tos_accepted": True
            }
        )
        
        # Attempt duplicate registration
        response = await async_client_main.post(
            "/api/v1/auth/register",
            json={
                "email": "duplicate@example.com",
                "password": "AnotherPass123!",
                "tos_accepted": True
            }
        )
        
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"].lower()

    async def test_register_weak_password(self, async_client_main: AsyncClient):
        """Test that weak password is rejected."""
        response = await async_client_main.post(
            "/api/v1/auth/register",
            json={
                "email": "weakpass@example.com",
                "password": "weakpassword",  # Less than 12 chars, no uppercase, no special
                "tos_accepted": True
            }
        )
        
        assert response.status_code == 400
        assert "password validation failed" in response.json()["detail"].lower()

    async def test_register_no_uppercase(self, async_client_main: AsyncClient):
        """Test that password without uppercase is rejected."""
        response = await async_client_main.post(
            "/api/v1/auth/register",
            json={
                "email": "nouppercase@example.com",
                "password": "securepass123!",
                "tos_accepted": True
            }
        )
        
        assert response.status_code == 400
        assert "uppercase" in response.json()["detail"].lower()

    async def test_register_no_digit(self, async_client_main: AsyncClient):
        """Test that password without digit is rejected."""
        response = await async_client_main.post(
            "/api/v1/auth/register",
            json={
                "email": "nodigit@example.com",
                "password": "SecurePassword!",
                "tos_accepted": True
            }
        )
        
        assert response.status_code == 400
        assert "digit" in response.json()["detail"].lower()

    async def test_register_no_special_char(self, async_client_main: AsyncClient):
        """Test that password without special character is rejected."""
        response = await async_client_main.post(
            "/api/v1/auth/register",
            json={
                "email": "nospecial@example.com",
                "password": "SecurePass123",
                "tos_accepted": True
            }
        )
        
        assert response.status_code == 400
        assert "special character" in response.json()["detail"].lower()

    async def test_register_tos_not_accepted(self, async_client_main: AsyncClient):
        """Test that TOS must be accepted."""
        response = await async_client_main.post(
            "/api/v1/auth/register",
            json={
                "email": "notos@example.com",
                "password": "SecurePass123!",
                "tos_accepted": False
            }
        )
        
        assert response.status_code == 400
        assert "terms of service" in response.json()["detail"].lower()

    async def test_register_invalid_email(self, async_client_main: AsyncClient):
        """Test that invalid email format is rejected."""
        response = await async_client_main.post(
            "/api/v1/auth/register",
            json={
                "email": "not-an-email",
                "password": "SecurePass123!",
                "tos_accepted": True
            }
        )
        
        assert response.status_code == 422  # Pydantic validation error


@pytest.mark.asyncio
class TestUserLogin:
    """Tests for user login endpoint."""

    async def test_login_success(self, async_client_main: AsyncClient):
        """Test successful user login."""
        # First register a user
        await async_client_main.post(
            "/api/v1/auth/register",
            json={
                "email": "logintest@example.com",
                "password": "SecurePass123!",
                "tos_accepted": True
            }
        )
        
        # Now login
        response = await async_client_main.post(
            "/api/v1/auth/login",
            json={
                "email": "logintest@example.com",
                "password": "SecurePass123!"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert len(data["access_token"]) > 0
        assert len(data["refresh_token"]) > 0

    async def test_login_invalid_email(self, async_client_main: AsyncClient):
        """Test login with non-existent email."""
        response = await async_client_main.post(
            "/api/v1/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "SecurePass123!"
            }
        )
        
        assert response.status_code == 401
        assert "invalid" in response.json()["detail"].lower()

    async def test_login_wrong_password(self, async_client_main: AsyncClient):
        """Test login with wrong password."""
        # Register a user
        await async_client_main.post(
            "/api/v1/auth/register",
            json={
                "email": "wrongpass@example.com",
                "password": "SecurePass123!",
                "tos_accepted": True
            }
        )
        
        # Try to login with wrong password
        response = await async_client_main.post(
            "/api/v1/auth/login",
            json={
                "email": "wrongpass@example.com",
                "password": "WrongPassword123!"
            }
        )
        
        assert response.status_code == 401
        assert "invalid" in response.json()["detail"].lower()

    async def test_login_inactive_user(
        self,
        async_client_main: AsyncClient,
        inactive_user: User
    ):
        """Test that inactive user cannot login."""
        response = await async_client_main.post(
            "/api/v1/auth/login",
            json={
                "email": inactive_user.email,
                "password": "InactivePassword123!"
            }
        )
        
        assert response.status_code == 403
        assert "inactive" in response.json()["detail"].lower()


@pytest.mark.asyncio
class TestCurrentUser:
    """Tests for current user endpoint."""

    async def test_get_current_user_success(self, async_client_main: AsyncClient):
        """Test getting current user information."""
        # Register and login
        await async_client_main.post(
            "/api/v1/auth/register",
            json={
                "email": "currentuser@example.com",
                "password": "SecurePass123!",
                "tos_accepted": True
            }
        )
        
        login_response = await async_client_main.post(
            "/api/v1/auth/login",
            json={
                "email": "currentuser@example.com",
                "password": "SecurePass123!"
            }
        )
        
        access_token = login_response.json()["access_token"]
        
        # Get current user
        response = await async_client_main.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "currentuser@example.com"
        assert data["role"] == "user"
        assert data["is_active"] is True
        assert "user_id" in data

    async def test_get_current_user_no_token(self, async_client_main: AsyncClient):
        """Test that current user endpoint requires authentication."""
        response = await async_client_main.get("/api/v1/auth/me")
        
        # HTTPBearer returns 403 when no credentials provided
        assert response.status_code == 403

    async def test_get_current_user_invalid_token(self, async_client_main: AsyncClient):
        """Test that invalid token is rejected."""
        response = await async_client_main.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalid-token"}
        )
        
        assert response.status_code == 401


@pytest.mark.asyncio
class TestAuthenticationFlow:
    """Integration tests for complete authentication flow."""

    async def test_full_registration_and_login_flow(
        self,
        async_client_main: AsyncClient
    ):
        """Test complete flow: register -> login -> access protected endpoint."""
        # 1. Register
        register_response = await async_client_main.post(
            "/api/v1/auth/register",
            json={
                "email": "fullflow@example.com",
                "password": "SecurePass123!",
                "tos_accepted": True
            }
        )
        
        assert register_response.status_code == 201
        user_data = register_response.json()
        assert user_data["email"] == "fullflow@example.com"
        
        # 2. Login
        login_response = await async_client_main.post(
            "/api/v1/auth/login",
            json={
                "email": "fullflow@example.com",
                "password": "SecurePass123!"
            }
        )
        
        assert login_response.status_code == 200
        tokens = login_response.json()
        access_token = tokens["access_token"]
        
        # 3. Access protected endpoint
        me_response = await async_client_main.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        assert me_response.status_code == 200
        current_user = me_response.json()
        assert current_user["email"] == "fullflow@example.com"
        assert current_user["user_id"] == user_data["user_id"]

    async def test_multiple_logins_create_sessions(
        self,
        async_client_main: AsyncClient
    ):
        """Test that multiple logins create separate sessions."""
        # Register
        await async_client_main.post(
            "/api/v1/auth/register",
            json={
                "email": "multisession@example.com",
                "password": "SecurePass123!",
                "tos_accepted": True
            }
        )
        
        # Login multiple times
        response1 = await async_client_main.post(
            "/api/v1/auth/login",
            json={
                "email": "multisession@example.com",
                "password": "SecurePass123!"
            }
        )
        
        response2 = await async_client_main.post(
            "/api/v1/auth/login",
            json={
                "email": "multisession@example.com",
                "password": "SecurePass123!"
            }
        )
        
        # Should get different tokens
        tokens1 = response1.json()
        tokens2 = response2.json()
        
        assert tokens1["access_token"] != tokens2["access_token"]
        assert tokens1["refresh_token"] != tokens2["refresh_token"]

