"""Pytest configuration and fixtures."""

from typing import AsyncGenerator
from urllib.parse import urlparse, urlunparse
from uuid import uuid4

import pytest
import pytest_asyncio
import sqlalchemy as sa
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.database import Base
from app.main import app
from app.models.firmware_file import FirmwareFile
from app.models.project import Project
from app.models.session import Session
from app.models.user import User

# Use a separate test database URL
# Parse the original URL and replace just the database name
_original_url = str(settings.database_url)
parsed = urlparse(_original_url)
# Replace the path (database name) but keep everything else
test_path = parsed.path.replace("/easytuner", "/easytuner_test") if "/easytuner" in parsed.path else "/easytuner_test"
TEST_DATABASE_URL = urlunparse((
    parsed.scheme,
    parsed.netloc,
    test_path,
    parsed.params,
    parsed.query,
    parsed.fragment
))


@pytest.fixture
def client() -> TestClient:
    """
    Get test client for FastAPI app.
    
    Returns:
        TestClient: FastAPI test client
    """
    return TestClient(app)


@pytest_asyncio.fixture
async def test_engine():
    """Create a test database engine."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    
    # Create extension and tables
    async with engine.begin() as conn:
        # Enable pg_trgm extension for fuzzy search
        await conn.execute(sa.text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    # Drop all tables after tests
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """
    Get test database session.
    
    Yields:
        AsyncSession: Test database session
    """
    async_session = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    async with async_session() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    """
    Create a test user.
    
    Args:
        db_session: Database session
        
    Returns:
        User: Test user
    """
    user = User(
        email="test@example.com",
        password_hash="hashed_password",
        role="user",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_project(db_session: AsyncSession, test_user: User) -> Project:
    """
    Create a test project.
    
    Args:
        db_session: Database session
        test_user: Test user
        
    Returns:
        Project: Test project
    """
    project = Project(
        owner_user_id=test_user.user_id,
        name="Test Project",
        description="A test project",
        is_private=True,
    )
    db_session.add(project)
    await db_session.commit()
    await db_session.refresh(project)
    return project


@pytest_asyncio.fixture
async def test_firmware_file(db_session: AsyncSession, test_project: Project) -> FirmwareFile:
    """
    Create a test firmware file.
    
    Args:
        db_session: Database session
        test_project: Test project
        
    Returns:
        FirmwareFile: Test firmware file
    """
    firmware_file = FirmwareFile(
        project_id=test_project.project_id,
        filename="test_firmware.bin",
        size_bytes=1024,
        sha256="a" * 64,  # 64 character hex string
        storage_path="/test/path/firmware.bin",
        endianness_hint="little",
    )
    db_session.add(firmware_file)
    await db_session.commit()
    await db_session.refresh(firmware_file)
    return firmware_file

