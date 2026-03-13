"""Assistant chat message model for persisting Map Assistant conversations."""

from typing import TYPE_CHECKING, List, Optional
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.firmware_file import FirmwareFile
    from app.models.user import User


class AssistantChatMessage(Base, TimestampMixin):
    """
    Persisted Map Assistant message for a specific user, project, and firmware file.

    Messages are stored as alternating user / assistant entries so that
    a full conversation can be reconstructed per (user, project, file).
    """

    __tablename__ = "assistant_chat_messages"

    # Primary key
    message_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        doc="Unique assistant chat message identifier",
    )

    # Ownership / scoping
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="User who owns this chat message",
    )

    project_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("projects.project_id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        doc="Project this chat message is associated with",
    )

    file_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("firmware_files.file_id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        doc="Firmware file this chat message is associated with",
    )

    # Message content
    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        doc="Message role: 'user' or 'assistant'",
    )

    # For user messages
    user_text: Mapped[str | None] = mapped_column(
        Text,
        doc="Raw user message text (for role='user')",
    )

    # For assistant messages
    summary: Mapped[str | None] = mapped_column(
        Text,
        doc="Assistant summary (for role='assistant')",
    )

    issues: Mapped[Optional[List[str]]] = mapped_column(
        JSONB,
        nullable=True,
        doc="List of issues returned by the assistant (for role='assistant')",
    )

    suggestions: Mapped[Optional[List[str]]] = mapped_column(
        JSONB,
        nullable=True,
        doc="List of suggestions returned by the assistant (for role='assistant')",
    )

    ask_vehicle: Mapped[str | None] = mapped_column(
        Text,
        doc="Optional ask_vehicle prompt from assistant (for role='assistant')",
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="assistant_messages",
        doc="User who owns this chat message",
    )

    project: Mapped["Project | None"] = relationship(
        "Project",
        doc="Project associated with this message",
    )

    file: Mapped["FirmwareFile | None"] = relationship(
        "FirmwareFile",
        doc="Firmware file associated with this message",
    )

    __table_args__ = (
        Index(
            "idx_assistant_chat_scope",
            "user_id",
            "project_id",
            "file_id",
        ),
        Index("idx_assistant_chat_created_at", "created_at"),
    )

    @classmethod
    def _id_field(cls) -> str:
        """Return the name of the primary key field."""
        return "message_id"

    def __repr__(self) -> str:
        return f"<AssistantChatMessage(message_id={self.message_id}, role={self.role})>"

