"""Unit tests for password hashing and validation."""

import pytest

from app.auth.password import (
    generate_random_password,
    hash_password,
    validate_password_strength,
    verify_password,
)


class TestPasswordHashing:
    """Tests for password hashing and verification."""

    def test_hash_password_returns_hash(self):
        """Test that hash_password returns a non-empty hash."""
        password = "MySecurePass123!"
        hashed = hash_password(password)
        assert hashed
        assert len(hashed) > 0
        assert hashed != password  # Hash should not equal plaintext

    def test_hash_password_different_hashes(self):
        """Test that hashing the same password twice produces different hashes."""
        password = "MySecurePass123!"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        assert hash1 != hash2  # bcrypt uses random salts

    def test_verify_password_correct(self):
        """Test that verify_password returns True for correct password."""
        password = "MySecurePass123!"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self):
        """Test that verify_password returns False for incorrect password."""
        password = "MySecurePass123!"
        hashed = hash_password(password)
        assert verify_password("WrongPassword123!", hashed) is False

    def test_verify_password_empty_string(self):
        """Test that verify_password handles empty strings correctly."""
        password = "MySecurePass123!"
        hashed = hash_password(password)
        assert verify_password("", hashed) is False

    def test_hash_password_special_characters(self):
        """Test hashing passwords with various special characters."""
        passwords = [
            "Test@123!Password",
            "P@ssw0rd#2024$",
            "C0mplex&P@ss*w0rd!",
        ]
        for password in passwords:
            hashed = hash_password(password)
            assert verify_password(password, hashed) is True

    def test_hash_password_unicode(self):
        """Test hashing passwords with Unicode characters."""
        password = "Pässwörd123!Test"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True


class TestPasswordStrengthValidation:
    """Tests for password strength validation."""

    def test_valid_password(self):
        """Test that a valid password passes all checks."""
        is_valid, msg = validate_password_strength("MySecure123!")
        assert is_valid is True
        assert msg == ""

    def test_valid_password_with_all_special_chars(self):
        """Test valid passwords with various special characters."""
        valid_passwords = [
            "ValidPass123!",
            "SecureP@ss123",
            "Test#Password1",
            "MyP@ssw0rd$2024",
            "C0mplex&Pass*word!",
            "Str0ng[]Pass{}word",
            "Valid|Pass;123:",
            "Test<Pass>456?",
        ]
        for password in valid_passwords:
            is_valid, msg = validate_password_strength(password)
            assert is_valid is True, f"Password '{password}' should be valid but got: {msg}"

    def test_password_too_short(self):
        """Test that passwords shorter than 12 characters fail."""
        is_valid, msg = validate_password_strength("Short1!")
        assert is_valid is False
        assert "12 characters" in msg

    def test_password_exactly_12_chars_valid(self):
        """Test that exactly 12 character password is valid if it meets requirements."""
        is_valid, msg = validate_password_strength("ValidPass12!")
        assert is_valid is True

    def test_password_no_uppercase(self):
        """Test that password without uppercase letter fails."""
        is_valid, msg = validate_password_strength("mysecure123!")
        assert is_valid is False
        assert "uppercase" in msg.lower()

    def test_password_no_lowercase(self):
        """Test that password without lowercase letter fails."""
        is_valid, msg = validate_password_strength("MYSECURE123!")
        assert is_valid is False
        assert "lowercase" in msg.lower()

    def test_password_no_digit(self):
        """Test that password without digit fails."""
        is_valid, msg = validate_password_strength("MySecurePass!")
        assert is_valid is False
        assert "digit" in msg.lower()

    def test_password_no_special_char(self):
        """Test that password without special character fails."""
        is_valid, msg = validate_password_strength("MySecure1234")
        assert is_valid is False
        assert "special character" in msg.lower()

    def test_password_empty_string(self):
        """Test that empty string fails validation."""
        is_valid, msg = validate_password_strength("")
        assert is_valid is False
        assert "12 characters" in msg

    def test_password_only_special_chars(self):
        """Test that password with only special characters fails."""
        is_valid, msg = validate_password_strength("!@#$%^&*()_+")
        assert is_valid is False
        # Should fail on missing uppercase, lowercase, or digit

    def test_password_very_long_valid(self):
        """Test that very long valid password passes."""
        long_password = "MyVeryLongSecurePassword123!WithManyCharacters"
        is_valid, msg = validate_password_strength(long_password)
        assert is_valid is True


