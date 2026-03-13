"""User model for authentication and authorization."""

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.annotation import Annotation
    from app.models.assistant_chat import AssistantChatMessage
    from app.models.audit_log import AuditLog
    from app.models.export import Export
    from app.models.project import Project
    from app.models.session import Session


class User(Base, TimestampMixin):
    """
    User model for authentication and authorization.
    
    Attributes:
        user_id: Unique identifier (UUID)
        email: User's email address (unique)
        password_hash: Bcrypt-hashed password
        role: User role ('user' or 'admin')
        is_active: Whether the account is active
        last_login_at: Last successful login timestamp
        tos_accepted_at: Terms of Service acceptance timestamp
        tos_version: Version of TOS accepted (integer)
        created_at: Account creation timestamp
        updated_at: Last update timestamp
        
    Relationships:
        sessions: User's authentication sessions
        projects: Projects owned by the user
    """

    __tablename__ = "users"

    # Primary key
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        doc="Unique user identifier",
    )

    # Authentication fields
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
        doc="User's email address",
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        doc="Bcrypt-hashed password",
    )

    # Authorization
    role: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="user",
        doc="User role: 'user' or 'admin'",
    )

    # Status
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        doc="Whether the account is active",
    )

    # Activity tracking
    last_login_at: Mapped[datetime | None] = mapped_column(
        doc="Last successful login timestamp",
    )

    # Terms of Service
    tos_accepted_at: Mapped[datetime | None] = mapped_column(
        doc="When TOS was accepted",
    )

    tos_version: Mapped[int | None] = mapped_column(
        Integer,
        doc="Version of TOS accepted",
    )

    # Profile
    display_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        doc="User's display name",
    )

    avatar_url: Mapped[str | None] = mapped_column(
        String(512),
        nullable=True,
        doc="Relative path to profile picture (e.g. avatars/<user_id>.jpg)",
    )

    # Relationships
    sessions: Mapped[list["Session"]] = relationship(
        "Session",
        back_populates="user",
        cascade="all, delete-orphan",
        doc="User's authentication sessions",
    )

    projects: Mapped[list["Project"]] = relationship(
        "Project",
        back_populates="owner",
        cascade="all, delete-orphan",
        doc="Projects owned by the user",
    )

    annotations: Mapped[list["Annotation"]] = relationship(
        "Annotation",
        back_populates="user",
        cascade="all, delete-orphan",
        doc="User's annotations on candidates",
    )

    audit_logs: Mapped[list["AuditLog"]] = relationship(
        "AuditLog",
        back_populates="user",
        doc="Audit logs for user actions",
    )

    exports: Mapped[list["Export"]] = relationship(
        "Export",
        back_populates="user",
        cascade="all, delete-orphan",
        doc="Exports requested by the user",
    )

    user_maps: Mapped[list["UserMap"]] = relationship(
        "UserMap",
        back_populates="user",
        cascade="all, delete-orphan",
        doc="User-defined maps created by the user",
    )

    assistant_messages: Mapped[list["AssistantChatMessage"]] = relationship(
        "AssistantChatMessage",
        back_populates="user",
        cascade="all, delete-orphan",
        doc="Map Assistant chat messages for this user",
    )

    # Indexes
    __table_args__ = (
        Index("idx_users_email", "email"),
        Index("idx_users_created_at", "created_at"),
        Index("idx_users_is_active", "is_active"),
    )

    @classmethod
    def _id_field(cls) -> str:
        """Return the name of the primary key field."""
        return "user_id"

    def __repr__(self) -> str:
        """String representation."""
        return f"<User(user_id={self.user_id}, email={self.email})>"

