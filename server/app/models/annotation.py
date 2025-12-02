"""Annotation model for user labels on detected candidates."""

from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import ARRAY, CheckConstraint, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.candidate import Candidate
    from app.models.user import User


class Annotation(Base, TimestampMixin):
    """
    Annotation model for user labels on detected candidates.
    
    Allows users to label, verify, and add notes to detected calibration
    structures. Supports tags for categorization and validation status
    tracking.
    
    Attributes:
        annotation_id: Unique identifier (UUID)
        candidate_id: Foreign key to Candidate being annotated
        user_id: Foreign key to User who created the annotation
        label: Human-readable label (e.g., "Fuel Map", "Ignition Timing")
        notes: Optional detailed notes
        tags: Array of tags for categorization
        validation_status: Verification status (verified, rejected, uncertain, NULL)
        created_at: Annotation creation timestamp
        updated_at: Last update timestamp
        
    Relationships:
        candidate: Candidate being annotated
        user: User who created the annotation
    """

    __tablename__ = "annotations"

    # Primary key
    annotation_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        doc="Unique annotation identifier",
    )

    # Foreign keys
    candidate_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("candidates.candidate_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Candidate being annotated",
    )

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="User who created the annotation",
    )

    # Annotation content
    label: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        doc="Human-readable label for the candidate",
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        doc="Optional detailed notes about the candidate",
    )

    # Tags for categorization (PostgreSQL array)
    tags: Mapped[list[str]] = mapped_column(
        ARRAY(String(50)),
        nullable=False,
        default=list,
        doc="Tags for categorization and search",
    )

    # Validation tracking
    validation_status: Mapped[str | None] = mapped_column(
        String(20),
        doc="Validation status: verified, rejected, uncertain, or NULL",
    )

    # Relationships
    candidate: Mapped["Candidate"] = relationship(
        "Candidate",
        back_populates="annotations",
        doc="Candidate being annotated",
    )

    user: Mapped["User"] = relationship(
        "User",
        back_populates="annotations",
        doc="User who created the annotation",
    )

    # Indexes and constraints
    __table_args__ = (
        Index("idx_annotations_candidate_id", "candidate_id"),
        Index("idx_annotations_user_id", "user_id"),
        Index("idx_annotations_created_at", "created_at"),
        # GIN index for efficient tag array searching
        Index(
            "idx_annotations_tags",
            "tags",
            postgresql_using="gin",
        ),
        CheckConstraint(
            "validation_status IS NULL OR validation_status IN ('verified', 'rejected', 'uncertain')",
            name="ck_annotations_validation_status",
        ),
    )

    @classmethod
    def _id_field(cls) -> str:
        """Return the name of the primary key field."""
        return "annotation_id"

    def __repr__(self) -> str:
        """String representation."""
        return f"<Annotation(annotation_id={self.annotation_id}, label={self.label})>"

    @property
    def is_verified(self) -> bool:
        """Check if annotation is verified."""
        return self.validation_status == "verified"

    @property
    def is_rejected(self) -> bool:
        """Check if annotation is rejected."""
        return self.validation_status == "rejected"

    @property
    def needs_review(self) -> bool:
        """Check if annotation needs review."""
        return self.validation_status is None or self.validation_status == "uncertain"

    def verify(self) -> None:
        """Mark annotation as verified."""
        self.validation_status = "verified"

    def reject(self) -> None:
        """Mark annotation as rejected."""
        self.validation_status = "rejected"

    def mark_uncertain(self) -> None:
        """Mark annotation as uncertain."""
        self.validation_status = "uncertain"

