"""Pydantic schemas for user-defined maps (My Maps)."""

from typing import Any, Dict, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class UserMapPayload(BaseModel):
    """
    Minimal MapCandidate-style payload from the client.

    We keep this intentionally loose so the frontend can evolve without
    needing frequent backend migrations.
    """

    id: Optional[str] = Field(
        default=None,
        description="Optional client-side id; if provided we upsert this map.",
    )
    type: Literal["single", "1D", "2D", "3D"]
    offset: int
    size: int
    dataType: Optional[str] = Field(
        default="u16le",
        description="Data organization, e.g. u16le, u32be, float32le",
    )
    dimensions: Dict[str, int] = Field(
        default_factory=dict,
        description="Dimensions of the map, e.g. {x:16, y:16}",
    )
    name: Optional[str] = None
    description: Optional[str] = None
    unit: Optional[str] = None
    # Everything else from MapCandidate goes here
    config: Dict[str, Any] = Field(default_factory=dict)


class UserMapCreateRequest(BaseModel):
    """Request body for creating or updating a user map for a file."""

    map: UserMapPayload


class UserMapResponse(BaseModel):
    """
    Response to the client – shaped like MapCandidate so it can be dropped
    directly into the analysis store.
    """

    id: str
    file_id: UUID
    project_id: UUID
    type: Literal["single", "1D", "2D", "3D"]
    offset: int
    size: int
    dataType: str
    dimensions: Dict[str, int] = Field(default_factory=dict)
    name: Optional[str] = None
    description: Optional[str] = None
    unit: Optional[str] = None
    # Full config echoed back for round-trip
    config: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        from_attributes = True

