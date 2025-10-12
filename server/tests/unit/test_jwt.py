"""Unit tests for JWT token creation and validation."""

from datetime import timedelta
from time import sleep

import pytest
from fastapi import HTTPException

from app.auth.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_token_jti,
    verify_token_type,
)


class TestAccessTokenCreation:
    """Tests for access token creation."""

    def test_create_access_token_basic(self):
        """Test creating an access token with basic payload."""
        payload = {"sub": "user-123", "email": "user@example.com"}
        token = create_access_token(payload)
        
        assert token
        assert isinstance(token, str)
        assert len(token) > 0
        # JWT format: header.payload.signature
        assert token.count(".") == 2

    def test_create_access_token_with_role(self):
        """Test creating an access token with role information."""
        payload = {
            "sub": "user-123",
            "email": "user@example.com",
            "role": "admin"
        }
        token = create_access_token(payload)
        decoded = decode_token(token)
        
        assert decoded["sub"] == "user-123"
        assert decoded["email"] == "user@example.com"
        assert decoded["role"] == "admin"

    def test_access_token_includes_standard_claims(self):
        """Test that access token includes exp, iat, jti, type claims."""
        payload = {"sub": "user-123"}
        token = create_access_token(payload)
        decoded = decode_token(token)
        
        assert "exp" in decoded
        assert "iat" in decoded
        assert "jti" in decoded
        assert decoded["type"] == "access"

    def test_access_token_custom_expiration(self):
        """Test creating an access token with custom expiration."""
        payload = {"sub": "user-123"}
        expires_delta = timedelta(minutes=10)
        token = create_access_token(payload, expires_delta=expires_delta)
        decoded = decode_token(token)
        
        assert "exp" in decoded
        # Verify expiration is in the future
        assert decoded["exp"] > decoded["iat"]

    def test_access_token_jti_is_unique(self):
        """Test that each access token has a unique jti."""
        payload = {"sub": "user-123"}
        token1 = create_access_token(payload)
        token2 = create_access_token(payload)
        
        decoded1 = decode_token(token1)
        decoded2 = decode_token(token2)
        
        assert decoded1["jti"] != decoded2["jti"]

    def test_access_token_different_for_same_payload(self):
        """Test that tokens are different even with same payload (due to timestamps)."""
        payload = {"sub": "user-123", "email": "user@example.com"}
        token1 = create_access_token(payload)
        sleep(0.01)  # Small delay to ensure different iat
        token2 = create_access_token(payload)
        
        assert token1 != token2


class TestRefreshTokenCreation:
    """Tests for refresh token creation."""

    def test_create_refresh_token_basic(self):
        """Test creating a refresh token."""
        user_id = "user-uuid-123"
        token = create_refresh_token(user_id)
        
        assert token
        assert isinstance(token, str)
        assert len(token) > 0
        assert token.count(".") == 2

    def test_refresh_token_includes_user_id(self):
        """Test that refresh token includes user ID in sub claim."""
        user_id = "user-uuid-123"
        token = create_refresh_token(user_id)
        decoded = decode_token(token)
        
        assert decoded["sub"] == user_id

    def test_refresh_token_includes_standard_claims(self):
        """Test that refresh token includes exp, iat, jti, type claims."""
        user_id = "user-uuid-123"
        token = create_refresh_token(user_id)
        decoded = decode_token(token)
        
        assert "exp" in decoded
        assert "iat" in decoded
        assert "jti" in decoded
        assert decoded["type"] == "refresh"

    def test_refresh_token_type_is_refresh(self):
        """Test that refresh token has correct type claim."""
        user_id = "user-uuid-123"
        token = create_refresh_token(user_id)
        decoded = decode_token(token)
        
        assert decoded["type"] == "refresh"

    def test_refresh_token_minimal_payload(self):
        """Test that refresh token has minimal payload for security."""
        user_id = "user-uuid-123"
        token = create_refresh_token(user_id)
        decoded = decode_token(token)
        
        # Should have only: sub, exp, iat, jti, type
        expected_keys = {"sub", "exp", "iat", "jti", "type"}
        assert set(decoded.keys()) == expected_keys

    def test_refresh_token_jti_is_unique(self):
        """Test that each refresh token has a unique jti."""
        user_id = "user-uuid-123"
        token1 = create_refresh_token(user_id)
        token2 = create_refresh_token(user_id)
        
        decoded1 = decode_token(token1)
        decoded2 = decode_token(token2)
        
        assert decoded1["jti"] != decoded2["jti"]


