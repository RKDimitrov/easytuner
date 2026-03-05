"""User-defined maps created in the UI (\"My Maps\")."""

from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.firmware_file import FirmwareFile
    from app.models.user import User


class UserMap(Base, TimestampMixin):
    """
    User-defined map created from the Analysis page.

    This mirrors the frontend MapCandidate shape and is used to persist
    custom maps per file so they survive refreshes and appear in projects.
    """

    __tablename__ = "user_maps"

    # Primary key
    user_map_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        doc="Unique identifier for the user-defined map",
    )

    # Ownership / scoping
    project_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("projects.project_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Project this user map belongs to",
    )

    file_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("firmware_files.file_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Firmware file this map belongs to",
    )

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Owner user who created this map",
    )

    # Minimal indexable fields for querying and display
    name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        doc="Optional map name",
    )

    type: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        doc="Map structure type: single, 1D, 2D, 3D",
    )

    byte_offset_start: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        index=True,
        doc="Starting byte offset of the map in the file",
    )

    size_bytes: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        doc="Total size in bytes of the map region",
    )

    data_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        doc="Data organization (e.g. u16le, u32be, float32le)",
    )

    dimensions: Mapped[dict[str, int]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        doc="Dimensions of the map (e.g. {x:16, y:16})",
    )

    # Full MapCandidate-style configuration as opaque JSON for round-tripping
    config: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        doc="Full MapCandidate-style configuration payload from the client",
    )

    # Relationships
    project: Mapped["Project"] = relationship(
        "Project",
        back_populates="user_maps",
        doc="Project that owns this user map",
    )

    file: Mapped["FirmwareFile"] = relationship(
        "FirmwareFile",
        back_populates="user_maps",
        doc="Firmware file that owns this user map",
    )

    user: Mapped["User"] = relationship(
        "User",
        back_populates="user_maps",
        doc="User who created this map",
    )

    __table_args__ = (
        Index("idx_user_maps_project_id", "project_id"),
        Index("idx_user_maps_file_id", "file_id"),
        Index("idx_user_maps_user_id", "user_id"),
        Index("idx_user_maps_file_offset", "file_id", "byte_offset_start"),
    )

    @classmethod
    def _id_field(cls) -> str:
        """Return the name of the primary key field."""
        return "user_map_id"

