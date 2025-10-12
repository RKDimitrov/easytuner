"""Password hashing and validation utilities.

This module provides secure password management using bcrypt for hashing
and comprehensive validation functions.
"""

import re
import secrets
import string
from typing import Tuple

import bcrypt


def hash_password(password: str) -> str:
    """Hash a password using bcrypt.

    Args:
        password: The plaintext password to hash.

    Returns:
        The bcrypt hash of the password.

    Example:
        >>> hashed = hash_password("MySecurePass123!")
        >>> len(hashed) > 0
        True
    """
    # Convert password to bytes and generate a salt
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    # Return as string for storage
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a bcrypt hash.

    Args:
        plain_password: The plaintext password to verify.
        hashed_password: The bcrypt hash to verify against.

    Returns:
        True if the password matches the hash, False otherwise.

    Example:
        >>> hashed = hash_password("MySecurePass123!")
        >>> verify_password("MySecurePass123!", hashed)
        True
        >>> verify_password("wrong_password", hashed)
        False
    """
    try:
        password_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        # Invalid hash format or other errors
        return False


def validate_password_strength(password: str) -> Tuple[bool, str]:
    """Validate password strength against security requirements.

    Password Requirements:
    - Minimum length: 12 characters
    - At least one uppercase letter (A-Z)
    - At least one lowercase letter (a-z)
    - At least one digit (0-9)
    - At least one special character from: !@#$%^&*()_+-=[]{}|;:,.<>?

    Args:
        password: The password to validate.

    Returns:
        A tuple of (is_valid, error_message).
        If valid, returns (True, "").
        If invalid, returns (False, "error message").

    Example:
        >>> validate_password_strength("MySecure123!")
        (True, '')
        >>> validate_password_strength("short")
        (False, 'Password must be at least 12 characters long')
    """
    # Check minimum length
    if len(password) < 12:
        return False, "Password must be at least 12 characters long"

    # Check for uppercase letter
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"

    # Check for lowercase letter
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"

    # Check for digit
    if not re.search(r"\d", password):
        return False, "Password must contain at least one digit"

    # Check for special character
    special_chars = r"[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]"
    if not re.search(special_chars, password):
        return (
            False,
            "Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)",
        )

    return True, ""


def generate_random_password(length: int = 16) -> str:
    """Generate a cryptographically random password.

    The generated password will meet all strength requirements:
    - Contains uppercase letters
    - Contains lowercase letters
    - Contains digits
    - Contains special characters

    Args:
        length: The length of the password (minimum 12). Defaults to 16.

    Returns:
        A randomly generated password that meets strength requirements.

    Raises:
        ValueError: If length is less than 12.

    Example:
        >>> password = generate_random_password(16)
        >>> len(password) >= 16
        True
        >>> validate_password_strength(password)[0]
        True
    """
    if length < 12:
        raise ValueError("Password length must be at least 12 characters")

    # Define character sets
    uppercase = string.ascii_uppercase
    lowercase = string.ascii_lowercase
    digits = string.digits
    special = "!@#$%^&*()_+-=[]{}|;:,.<>?"

    # Ensure at least one character from each required set
    password_chars = [
        secrets.choice(uppercase),
        secrets.choice(lowercase),
        secrets.choice(digits),
        secrets.choice(special),
    ]

    # Fill remaining length with random characters from all sets
    all_chars = uppercase + lowercase + digits + special
    password_chars.extend(
        secrets.choice(all_chars) for _ in range(length - 4)
    )

    # Shuffle to avoid predictable patterns
    # Using secrets.SystemRandom for cryptographic randomness
    secure_random = secrets.SystemRandom()
    secure_random.shuffle(password_chars)

    return "".join(password_chars)

