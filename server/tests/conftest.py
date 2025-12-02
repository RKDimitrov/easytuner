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
    Create a test user with TOS accepted.
    
    Args:
        db_session: Database session
        
    Returns:
        User: Test user
    """
    from datetime import datetime
    from app.auth.password import hash_password
    
    user = User(
        email="test@example.com",
        password_hash=hash_password("TestPassword123!"),
        role="user",
        is_active=True,
        tos_accepted_at=datetime.utcnow(),  # timezone-naive for PostgreSQL
        tos_version=1,
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


@pytest_asyncio.fixture
async def test_scan_job(db_session: AsyncSession, test_firmware_file: FirmwareFile):
    """
    Create a test scan job.
    
    Args:
        db_session: Database session
        test_firmware_file: Test firmware file
        
    Returns:
        ScanJob: Test scan job
    """
    from app.models.scan_job import ScanJob
    
    scan = ScanJob(
        file_id=test_firmware_file.file_id,
        status="queued",
        scan_config={"data_types": ["u16LE", "u32LE"], "min_confidence": 0.6},
    )
    db_session.add(scan)
    await db_session.commit()
    await db_session.refresh(scan)
    return scan


@pytest_asyncio.fixture
async def test_candidate(db_session: AsyncSession, test_scan_job):
    """
    Create a test candidate.
    
    Args:
        db_session: Database session
        test_scan_job: Test scan job
        
    Returns:
        Candidate: Test candidate
    """
    from app.models.candidate import Candidate
    
    candidate = Candidate(
        scan_id=test_scan_job.scan_id,
        type="2D",
        confidence=0.85,
        byte_offset_start=1000,
        byte_offset_end=1512,
        data_type="u16LE",
        dimensions={"rows": 16, "cols": 16},
        feature_scores={
            "gradient_smoothness": 0.85,
            "entropy": 0.72,
            "boundary_alignment": 1.0,
        },
        detection_method_version="v1.0.0",
    )
    db_session.add(candidate)
    await db_session.commit()
    await db_session.refresh(candidate)
    return candidate


# Authentication fixtures for integration tests

@pytest_asyncio.fixture
async def async_client(test_engine) -> AsyncGenerator:
    """Get async test client with database override for test_auth_dependencies."""
    from httpx import AsyncClient
    from app.main import app
    from app.database import get_db
    
    # Override get_db dependency
    async def override_get_db():
        async_session = async_sessionmaker(
            test_engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        async with async_session() as session:
            yield session
            await session.rollback()
    
    app.dependency_overrides[get_db] = override_get_db
    
    # Import test app routes
    from tests.integration.test_auth_dependencies import app as test_app
    test_app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(app=test_app, base_url="http://test") as client:
        yield client
    
    # Clean up
    app.dependency_overrides.clear()
    test_app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def async_client_main(test_engine) -> AsyncGenerator:
    """Get async test client for main app with database override."""
    from httpx import AsyncClient
    from app.main import app
    from app.database import get_db
    
    # Override get_db dependency
    async def override_get_db():
        async_session = async_sessionmaker(
            test_engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        async with async_session() as session:
            yield session
            await session.rollback()
    
    app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client
    
    # Clean up
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_user_with_tos(db_session: AsyncSession) -> User:
    """Create a test user with TOS accepted."""
    from datetime import datetime
    from app.auth.password import hash_password
    
    user = User(
        email="user@example.com",
        password_hash=hash_password("TestPassword123!"),
        role="user",
        is_active=True,
        tos_accepted_at=datetime.utcnow(),  # timezone-naive
        tos_version=1,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> User:
    """Create an admin user."""
    from datetime import datetime
    from app.auth.password import hash_password
    
    user = User(
        email="admin@example.com",
        password_hash=hash_password("AdminPassword123!"),
        role="admin",
        is_active=True,
        tos_accepted_at=datetime.utcnow(),  # timezone-naive
        tos_version=1,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def inactive_user(db_session: AsyncSession) -> User:
    """Create an inactive user."""
    from app.auth.password import hash_password
    
    user = User(
        email="inactive@example.com",
        password_hash=hash_password("InactivePassword123!"),
        role="user",
        is_active=False,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def user_without_tos(db_session: AsyncSession) -> User:
    """Create a user without TOS acceptance."""
    from app.auth.password import hash_password
    
    user = User(
        email="notos@example.com",
        password_hash=hash_password("NoTOSPassword123!"),
        role="user",
        is_active=True,
        tos_accepted_at=None,
        tos_version=None,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
def access_token(test_user: User) -> str:
    """Create an access token for test user."""
    from app.auth.jwt import create_access_token
    
    return create_access_token({
        "sub": str(test_user.user_id),
        "email": test_user.email,
        "role": test_user.role,
    })


@pytest.fixture
def admin_token(admin_user: User) -> str:
    """Create an access token for admin user."""
    from app.auth.jwt import create_access_token
    
    return create_access_token({
        "sub": str(admin_user.user_id),
        "email": admin_user.email,
        "role": admin_user.role,
    })


@pytest.fixture
def inactive_user_token(inactive_user: User) -> str:
    """Create an access token for inactive user."""
    from app.auth.jwt import create_access_token
    
    return create_access_token({
        "sub": str(inactive_user.user_id),
        "email": inactive_user.email,
        "role": inactive_user.role,
    })


@pytest.fixture
def user_without_tos_token(user_without_tos: User) -> str:
    """Create an access token for user without TOS."""
    from app.auth.jwt import create_access_token
    
    return create_access_token({
        "sub": str(user_without_tos.user_id),
        "email": user_without_tos.email,
        "role": user_without_tos.role,
    })

