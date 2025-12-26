"""Service for editing binary firmware files."""

import logging
import struct
from typing import List, Tuple
from uuid import UUID

from app.services.file_storage import file_storage
from app.schemas.edit import EditOperation

logger = logging.getLogger(__name__)


class EditService:
    """Service for applying edits to binary files."""
    
    # Data type to struct format mapping
    TYPE_FORMATS = {
        'u8': ('B', 1),      # unsigned 8-bit
        'u16le': ('<H', 2),   # unsigned 16-bit little-endian
        'u16be': ('>H', 2),   # unsigned 16-bit big-endian
        'u32le': ('<I', 4),   # unsigned 32-bit little-endian
        'u32be': ('>I', 4),   # unsigned 32-bit big-endian
    }
    
    def __init__(self):
        """Initialize the edit service."""
        pass
    
    def validate_edit(self, file_data: bytes, edit: EditOperation) -> Tuple[bool, str]:
        """
        Validate that an edit operation is valid.
        
        Args:
            file_data: Current file data
            edit: Edit operation to validate
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if edit.data_type not in self.TYPE_FORMATS:
            return False, f"Invalid data type: {edit.data_type}"
        
        _, size = self.TYPE_FORMATS[edit.data_type]
        
        # Check bounds
        if edit.offset < 0:
            return False, f"Offset cannot be negative: {edit.offset}"
        
        if edit.offset + size > len(file_data):
            return False, f"Edit extends beyond file bounds: offset={edit.offset}, size={size}, file_size={len(file_data)}"
        
        # Check value range
        max_value = {
            'u8': 0xFF,
            'u16le': 0xFFFF,
            'u16be': 0xFFFF,
            'u32le': 0xFFFFFFFF,
            'u32be': 0xFFFFFFFF,
        }[edit.data_type]
        
        if edit.value < 0 or edit.value > max_value:
            return False, f"Value out of range for {edit.data_type}: {edit.value} (max: {max_value})"
        
        return True, ""
    
    def apply_edit(self, file_data: bytearray, edit: EditOperation) -> Tuple[bool, str]:
        """
        Apply a single edit to file data in-place.
        
        Args:
            file_data: File data to modify (will be modified in-place)
            edit: Edit operation to apply
            
        Returns:
            Tuple of (success, error_message)
        """
        # Validate edit
        is_valid, error = self.validate_edit(file_data, edit)
        if not is_valid:
            return False, error
        
        # Get format and size
        format_str, size = self.TYPE_FORMATS[edit.data_type]
        
        try:
            # Pack the value into bytes
            packed = struct.pack(format_str, edit.value)
            
            # Write to file data
            file_data[edit.offset:edit.offset + size] = packed
            
            logger.debug(
                f"Applied edit: offset=0x{edit.offset:X}, "
                f"value={edit.value} (0x{edit.value:X}), "
                f"type={edit.data_type}, bytes={packed.hex()}"
            )
            
            return True, ""
            
        except struct.error as e:
            return False, f"Failed to pack value {edit.value} as {edit.data_type}: {e}"
        except Exception as e:
            return False, f"Failed to apply edit: {e}"
    
    def apply_edits(
        self,
        file_id: UUID,
        edits: List[EditOperation]
    ) -> Tuple[bytearray, List[Tuple[int, str]]]:
        """
        Apply multiple edits to a file.
        
        Args:
            file_id: ID of the file to edit
            edits: List of edit operations
            
        Returns:
            Tuple of (modified_file_data, list_of_errors)
            Errors are tuples of (edit_index, error_message)
        """
        # Read original file
        try:
            original_data = file_storage.read_file(file_id)
        except Exception as e:
            logger.error(f"Failed to read file {file_id}: {e}")
            raise ValueError(f"Failed to read file: {e}")
        
        # Create mutable copy
        file_data = bytearray(original_data)
        
        errors = []
        
        # Apply each edit
        for i, edit in enumerate(edits):
            success, error = self.apply_edit(file_data, edit)
            if not success:
                errors.append((i, error))
                logger.warning(f"Edit {i} failed: {error}")
        
        if errors:
            logger.warning(f"Applied {len(edits) - len(errors)}/{len(edits)} edits successfully")
        else:
            logger.info(f"Successfully applied all {len(edits)} edits to file {file_id}")
        
        return file_data, errors
    
    def read_value(
        self,
        file_data: bytes,
        offset: int,
        data_type: str
    ) -> Tuple[int, bool, str]:
        """
        Read a value from file data at a specific offset.
        
        Args:
            file_data: File data to read from
            offset: Byte offset
            data_type: Data type (u8, u16le, etc.)
            
        Returns:
            Tuple of (value, success, error_message)
        """
        if data_type not in self.TYPE_FORMATS:
            return 0, False, f"Invalid data type: {data_type}"
        
        format_str, size = self.TYPE_FORMATS[data_type]
        
        # Check bounds
        if offset < 0 or offset + size > len(file_data):
            return 0, False, f"Offset out of bounds: offset={offset}, size={size}, file_size={len(file_data)}"
        
        try:
            # Extract bytes
            bytes_data = file_data[offset:offset + size]
            
            # Unpack
            value = struct.unpack(format_str, bytes_data)[0]
            
            return value, True, ""
            
        except struct.error as e:
            return 0, False, f"Failed to unpack value: {e}"
        except Exception as e:
            return 0, False, f"Failed to read value: {e}"


# Singleton instance
edit_service = EditService()