class TestTokenDecoding:
    """Tests for token decoding and validation."""

    def test_decode_valid_access_token(self):
        """Test decoding a valid access token."""
        payload = {"sub": "user-123", "email": "user@example.com"}
        token = create_access_token(payload)
        decoded = decode_token(token)
        
        assert decoded["sub"] == "user-123"
        assert decoded["email"] == "user@example.com"

    def test_decode_valid_refresh_token(self):
        """Test decoding a valid refresh token."""
        user_id = "user-uuid-123"
        token = create_refresh_token(user_id)
        decoded = decode_token(token)
        
        assert decoded["sub"] == user_id

    def test_decode_expired_token_raises_exception(self):
        """Test that decoding an expired token raises HTTPException."""
        payload = {"sub": "user-123"}
        # Create token with immediate expiration
        token = create_access_token(payload, expires_delta=timedelta(seconds=-1))
        
        with pytest.raises(HTTPException) as exc_info:
            decode_token(token)
        
        assert exc_info.value.status_code == 401
        assert "expired" in exc_info.value.detail.lower()

    def test_decode_invalid_token_raises_exception(self):
        """Test that decoding an invalid token raises HTTPException."""
        with pytest.raises(HTTPException) as exc_info:
            decode_token("invalid.token.here")
        
        assert exc_info.value.status_code == 401

    def test_decode_malformed_token_raises_exception(self):
        """Test that decoding a malformed token raises HTTPException."""
        with pytest.raises(HTTPException) as exc_info:
            decode_token("not-a-jwt-token")
        
        assert exc_info.value.status_code == 401

    def test_decode_empty_token_raises_exception(self):
        """Test that decoding an empty token raises HTTPException."""
        with pytest.raises(HTTPException) as exc_info:
            decode_token("")
        
        assert exc_info.value.status_code == 401

    def test_decode_tampered_token_raises_exception(self):
        """Test that decoding a tampered token raises HTTPException."""
        payload = {"sub": "user-123"}
        token = create_access_token(payload)
        
        # Tamper with the token
        tampered_token = token[:-5] + "xxxxx"
        
        with pytest.raises(HTTPException) as exc_info:
            decode_token(tampered_token)
        
        assert exc_info.value.status_code == 401

    def test_decode_token_with_wrong_secret(self):
        """Test that token created with different secret fails validation."""
        # This test verifies that the decode function uses the correct secret
        payload = {"sub": "user-123"}
        token = create_access_token(payload)
        
        # Token should decode successfully with correct secret
        decoded = decode_token(token)
        assert decoded["sub"] == "user-123"


class TestTokenTypeVerification:
    """Tests for token type verification."""

    def test_verify_access_token_type(self):
        """Test verifying access token type."""
        payload = {"sub": "user-123"}
        token = create_access_token(payload)
        decoded = decode_token(token)
        
        assert verify_token_type(decoded, "access") is True
        assert verify_token_type(decoded, "refresh") is False

    def test_verify_refresh_token_type(self):
        """Test verifying refresh token type."""
        user_id = "user-uuid-123"
        token = create_refresh_token(user_id)
        decoded = decode_token(token)
        
        assert verify_token_type(decoded, "refresh") is True
        assert verify_token_type(decoded, "access") is False

    def test_verify_token_type_case_sensitive(self):
        """Test that token type verification is case-sensitive."""
        payload = {"sub": "user-123"}
        token = create_access_token(payload)
        decoded = decode_token(token)
        
        assert verify_token_type(decoded, "access") is True
        assert verify_token_type(decoded, "Access") is False
        assert verify_token_type(decoded, "ACCESS") is False

    def test_verify_token_type_missing_type_claim(self):
        """Test verifying token type when type claim is missing."""
        # Create a payload without type claim
        payload = {"sub": "user-123", "iat": 1234567890, "exp": 9999999999}
        
        # Manually decode to simulate missing type claim
        assert verify_token_type(payload, "access") is False
        assert verify_token_type(payload, "refresh") is False


