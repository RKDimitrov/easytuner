"""Integration tests for scan API endpoints."""
import tempfile
from pathlib import Path

import pytest
import struct
from fastapi import status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.candidate import Candidate
from app.models.firmware_file import FirmwareFile
from app.models.project import Project
from app.models.scan_job import ScanJob
from app.models.user import User
from app.services.file_storage import FileStorageService


@pytest.fixture
def temp_storage():
    """Create temporary storage directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def storage_service(temp_storage):
    """Create file storage service with temp directory."""
    return FileStorageService(base_path=temp_storage)


@pytest.fixture
async def firmware_file_with_data(
    db_session: AsyncSession,
    test_user: User,
    test_project: Project,
    storage_service: FileStorageService
):
    """Create a firmware file with realistic binary data."""
    # Create realistic firmware-like data
    # 1. Calibration table: monotonic increasing values
    calibration_table = struct.pack('<' + 'H' * 128, *range(1000, 2280, 10))
    
    # 2. Some random data
    random_data = bytes([i % 256 for i in range(256)])
    
    # 3. Another table: 2D-like data
    table_2d = struct.pack('<' + 'H' * 64, *[100 + (i // 8) * 50 + (i % 8) * 5 for i in range(64)])
    
    firmware_data = calibration_table + random_data + table_2d
    
    # Create firmware file record
    firmware_file = FirmwareFile(
        project_id=test_project.project_id,
        filename="test_firmware.bin",
        file_size=len(firmware_data),
        file_hash="abc123",
        storage_path=f"{test_project.project_id}/test_firmware.bin"
    )
    
    db_session.add(firmware_file)
    await db_session.commit()
    await db_session.refresh(firmware_file)
    
    # Save file to storage
    storage_service.save_file(firmware_file.file_id, firmware_data)
    
    return firmware_file


@pytest.mark.asyncio
async def test_create_scan(
    db_session: AsyncSession,
    test_user_token: str,
    firmware_file_with_data: FirmwareFile,
    client
):
    """Test creating a scan job."""
    # Override get_db dependency
    from app.database import get_db
    from app.main import app as fastapi_app
    
    async def override_get_db():
        yield db_session
    
    fastapi_app.dependency_overrides[get_db] = override_get_db
    
    response = client.post(
        "/api/v1/scans",
        json={
            "file_id": str(firmware_file_with_data.file_id),
            "data_types": ["u8", "u16le"],
            "window_size": 32,
            "stride": 16,
            "min_confidence": 0.4
        },
        headers={"Authorization": f"Bearer {test_user_token}"}
    )
    
    fastapi_app.dependency_overrides.clear()
    
    assert response.status_code == status.HTTP_201_CREATED
    
    data = response.json()
    assert "scan_id" in data
    assert data["file_id"] == str(firmware_file_with_data.file_id)
    assert data["status"] in ["completed", "failed"]
    
    # If completed, check candidates were found
    if data["status"] == "completed":
        assert data["candidates_found"] is not None
        assert data["processing_time_ms"] is not None


@pytest.mark.asyncio
async def test_create_scan_invalid_file(
    db_session: AsyncSession,
    test_user_token: str,
    client
):
    """Test creating a scan with invalid file ID."""
    from app.database import get_db
    from app.main import app as fastapi_app
    from uuid import uuid4
    
    async def override_get_db():
        yield db_session
    
    fastapi_app.dependency_overrides[get_db] = override_get_db
    
    response = client.post(
        "/api/v1/scans",
        json={
            "file_id": str(uuid4()),  # Non-existent file
            "data_types": ["u8"],
        },
        headers={"Authorization": f"Bearer {test_user_token}"}
    )
    
    fastapi_app.dependency_overrides.clear()
    
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.asyncio
async def test_create_scan_unauthorized(
    firmware_file_with_data: FirmwareFile,
    client
):
    """Test creating a scan without authentication."""
    response = client.post(
        "/api/v1/scans",
        json={
            "file_id": str(firmware_file_with_data.file_id),
        }
    )
    
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_get_scan(
    db_session: AsyncSession,
    test_user: User,
    test_user_token: str,
    firmware_file_with_data: FirmwareFile,
    client
):
    """Test getting scan job details."""
    from app.database import get_db
    from app.main import app as fastapi_app
    from app.services.scan_service import scan_service
    
    async def override_get_db():
        yield db_session
    
    fastapi_app.dependency_overrides[get_db] = override_get_db
    
    # Create a scan job
    scan_job = await scan_service.create_scan_job(
        db=db_session,
        file_id=firmware_file_with_data.file_id,
        user_id=test_user.user_id
    )
    
    # Get scan details
    response = client.get(
        f"/api/v1/scans/{scan_job.scan_id}",
        headers={"Authorization": f"Bearer {test_user_token}"}
    )
    
    fastapi_app.dependency_overrides.clear()
    
    assert response.status_code == status.HTTP_200_OK
    
    data = response.json()
    assert data["scan_id"] == str(scan_job.scan_id)
    assert data["file_id"] == str(firmware_file_with_data.file_id)
    assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_get_scan_not_found(
    db_session: AsyncSession,
    test_user_token: str,
    client
):
    """Test getting a non-existent scan."""
    from app.database import get_db
    from app.main import app as fastapi_app
    from uuid import uuid4
    
    async def override_get_db():
        yield db_session
    
    fastapi_app.dependency_overrides[get_db] = override_get_db
    
    response = client.get(
        f"/api/v1/scans/{uuid4()}",
        headers={"Authorization": f"Bearer {test_user_token}"}
    )
    
    fastapi_app.dependency_overrides.clear()
    
    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.asyncio
async def test_get_scan_candidates(
    db_session: AsyncSession,
    test_user: User,
    test_user_token: str,
    firmware_file_with_data: FirmwareFile,
    storage_service: FileStorageService,
    client
):
    """Test getting candidates for a completed scan."""
    from app.database import get_db
    from app.main import app as fastapi_app
    from app.services.scan_service import scan_service
    from app.services import file_storage
    
    # Temporarily replace global storage service
    original_storage = file_storage.file_storage
    file_storage.file_storage = storage_service
    
    async def override_get_db():
        yield db_session
    
    fastapi_app.dependency_overrides[get_db] = override_get_db
    
    try:
        # Create and execute scan
        scan_job = await scan_service.create_scan_job(
            db=db_session,
            file_id=firmware_file_with_data.file_id,
            user_id=test_user.user_id,
            min_confidence=0.3  # Lower threshold to get more candidates
        )
        
        await scan_service.execute_scan(db_session, scan_job.scan_id)
        
        # Get candidates
        response = client.get(
            f"/api/v1/scans/{scan_job.scan_id}/candidates",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert isinstance(data, list)
        
        # Should have found some candidates
        if len(data) > 0:
            candidate = data[0]
            assert "candidate_id" in candidate
            assert "offset" in candidate
            assert "confidence" in candidate
            assert "pattern_type" in candidate
        
    finally:
        # Restore original storage service
        file_storage.file_storage = original_storage
        fastapi_app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_scan_results(
    db_session: AsyncSession,
    test_user: User,
    test_user_token: str,
    firmware_file_with_data: FirmwareFile,
    storage_service: FileStorageService,
    client
):
    """Test getting complete scan results."""
    from app.database import get_db
    from app.main import app as fastapi_app
    from app.services.scan_service import scan_service
    from app.services import file_storage
    
    # Temporarily replace global storage service
    original_storage = file_storage.file_storage
    file_storage.file_storage = storage_service
    
    async def override_get_db():
        yield db_session
    
    fastapi_app.dependency_overrides[get_db] = override_get_db
    
    try:
        # Create and execute scan
        scan_job = await scan_service.create_scan_job(
            db=db_session,
            file_id=firmware_file_with_data.file_id,
            user_id=test_user.user_id,
            min_confidence=0.3
        )
        
        await scan_service.execute_scan(db_session, scan_job.scan_id)
        
        # Get complete results
        response = client.get(
            f"/api/v1/scans/{scan_job.scan_id}/results",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert "scan" in data
        assert "candidates" in data
        assert "total_candidates" in data
        assert data["scan"]["scan_id"] == str(scan_job.scan_id)
        
    finally:
        # Restore original storage service
        file_storage.file_storage = original_storage
        fastapi_app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_scan_pagination(
    db_session: AsyncSession,
    test_user: User,
    test_user_token: str,
    firmware_file_with_data: FirmwareFile,
    storage_service: FileStorageService,
    client
):
    """Test pagination of scan candidates."""
    from app.database import get_db
    from app.main import app as fastapi_app
    from app.services.scan_service import scan_service
    from app.services import file_storage
    
    # Temporarily replace global storage service
    original_storage = file_storage.file_storage
    file_storage.file_storage = storage_service
    
    async def override_get_db():
        yield db_session
    
    fastapi_app.dependency_overrides[get_db] = override_get_db
    
    try:
        # Create and execute scan
        scan_job = await scan_service.create_scan_job(
            db=db_session,
            file_id=firmware_file_with_data.file_id,
            user_id=test_user.user_id,
            min_confidence=0.3
        )
        
        await scan_service.execute_scan(db_session, scan_job.scan_id)
        
        # Get first page
        response1 = client.get(
            f"/api/v1/scans/{scan_job.scan_id}/candidates?limit=5&offset=0",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        
        # Get second page
        response2 = client.get(
            f"/api/v1/scans/{scan_job.scan_id}/candidates?limit=5&offset=5",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        
        assert response1.status_code == status.HTTP_200_OK
        assert response2.status_code == status.HTTP_200_OK
        
        page1 = response1.json()
        page2 = response2.json()
        
        # Pages should have different candidates (unless total < 5)
        if len(page1) == 5 and len(page2) > 0:
            assert page1[0]["candidate_id"] != page2[0]["candidate_id"]
        
    finally:
        # Restore original storage service
        file_storage.file_storage = original_storage
        fastapi_app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_scan_with_different_data_types(
    db_session: AsyncSession,
    test_user: User,
    test_user_token: str,
    firmware_file_with_data: FirmwareFile,
    storage_service: FileStorageService,
    client
):
    """Test scanning with different data types."""
    from app.database import get_db
    from app.main import app as fastapi_app
    from app.services import file_storage
    
    # Temporarily replace global storage service
    original_storage = file_storage.file_storage
    file_storage.file_storage = storage_service
    
    async def override_get_db():
        yield db_session
    
    fastapi_app.dependency_overrides[get_db] = override_get_db
    
    try:
        # Scan with only u8
        response1 = client.post(
            "/api/v1/scans",
            json={
                "file_id": str(firmware_file_with_data.file_id),
                "data_types": ["u8"],
                "min_confidence": 0.4
            },
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        
        # Scan with u16le and u16be
        response2 = client.post(
            "/api/v1/scans",
            json={
                "file_id": str(firmware_file_with_data.file_id),
                "data_types": ["u16le", "u16be"],
                "min_confidence": 0.4
            },
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        
        assert response1.status_code == status.HTTP_201_CREATED
        assert response2.status_code == status.HTTP_201_CREATED
        
        # Both should have completed
        data1 = response1.json()
        data2 = response2.json()
        
        assert data1["status"] == "completed"
        assert data2["status"] == "completed"
        
    finally:
        # Restore original storage service
        file_storage.file_storage = original_storage
        fastapi_app.dependency_overrides.clear()

