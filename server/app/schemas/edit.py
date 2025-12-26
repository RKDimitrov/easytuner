"""Pydantic schemas for file editing operations."""

from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class EditOperation(BaseModel):
    """A single edit operation on a binary file."""
    
    offset: int = Field(..., description="Byte offset in the file", ge=0)
    value: int = Field(..., description="New value to write")
    data_type: str = Field(
        default="u8",
        description="Data type: u8, u16le, u16be, u32le, u32be",
        pattern="^(u8|u16le|u16be|u32le|u32be)$"
    )
    original_value: Optional[int] = Field(
        None,
        description="Original value before edit (for history/undo)"
    )


class EditBatchRequest(BaseModel):
    """Request to apply multiple edits to a file."""
    
    edits: List[EditOperation] = Field(..., description="List of edits to apply")
    create_new_version: bool = Field(
        default=True,
        description="Create a new file version instead of overwriting"
    )


class EditResponse(BaseModel):
    """Response after applying edits."""
    
    success: bool
    file_id: UUID = Field(..., description="ID of the modified file (new if create_new_version=True)")
    original_file_id: Optional[UUID] = Field(None, description="ID of original file if new version created")
    edits_applied: int = Field(..., description="Number of edits successfully applied")
    file_size: int = Field(..., description="Size of modified file in bytes")


class EditHistoryEntry(BaseModel):
    """A single entry in edit history."""
    
    offset: int
    original_value: int
    new_value: int
    data_type: str
    timestamp: str


class EditHistoryResponse(BaseModel):
    """Response containing edit history."""
    
    file_id: UUID
    history: List[EditHistoryEntry]

