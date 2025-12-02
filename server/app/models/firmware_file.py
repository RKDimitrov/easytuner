"""FirmwareFile model for uploaded binary files."""

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.scan_job import ScanJob


class FirmwareFile(Base, TimestampMixin):
    """
    FirmwareFile model for uploaded ECU firmware binaries.
    
    Stores metadata about uploaded firmware files, including SHA-256 hash
    for deduplication and storage path in MinIO.
    
    Attributes:
        file_id: Unique identifier (UUID)
        project_id: Foreign key to Project
        filename: Original filename
        size_bytes: File size in bytes
        sha256: SHA-256 hash of file content (indexed)
        storage_path: Path in MinIO object storage
        endianness_hint: Endianness hint ('little', 'big', or NULL)
        uploaded_at: Upload timestamp
        deleted_at: Soft delete timestamp (NULL = active)
        created_at: Record creation timestamp
        updated_at: Last update timestamp
        
    Relationships:
        project: Project this file belongs to
    """

    __tablename__ = "firmware_files"

    # Primary key
    file_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        doc="Unique file identifier",
    )

    # Foreign key
    project_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("projects.project_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Project this file belongs to",
    )

    # File metadata
    filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        doc="Original filename",
    )

    size_bytes: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        doc="File size in bytes",
    )

    sha256: Mapped[str] = mapped_column(
        String(64),  # SHA-256 produces 64 hex characters
        nullable=False,
        index=True,
        doc="SHA-256 hash of file content",
    )

    storage_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        doc="Path in MinIO object storage",
    )

    # Detection hints
    endianness_hint: Mapped[str | None] = mapped_column(
        String(10),
        doc="Endianness hint: 'little', 'big', or NULL",
    )

    # Timestamps
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default="now()",
        doc="When the file was uploaded",
    )

    # Soft delete
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        doc="Soft delete timestamp (NULL = active)",
    )

    # Relationships
    project: Mapped["Project"] = relationship(
        "Project",
        back_populates="files",
        doc="Project this file belongs to",
    )

    scans: Mapped[list["ScanJob"]] = relationship(
        "ScanJob",
        back_populates="file",
        cascade="all, delete-orphan",
        doc="Scan jobs for this firmware file",
    )

    # Indexes
    __table_args__ = (
        Index("idx_firmware_files_project_id", "project_id"),
        Index("idx_firmware_files_sha256", "sha256"),
        Index("idx_firmware_files_uploaded_at", "uploaded_at"),
        Index("idx_firmware_files_deleted_at", "deleted_at"),
    )

    @classmethod
    def _id_field(cls) -> str:
        """Return the name of the primary key field."""
        return "file_id"

    def __repr__(self) -> str:
        """String representation."""
        return f"<FirmwareFile(file_id={self.file_id}, filename={self.filename})>"

    @property
    def is_deleted(self) -> bool:
        """Check if the file is soft-deleted."""
        return self.deleted_at is not None

    def soft_delete(self) -> None:
        """Mark the file as deleted."""
        if self.deleted_at is None:
            self.deleted_at = datetime.utcnow()

    def restore(self) -> None:
        """Restore a soft-deleted file."""
        self.deleted_at = None

