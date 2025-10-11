"""AuditLog model for tracking system actions and compliance."""

from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class AuditLog(Base):
    """
    AuditLog model for tracking all important system actions.
    
    Maintains a comprehensive audit trail of user actions for compliance,
    debugging, and security monitoring. Logs are immutable (no updates).
    
    Attributes:
        log_id: Unique identifier (UUID)
        user_id: Foreign key to User (nullable for system actions)
        action_type: Type of action (e.g., 'user.login', 'file.upload')
        resource_type: Type of resource affected (e.g., 'user', 'project')
        resource_id: UUID of the affected resource
        ip_address: Client IP address (INET type)
        user_agent: Client user agent string
        attestation_text: Human-readable description
        attestation_sha256: SHA-256 hash of attestation for integrity
        metadata: Additional action-specific data (JSONB)
        timestamp: When the action occurred
        
    Relationships:
        user: User who performed the action (NULL for system actions)
    """

    __tablename__ = "audit_logs"

    # Primary key
    log_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        doc="Unique audit log identifier",
    )

    # User (nullable for system actions)
    user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="SET NULL"),
        index=True,
        doc="User who performed the action (NULL for system actions)",
    )

    # Action details
    action_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
        doc="Action type (e.g., 'user.login', 'file.upload')",
    )

    resource_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        doc="Resource type (e.g., 'user', 'project', 'file')",
    )

    resource_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        nullable=False,
        index=True,
        doc="UUID of the affected resource",
    )

    # Client information
    ip_address: Mapped[str | None] = mapped_column(
        INET,
        doc="Client IP address (IPv4 or IPv6)",
    )

    user_agent: Mapped[str | None] = mapped_column(
        String(500),
        doc="Client user agent string",
    )

    # Attestation for integrity
    attestation_text: Mapped[str | None] = mapped_column(
        String(1000),
        doc="Human-readable description of the action",
    )

    attestation_sha256: Mapped[str | None] = mapped_column(
        String(64),
        doc="SHA-256 hash of attestation for integrity verification",
    )

    # Additional metadata
    event_metadata: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        doc="Additional action-specific data",
    )

    # Timestamp
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
        doc="When the action occurred",
    )

    # Relationships
    user: Mapped["User | None"] = relationship(
        "User",
        back_populates="audit_logs",
        doc="User who performed the action",
    )

    # Indexes
    __table_args__ = (
        Index("idx_audit_logs_user_id", "user_id"),
        Index("idx_audit_logs_action_type", "action_type"),
        Index("idx_audit_logs_resource_type", "resource_type"),
        Index("idx_audit_logs_resource_id", "resource_id"),
        Index("idx_audit_logs_timestamp", "timestamp"),
        # Composite index for common queries
        Index("idx_audit_logs_user_action_time", "user_id", "action_type", "timestamp"),
    )

    @classmethod
    def _id_field(cls) -> str:
        """Return the name of the primary key field."""
        return "log_id"

    def __repr__(self) -> str:
        """String representation."""
        return f"<AuditLog(log_id={self.log_id}, action_type={self.action_type})>"

    @classmethod
    def create_log(
        cls,
        action_type: str,
        resource_type: str,
        resource_id: UUID,
        user_id: UUID | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        attestation_text: str | None = None,
        event_metadata: dict[str, Any] | None = None,
    ) -> "AuditLog":
        """
        Factory method to create an audit log entry.
        
        Args:
            action_type: Type of action (e.g., 'user.login')
            resource_type: Type of resource (e.g., 'user')
            resource_id: UUID of affected resource
            user_id: Optional user ID
            ip_address: Optional client IP
            user_agent: Optional user agent
            attestation_text: Optional description
            event_metadata: Optional additional data
            
        Returns:
            AuditLog: New audit log entry
        """
        return cls(
            user_id=user_id,
            action_type=action_type,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip_address,
            user_agent=user_agent,
            attestation_text=attestation_text,
            event_metadata=event_metadata,
        )

