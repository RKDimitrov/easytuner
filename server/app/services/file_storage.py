"""
Simple file storage service for MVP.
Stores uploaded firmware files on the local filesystem.
"""
import os
import hashlib
import logging
from pathlib import Path
from typing import Optional, BinaryIO
from uuid import UUID

from app.config import settings

logger = logging.getLogger(__name__)


class FileStorageService:
    """Simple filesystem-based file storage for MVP."""
    
    def __init__(self, base_path: Optional[Path] = None):
        """
        Initialize file storage service.
        
        Args:
            base_path: Base directory for file storage. If None, uses settings.
        """
        self.base_path = base_path or Path(settings.upload_dir)
        self._ensure_storage_dir()
    
    def _ensure_storage_dir(self) -> None:
        """Ensure the storage directory exists."""
        try:
            self.base_path.mkdir(parents=True, exist_ok=True)
            logger.info(f"Storage directory ready: {self.base_path}")
        except Exception as e:
            logger.error(f"Failed to create storage directory: {e}")
            raise
    
    def _get_file_path(self, file_id: UUID) -> Path:
        """
        Get the filesystem path for a file ID.
        
        Args:
            file_id: UUID of the firmware file
            
        Returns:
            Path to the file
        """
        # Organize files in subdirectories by first 2 chars of UUID
        # e.g., UUID "a1b2c3..." -> uploads/a1/a1b2c3...
        file_id_str = str(file_id)
        subdir = file_id_str[:2]
        return self.base_path / subdir / file_id_str
    
    def save_file(self, file_id: UUID, file_content: bytes) -> str:
        """
        Save a file to storage.
        
        Args:
            file_id: UUID of the firmware file
            file_content: Raw bytes of the file
            
        Returns:
            Storage path (relative to base_path)
            
        Raises:
            IOError: If file cannot be saved
        """
        try:
            file_path = self._get_file_path(file_id)
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Write file
            with open(file_path, 'wb') as f:
                f.write(file_content)
            
            # Verify file was written
            if not file_path.exists():
                raise IOError(f"File was not written: {file_path}")
            
            # Calculate SHA-256 hash for verification
            file_hash = hashlib.sha256(file_content).hexdigest()
            
            logger.info(f"Saved file {file_id}: {len(file_content)} bytes, hash={file_hash[:16]}...")
            
            # Return relative path
            return str(file_path.relative_to(self.base_path))
            
        except Exception as e:
            logger.error(f"Failed to save file {file_id}: {e}")
            raise IOError(f"Failed to save file: {e}")
    
    def read_file(self, file_id: UUID) -> bytes:
        """
        Read a file from storage.
        
        Args:
            file_id: UUID of the firmware file
            
        Returns:
            File contents as bytes
            
        Raises:
            FileNotFoundError: If file doesn't exist
            IOError: If file cannot be read
        """
        try:
            file_path = self._get_file_path(file_id)
            
            if not file_path.exists():
                raise FileNotFoundError(f"File not found: {file_id}")
            
            with open(file_path, 'rb') as f:
                content = f.read()
            
            logger.info(f"Read file {file_id}: {len(content)} bytes")
            return content
            
        except FileNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Failed to read file {file_id}: {e}")
            raise IOError(f"Failed to read file: {e}")
    
    def delete_file(self, file_id: UUID) -> bool:
        """
        Delete a file from storage.
        
        Args:
            file_id: UUID of the firmware file
            
        Returns:
            True if file was deleted, False if it didn't exist
        """
        try:
            file_path = self._get_file_path(file_id)
            
            if not file_path.exists():
                logger.warning(f"File not found for deletion: {file_id}")
                return False
            
            file_path.unlink()
            
            # Try to remove empty parent directory
            try:
                file_path.parent.rmdir()
            except OSError:
                pass  # Directory not empty, that's fine
            
            logger.info(f"Deleted file: {file_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete file {file_id}: {e}")
            return False
    
    def file_exists(self, file_id: UUID) -> bool:
        """
        Check if a file exists in storage.
        
        Args:
            file_id: UUID of the firmware file
            
        Returns:
            True if file exists, False otherwise
        """
        file_path = self._get_file_path(file_id)
        return file_path.exists()
    
    def get_file_size(self, file_id: UUID) -> Optional[int]:
        """
        Get the size of a file in bytes.
        
        Args:
            file_id: UUID of the firmware file
            
        Returns:
            File size in bytes, or None if file doesn't exist
        """
        try:
            file_path = self._get_file_path(file_id)
            if file_path.exists():
                return file_path.stat().st_size
            return None
        except Exception as e:
            logger.error(f"Failed to get file size for {file_id}: {e}")
            return None


# Singleton instance
file_storage = FileStorageService()

