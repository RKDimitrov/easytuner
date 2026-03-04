"""
Schemas for the Map Assistant chat API.

Request payload: project_context, scanned_files, maps, user_message.
Response: summary, issues, suggestions, ask_vehicle (optional).
"""
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


# --- Project context (high-level goal and scope) ---
class ProjectContext(BaseModel):
    """High-level project and user goal for the assistant."""

    summary: str = Field(
        ...,
        description="1–2 sentence description of the project and current goal",
    )
    vehicle_model: Optional[str] = Field(
        default=None,
        description="Vehicle or ECU model (e.g. BMW N55 2015). Required for tune suggestions.",
    )
    intent: Optional[Literal["analyze_only", "tune", "compare", "document"]] = Field(
        default=None,
        description="User intent to tailor answers (e.g. no tune advice if analyze_only).",
    )


# --- Scanned file summary (no raw binary) ---
class ScannedFileEntry(BaseModel):
    """Summary of one firmware file in the project."""

    file_id: str = Field(..., description="UUID of the file")
    filename: str = Field(..., description="Original filename")
    size_bytes: int = Field(..., description="File size in bytes")
    project_name: str = Field(..., description="Name of the project")
    scan_id: Optional[str] = Field(default=None, description="UUID of latest/completed scan or null")
    candidates_count: int = Field(default=0, description="Number of map candidates from scan")
    summary: Optional[str] = Field(default=None, description="Optional 1-line description")


# --- Map/table object (ECU calibration table) ---
class MapEntry(BaseModel):
    """One ECU calibration map (1D/2D/3D) for the assistant."""

    map_id: str = Field(..., description="UUID of the map/candidate")
    file_id: str = Field(..., description="UUID of the firmware file")
    scan_id: str = Field(..., description="UUID of the scan that found this map")
    type: Literal["1D", "2D", "3D", "single"] = Field(..., description="Map structure type")
    offset: int = Field(..., description="Byte offset in the file")
    offset_hex: str = Field(..., description="Hex string of offset (e.g. 0x3039)")
    size_bytes: int = Field(..., description="Size of the map in bytes")
    data_type: str = Field(..., description="e.g. u16le, u32be, float32le")
    confidence: float = Field(..., ge=0, le=1, description="Detection confidence 0.0–1.0")
    dimensions: Dict[str, int] = Field(default_factory=dict, description="e.g. {x: 16, y: 16}")
    name: Optional[str] = Field(default=None, description="Optional user label")
    description: Optional[str] = Field(default=None, description="Optional description")
    unit: Optional[str] = Field(default=None, description="Optional unit e.g. mg/stroke")
    axis_summary: Optional[str] = Field(default=None, description="e.g. X=RPM, Y=load")
    data_sample: Optional[List[Any]] = Field(
        default=None,
        description="Optional first row or small 2D slice as array of numbers",
    )
    annotations_count: int = Field(default=0, description="Number of annotations")


# --- Assistant chat request ---
class AssistantChatRequest(BaseModel):
    """Request body for POST /api/v1/assistant/chat."""

    project_context: ProjectContext = Field(..., description="Project and user goal")
    scanned_files: List[ScannedFileEntry] = Field(
        default_factory=list,
        description="Firmware files the user is working with",
    )
    maps: List[MapEntry] = Field(
        default_factory=list,
        description="ECU map/table objects (current file or selected). Cap length for token limits.",
    )
    user_message: str = Field(..., description="User question or instruction from the chat input")


# --- Assistant chat response ---
class AssistantChatResponse(BaseModel):
    """Structured response from the Map Assistant."""

    summary: str = Field(..., description="1–3 sentence summary of the answer")
    issues: List[str] = Field(
        default_factory=list,
        description="Bullet list of issues or gaps, if any",
    )
    suggestions: List[str] = Field(
        default_factory=list,
        description="Improvement suggestions with references to map_id or file names",
    )
    ask_vehicle: Optional[str] = Field(
        default=None,
        description="If tune was requested and vehicle_model is missing, one sentence asking for vehicle/ECU model",
    )
