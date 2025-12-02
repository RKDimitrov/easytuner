"""Candidate model for detected calibration structures."""

from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, CheckConstraint, Float, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.annotation import Annotation
    from app.models.scan_job import ScanJob


class Candidate(Base, TimestampMixin):
    """
    Candidate model for detected calibration structures.
    
    A candidate represents a potential calibration table or map detected
    by the scanning algorithm. It includes location, type, confidence,
    and extracted features.
    
    Attributes:
        candidate_id: Unique identifier (UUID)
        scan_id: Foreign key to ScanJob that found this candidate
        type: Structure type ('1D', '2D', '3D', 'scalar')
        confidence: Detection confidence score (0.0 to 1.0)
        byte_offset_start: Starting byte position in firmware
        byte_offset_end: Ending byte position in firmware
        data_type: Detected data type (e.g., 'u16LE', 'u32LE')
        dimensions: JSONB with structure dimensions (rows, cols)
        feature_scores: JSONB with detection feature scores
        detection_method_version: Version of detection algorithm used
        created_at: Detection timestamp
        updated_at: Last update timestamp
        
    Relationships:
        scan: ScanJob that detected this candidate
    """

    __tablename__ = "candidates"

    # Primary key
    candidate_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        doc="Unique candidate identifier",
    )

    # Foreign key
    scan_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("scan_jobs.scan_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Scan job that found this candidate",
    )

    # Classification
    type: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        index=True,
        doc="Structure type: 1D, 2D, 3D, scalar",
    )

    confidence: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        index=True,
        doc="Detection confidence score (0.0 to 1.0)",
    )

    # Location in firmware
    byte_offset_start: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        index=True,
        doc="Starting byte position in firmware",
    )

    byte_offset_end: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        index=True,
        doc="Ending byte position in firmware",
    )

    # Data characteristics
    data_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        doc="Detected data type (e.g., u16LE, u32LE, float32)",
    )

    dimensions: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        doc="Structure dimensions (e.g., {rows: 16, cols: 16})",
    )

    # Feature analysis
    feature_scores: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        doc="Detection feature scores (gradient, entropy, etc.)",
    )

    # Version tracking
    detection_method_version: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        doc="Version of detection algorithm used",
    )

    # Relationships
    scan: Mapped["ScanJob"] = relationship(
        "ScanJob",
        back_populates="candidates",
        doc="Scan job that detected this candidate",
    )

    annotations: Mapped[list["Annotation"]] = relationship(
        "Annotation",
        back_populates="candidate",
        cascade="all, delete-orphan",
        doc="User annotations for this candidate",
    )

    # Indexes and constraints
    __table_args__ = (
        Index("idx_candidates_scan_id", "scan_id"),
        Index("idx_candidates_type", "type"),
        Index("idx_candidates_confidence", "confidence"),
        Index("idx_candidates_byte_offset_start", "byte_offset_start"),
        Index("idx_candidates_byte_offset_end", "byte_offset_end"),
        # Check constraints for data validation
        CheckConstraint(
            "confidence >= 0.0 AND confidence <= 1.0",
            name="ck_candidates_confidence_range",
        ),
        CheckConstraint(
            "byte_offset_end > byte_offset_start",
            name="ck_candidates_byte_offset_order",
        ),
        CheckConstraint(
            "type IN ('1D', '2D', '3D', 'scalar')",
            name="ck_candidates_type",
        ),
    )

    @classmethod
    def _id_field(cls) -> str:
        """Return the name of the primary key field."""
        return "candidate_id"

    def __repr__(self) -> str:
        """String representation."""
        return (
            f"<Candidate(candidate_id={self.candidate_id}, "
            f"type={self.type}, confidence={self.confidence:.2f})>"
        )

    @property
    def size_bytes(self) -> int:
        """Calculate the size of this candidate in bytes."""
        return self.byte_offset_end - self.byte_offset_start

    @property
    def is_high_confidence(self) -> bool:
        """Check if candidate has high confidence (>= 0.8)."""
        return self.confidence >= 0.8

    @property
    def is_multidimensional(self) -> bool:
        """Check if candidate is a multi-dimensional structure."""
        return self.type in ("2D", "3D")

