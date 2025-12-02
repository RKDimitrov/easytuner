"""Session model for refresh token management."""

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class Session(Base, TimestampMixin):
    """
    Session model for managing refresh tokens.
    
    Attributes:
        session_id: Unique identifier (UUID)
        user_id: Foreign key to User
        refresh_token_hash: SHA-256 hash of refresh token
        expires_at: When the session expires
        ip_address: IP address of the session
        user_agent: User agent string of the client
        created_at: Session creation timestamp
        updated_at: Last update timestamp
        
    Relationships:
        user: User who owns the session
    """

    __tablename__ = "sessions"

    # Primary key
    session_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        doc="Unique session identifier",
    )

    # Foreign key
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="User who owns this session",
    )

    # Token
    refresh_token_hash: Mapped[str] = mapped_column(
        String(64),  # SHA-256 produces 64 hex characters
        nullable=False,
        unique=True,
        doc="SHA-256 hash of the refresh token",
    )

    # Expiration
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        doc="When this session expires",
    )

    # Session metadata
    ip_address: Mapped[str | None] = mapped_column(
        String(45),  # IPv6 max length
        doc="IP address of the client",
    )

    user_agent: Mapped[str | None] = mapped_column(
        String(500),
        doc="User agent string of the client",
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="sessions",
        doc="User who owns this session",
    )

    # Indexes
    __table_args__ = (
        Index("idx_sessions_user_id", "user_id"),
        Index("idx_sessions_expires_at", "expires_at"),
        Index("idx_sessions_refresh_token_hash", "refresh_token_hash"),
    )

    @classmethod
    def _id_field(cls) -> str:
        """Return the name of the primary key field."""
        return "session_id"

    def __repr__(self) -> str:
        """String representation."""
        return f"<Session(session_id={self.session_id}, user_id={self.user_id})>"

