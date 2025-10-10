"""Pytest configuration and fixtures."""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    """
    Get test client for FastAPI app.
    
    Returns:
        TestClient: FastAPI test client
    """
    return TestClient(app)