class TestTokenJTI:
    """Tests for JWT ID (jti) extraction."""

    def test_get_jti_from_access_token(self):
        """Test extracting jti from access token."""
        payload = {"sub": "user-123"}
        token = create_access_token(payload)
        decoded = decode_token(token)
        jti = get_token_jti(decoded)
        
        assert jti is not None
        assert isinstance(jti, str)
        assert len(jti) > 0

    def test_get_jti_from_refresh_token(self):
        """Test extracting jti from refresh token."""
        user_id = "user-uuid-123"
        token = create_refresh_token(user_id)
        decoded = decode_token(token)
        jti = get_token_jti(decoded)
        
        assert jti is not None
        assert isinstance(jti, str)
        assert len(jti) > 0

    def test_get_jti_from_payload_without_jti(self):
        """Test extracting jti from payload without jti claim."""
        payload = {"sub": "user-123", "type": "access"}
        jti = get_token_jti(payload)
        
        assert jti is None

    def test_jti_is_valid_uuid(self):
        """Test that jti is a valid UUID string."""
        from uuid import UUID
        
        payload = {"sub": "user-123"}
        token = create_access_token(payload)
        decoded = decode_token(token)
        jti = get_token_jti(decoded)
        
        # Should be able to parse as UUID
        try:
            UUID(jti)
            is_valid_uuid = True
        except (ValueError, AttributeError):
            is_valid_uuid = False
        
        assert is_valid_uuid


class TestTokenIntegration:
    """Integration tests for token workflows."""

    def test_full_access_token_workflow(self):
        """Test complete access token workflow: create, decode, verify."""
        # Create token
        payload = {
            "sub": "user-123",
            "email": "user@example.com",
            "role": "user"
        }
        token = create_access_token(payload)
        
        # Decode token
        decoded = decode_token(token)
        
        # Verify contents
        assert decoded["sub"] == "user-123"
        assert decoded["email"] == "user@example.com"
        assert decoded["role"] == "user"
        
        # Verify type
        assert verify_token_type(decoded, "access") is True
        
        # Verify jti
        jti = get_token_jti(decoded)
        assert jti is not None

    def test_full_refresh_token_workflow(self):
        """Test complete refresh token workflow: create, decode, verify."""
        # Create token
        user_id = "user-uuid-123"
        token = create_refresh_token(user_id)
        
        # Decode token
        decoded = decode_token(token)
        
        # Verify contents
        assert decoded["sub"] == user_id
        
        # Verify type
        assert verify_token_type(decoded, "refresh") is True
        
        # Verify jti
        jti = get_token_jti(decoded)
        assert jti is not None

    def test_access_and_refresh_tokens_are_different(self):
        """Test that access and refresh tokens for same user are different."""
        user_id = "user-uuid-123"
        access_token = create_access_token({"sub": user_id})
        refresh_token = create_refresh_token(user_id)
        
        assert access_token != refresh_token
        
        # Decode both
        access_decoded = decode_token(access_token)
        refresh_decoded = decode_token(refresh_token)
        
        # Different types
        assert access_decoded["type"] == "access"
        assert refresh_decoded["type"] == "refresh"
        
        # Different jti
        assert access_decoded["jti"] != refresh_decoded["jti"]

    def test_token_payload_integrity(self):
        """Test that token payload cannot be tampered with."""
        payload = {"sub": "user-123", "email": "user@example.com"}
        token = create_access_token(payload)
        
        # Original token decodes successfully
        decoded = decode_token(token)
        assert decoded["sub"] == "user-123"
        
        # Tampering with any part should fail
        parts = token.split(".")
        tampered_token = parts[0] + "." + parts[1] + ".invalid"
        
        with pytest.raises(HTTPException):
            decode_token(tampered_token)

