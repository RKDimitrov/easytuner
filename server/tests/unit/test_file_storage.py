"""Unit tests for file storage service."""
import tempfile
from pathlib import Path
from uuid import uuid4

import pytest

from app.services.file_storage import FileStorageService


@pytest.fixture
def temp_storage_dir():
    """Create a temporary storage directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def storage_service(temp_storage_dir):
    """Create a file storage service with temp directory."""
    return FileStorageService(base_path=temp_storage_dir)


def test_storage_service_initialization(temp_storage_dir):
    """Test that storage service initializes correctly."""
    service = FileStorageService(base_path=temp_storage_dir)
    assert service.base_path == temp_storage_dir
    assert temp_storage_dir.exists()


def test_save_file(storage_service):
    """Test saving a file."""
    file_id = uuid4()
    content = b"Hello, World!"
    
    storage_path = storage_service.save_file(file_id, content)
    
    assert storage_path is not None
    assert storage_service.file_exists(file_id)


def test_read_file(storage_service):
    """Test reading a file."""
    file_id = uuid4()
    content = b"Test content for reading"
    
    storage_service.save_file(file_id, content)
    read_content = storage_service.read_file(file_id)
    
    assert read_content == content


def test_read_nonexistent_file(storage_service):
    """Test reading a file that doesn't exist."""
    file_id = uuid4()
    
    with pytest.raises(FileNotFoundError):
        storage_service.read_file(file_id)


def test_delete_file(storage_service):
    """Test deleting a file."""
    file_id = uuid4()
    content = b"Delete me"
    
    storage_service.save_file(file_id, content)
    assert storage_service.file_exists(file_id)
    
    result = storage_service.delete_file(file_id)
    assert result is True
    assert not storage_service.file_exists(file_id)


def test_delete_nonexistent_file(storage_service):
    """Test deleting a file that doesn't exist."""
    file_id = uuid4()
    
    result = storage_service.delete_file(file_id)
    assert result is False


def test_file_exists(storage_service):
    """Test checking file existence."""
    file_id = uuid4()
    
    assert not storage_service.file_exists(file_id)
    
    storage_service.save_file(file_id, b"Test")
    assert storage_service.file_exists(file_id)


def test_get_file_size(storage_service):
    """Test getting file size."""
    file_id = uuid4()
    content = b"A" * 1024  # 1KB
    
    storage_service.save_file(file_id, content)
    size = storage_service.get_file_size(file_id)
    
    assert size == 1024


def test_get_file_size_nonexistent(storage_service):
    """Test getting size of nonexistent file."""
    file_id = uuid4()
    
    size = storage_service.get_file_size(file_id)
    assert size is None


def test_save_large_file(storage_service):
    """Test saving a larger file."""
    file_id = uuid4()
    content = b"X" * (1024 * 1024)  # 1MB
    
    storage_path = storage_service.save_file(file_id, content)
    assert storage_path is not None
    
    read_content = storage_service.read_file(file_id)
    assert len(read_content) == len(content)


def test_subdirectory_organization(storage_service):
    """Test that files are organized in subdirectories."""
    file_id = uuid4()
    file_id_str = str(file_id)
    expected_subdir = file_id_str[:2]
    
    storage_service.save_file(file_id, b"Test")
    
    # Check that subdirectory was created
    subdir_path = storage_service.base_path / expected_subdir
    assert subdir_path.exists()
    assert subdir_path.is_dir()


def test_save_binary_data(storage_service):
    """Test saving binary firmware data."""
    file_id = uuid4()
    # Simulate binary firmware file
    content = bytes(range(256))
    
    storage_service.save_file(file_id, content)
    read_content = storage_service.read_file(file_id)
    
    assert read_content == content