class TestGenerateRandomPassword:
    """Tests for random password generation."""

    def test_generate_password_default_length(self):
        """Test generating password with default length."""
        password = generate_random_password()
        assert len(password) >= 16

    def test_generate_password_custom_length(self):
        """Test generating password with custom length."""
        password = generate_random_password(20)
        assert len(password) >= 20

    def test_generate_password_minimum_length(self):
        """Test generating password with minimum length."""
        password = generate_random_password(12)
        assert len(password) >= 12

    def test_generate_password_meets_strength_requirements(self):
        """Test that generated password passes strength validation."""
        password = generate_random_password(16)
        is_valid, msg = validate_password_strength(password)
        assert is_valid is True, f"Generated password failed validation: {msg}"

    def test_generate_password_different_passwords(self):
        """Test that generating passwords produces different results."""
        password1 = generate_random_password(16)
        password2 = generate_random_password(16)
        assert password1 != password2  # Extremely unlikely to be equal

    def test_generate_password_length_too_short_raises(self):
        """Test that generating password with length < 12 raises ValueError."""
        with pytest.raises(ValueError) as exc_info:
            generate_random_password(11)
        assert "12 characters" in str(exc_info.value)

    def test_generate_password_length_zero_raises(self):
        """Test that generating password with length 0 raises ValueError."""
        with pytest.raises(ValueError):
            generate_random_password(0)

    def test_generate_password_negative_length_raises(self):
        """Test that generating password with negative length raises ValueError."""
        with pytest.raises(ValueError):
            generate_random_password(-1)

    def test_generate_password_contains_all_character_types(self):
        """Test that generated password contains all required character types."""
        password = generate_random_password(16)
        
        # Check for uppercase
        assert any(c.isupper() for c in password), "Password missing uppercase"
        
        # Check for lowercase
        assert any(c.islower() for c in password), "Password missing lowercase"
        
        # Check for digit
        assert any(c.isdigit() for c in password), "Password missing digit"
        
        # Check for special character
        special_chars = "!@#$%^&*()_+-=[]{}|;:,.<>?"
        assert any(c in special_chars for c in password), "Password missing special char"

    def test_generate_multiple_passwords_all_valid(self):
        """Test generating multiple passwords and ensure all are valid."""
        for _ in range(10):
            password = generate_random_password(16)
            is_valid, msg = validate_password_strength(password)
            assert is_valid is True, f"Generated password failed: {msg}"


class TestPasswordHashingIntegration:
    """Integration tests for password hashing workflow."""

    def test_full_password_workflow(self):
        """Test complete workflow: generate, hash, verify."""
        # Generate a random password
        password = generate_random_password(16)
        
        # Validate it meets requirements
        is_valid, msg = validate_password_strength(password)
        assert is_valid is True
        
        # Hash the password
        hashed = hash_password(password)
        
        # Verify correct password
        assert verify_password(password, hashed) is True
        
        # Verify incorrect password
        wrong_password = generate_random_password(16)
        assert verify_password(wrong_password, hashed) is False

    def test_user_password_lifecycle(self):
        """Test typical user password lifecycle."""
        # User creates password
        user_password = "MyNewAccount123!"
        
        # Validate password meets requirements
        is_valid, msg = validate_password_strength(user_password)
        assert is_valid is True
        
        # Hash for storage
        password_hash = hash_password(user_password)
        
        # Simulate login - verify password
        assert verify_password(user_password, password_hash) is True
        
        # Simulate failed login
        assert verify_password("WrongPassword123!", password_hash) is False

    def test_hash_verification_case_sensitive(self):
        """Test that password verification is case-sensitive."""
        password = "MySecurePass123!"
        hashed = hash_password(password)
        
        assert verify_password(password, hashed) is True
        assert verify_password("mysecurepass123!", hashed) is False
        assert verify_password("MYSECUREPASS123!", hashed) is False

