"""Export model for tracking generated reports."""

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User


class Export(Base, TimestampMixin):
    """
    Export model for tracking generated reports and exports.
    
    Tracks report generation, storage location, and download history.
    Exports can have expiration dates for automatic cleanup.
    
    Attributes:
        export_id: Unique identifier (UUID)
        project_id: Foreign key to Project being exported
        user_id: Foreign key to User who requested the export
        format: Export format (json, pdf, csv)
        storage_path: Path to exported file in storage
        size_bytes: Size of exported file
        expires_at: When the export expires (for cleanup)
        attestation_sha256: SHA-256 hash of export for integrity
        downloaded_at: When the export was first downloaded
        created_at: Export creation timestamp
        updated_at: Last update timestamp
        
    Relationships:
        project: Project being exported
        user: User who requested the export
    """

    __tablename__ = "exports"

    # Primary key
    export_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        doc="Unique export identifier",
    )

    # Foreign keys
    project_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("projects.project_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Project being exported",
    )

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="User who requested the export",
    )

    # Export details
    format: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        doc="Export format: json, pdf, csv",
    )

    storage_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        doc="Path to exported file in storage",
    )

    size_bytes: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        doc="Size of exported file in bytes",
    )

    # Expiration and integrity
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        doc="When the export expires (for cleanup)",
    )

    attestation_sha256: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        doc="SHA-256 hash of export file for integrity",
    )

    # Download tracking
    downloaded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        doc="When the export was first downloaded",
    )

    # Relationships
    project: Mapped["Project"] = relationship(
        "Project",
        back_populates="exports",
        doc="Project being exported",
    )

    user: Mapped["User"] = relationship(
        "User",
        back_populates="exports",
        doc="User who requested the export",
    )

    # Indexes and constraints
    __table_args__ = (
        Index("idx_exports_project_id", "project_id"),
        Index("idx_exports_user_id", "user_id"),
        Index("idx_exports_expires_at", "expires_at"),
        Index("idx_exports_created_at", "created_at"),
        CheckConstraint(
            "format IN ('json', 'pdf', 'csv')",
            name="ck_exports_format",
        ),
    )

    @classmethod
    def _id_field(cls) -> str:
        """Return the name of the primary key field."""
        return "export_id"

    def __repr__(self) -> str:
        """String representation."""
        return f"<Export(export_id={self.export_id}, format={self.format})>"

    @property
    def is_expired(self) -> bool:
        """Check if export has expired."""
        from datetime import timezone
        return datetime.now(timezone.utc) > self.expires_at

    @property
    def has_been_downloaded(self) -> bool:
        """Check if export has been downloaded."""
        return self.downloaded_at is not None

    def mark_downloaded(self) -> None:
        """Mark export as downloaded."""
        if self.downloaded_at is None:
            from datetime import timezone
            self.downloaded_at = datetime.now(timezone.utc)

