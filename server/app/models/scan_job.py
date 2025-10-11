"""ScanJob model for tracking firmware scanning progress."""

from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.candidate import Candidate
    from app.models.firmware_file import FirmwareFile


class ScanJob(Base, TimestampMixin):
    """
    ScanJob model for tracking firmware file scanning progress.
    
    A scan job represents a single execution of the detection pipeline
    on a firmware file. It tracks the status, configuration, and results
    of the scanning process.
    
    Attributes:
        scan_id: Unique identifier (UUID)
        file_id: Foreign key to FirmwareFile being scanned
        status: Current status ('queued', 'processing', 'completed', 'failed')
        scan_config: JSONB configuration for the scan (data types, settings)
        started_at: When processing started
        completed_at: When processing finished
        error_message: Error details if failed
        worker_id: ID of the worker processing this scan
        processing_time_ms: Total processing time in milliseconds
        created_at: Scan creation timestamp
        updated_at: Last update timestamp
        
    Relationships:
        file: FirmwareFile being scanned
        candidates: Detected calibration structures
    """

    __tablename__ = "scan_jobs"

    # Primary key
    scan_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        doc="Unique scan job identifier",
    )

    # Foreign key
    file_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("firmware_files.file_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Firmware file being scanned",
    )

    # Status tracking
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="queued",
        index=True,
        doc="Scan status: queued, processing, completed, failed",
    )

    # Configuration
    scan_config: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        doc="Scan configuration (data types, settings)",
    )

    # Timing
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        doc="When processing started",
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        doc="When processing finished",
    )

    # Error handling
    error_message: Mapped[str | None] = mapped_column(
        String(1000),
        doc="Error details if scan failed",
    )

    # Worker info
    worker_id: Mapped[str | None] = mapped_column(
        String(100),
        doc="ID of the Celery worker processing this scan",
    )

    processing_time_ms: Mapped[int | None] = mapped_column(
        BigInteger,
        doc="Total processing time in milliseconds",
    )

    # Relationships
    file: Mapped["FirmwareFile"] = relationship(
        "FirmwareFile",
        back_populates="scans",
        doc="Firmware file being scanned",
    )

    candidates: Mapped[list["Candidate"]] = relationship(
        "Candidate",
        back_populates="scan",
        cascade="all, delete-orphan",
        doc="Detected calibration structures",
    )

    # Indexes and constraints
    __table_args__ = (
        Index("idx_scan_jobs_file_id", "file_id"),
        Index("idx_scan_jobs_status", "status"),
        Index("idx_scan_jobs_created_at", "created_at"),
        CheckConstraint(
            "status IN ('queued', 'processing', 'completed', 'failed')",
            name="ck_scan_jobs_status",
        ),
    )

    @classmethod
    def _id_field(cls) -> str:
        """Return the name of the primary key field."""
        return "scan_id"

    def __repr__(self) -> str:
        """String representation."""
        return f"<ScanJob(scan_id={self.scan_id}, status={self.status})>"

    def start_processing(self, worker_id: str) -> None:
        """Mark scan as processing."""
        self.status = "processing"
        self.started_at = datetime.utcnow()
        self.worker_id = worker_id

    def complete(self, processing_time_ms: int) -> None:
        """Mark scan as completed."""
        self.status = "completed"
        self.completed_at = datetime.utcnow()
        self.processing_time_ms = processing_time_ms

    def fail(self, error_message: str) -> None:
        """Mark scan as failed."""
        self.status = "failed"
        self.completed_at = datetime.utcnow()
        self.error_message = error_message

    @property
    def is_finished(self) -> bool:
        """Check if scan is finished (completed or failed)."""
        return self.status in ("completed", "failed")

    @property
    def duration_ms(self) -> int | None:
        """Calculate scan duration in milliseconds."""
        if self.started_at and self.completed_at:
            delta = self.completed_at - self.started_at
            return int(delta.total_seconds() * 1000)
        return None

