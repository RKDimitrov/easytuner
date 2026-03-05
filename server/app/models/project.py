"""Project model for organizing firmware files."""

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.export import Export
    from app.models.firmware_file import FirmwareFile
    from app.models.user import User


class Project(Base, TimestampMixin):
    """
    Project model for organizing firmware files and scans.
    
    A project is a container for related firmware files and their analysis results.
    Projects support soft deletion (deleted_at) and privacy controls.
    
    Attributes:
        project_id: Unique identifier (UUID)
        owner_user_id: Foreign key to User who owns the project
        name: Project name (indexed for search)
        description: Optional project description
        is_private: Whether the project is private (default: True)
        deleted_at: Soft delete timestamp (NULL = active)
        created_at: Project creation timestamp
        updated_at: Last update timestamp
        
    Relationships:
        owner: User who owns the project
        files: Firmware files in this project
    """

    __tablename__ = "projects"

    # Primary key
    project_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        doc="Unique project identifier",
    )

    # Foreign key
    owner_user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="User who owns this project",
    )

    # Project details
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        doc="Project name",
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        doc="Optional project description",
    )

    # Vehicle/ECU context for map assistant (e.g. "BMW N55 2015")
    vehicle_model: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        doc="Optional vehicle or ECU model for tuning context",
    )

    # Privacy
    is_private: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        doc="Whether the project is private",
    )

    # Library publish: when set, project appears in /library for others to view
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        doc="When the project was published to the library (NULL = not published)",
    )

    # Soft delete
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        doc="Soft delete timestamp (NULL = active)",
    )

    # Relationships
    owner: Mapped["User"] = relationship(
        "User",
        back_populates="projects",
        doc="User who owns this project",
    )

    files: Mapped[list["FirmwareFile"]] = relationship(
        "FirmwareFile",
        back_populates="project",
        cascade="all, delete-orphan",
        doc="Firmware files in this project",
    )

    exports: Mapped[list["Export"]] = relationship(
        "Export",
        back_populates="project",
        cascade="all, delete-orphan",
        doc="Exports generated for this project",
    )

    user_maps: Mapped[list["UserMap"]] = relationship(
        "UserMap",
        back_populates="project",
        cascade="all, delete-orphan",
        doc="User-defined maps associated with this project",
    )

    # Indexes
    __table_args__ = (
        Index("idx_projects_owner_user_id", "owner_user_id"),
        Index("idx_projects_created_at", "created_at"),
        Index("idx_projects_deleted_at", "deleted_at"),
        Index("idx_projects_published_at", "published_at"),
        # GIN index for full-text search on project names using pg_trgm
        # Note: Requires CREATE EXTENSION pg_trgm; in database
        Index(
            "idx_projects_name_trgm",
            "name",
            postgresql_using="gin",
            postgresql_ops={"name": "gin_trgm_ops"},
        ),
    )

    @classmethod
    def _id_field(cls) -> str:
        """Return the name of the primary key field."""
        return "project_id"

    def __repr__(self) -> str:
        """String representation."""
        return f"<Project(project_id={self.project_id}, name={self.name})>"

    @property
    def is_deleted(self) -> bool:
        """Check if the project is soft-deleted."""
        return self.deleted_at is not None

    def soft_delete(self) -> None:
        """Mark the project as deleted."""
        if self.deleted_at is None:
            self.deleted_at = datetime.utcnow()

    def restore(self) -> None:
        """Restore a soft-deleted project."""
        self.deleted_at = None

