"""
Map Assistant chat endpoints (chat + history).
"""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import AssistantChatMessage, FirmwareFile
from app.models.user import User
from app.schemas.assistant import (
    AssistantChatHistoryItem,
    AssistantChatHistoryResponse,
    AssistantChatRequest,
    AssistantChatResponse,
)
from app.services.assistant_service import chat as assistant_chat

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post(
    "/chat",
    status_code=status.HTTP_200_OK,
    summary="Map Assistant chat",
    description="Send project context, scanned_files, maps, and a user message; get a structured explanation and suggestions. Tuning advice is only given when vehicle_model is set.",
    response_model=AssistantChatResponse,
)
async def post_chat(
    body: AssistantChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AssistantChatResponse:
    """Run the Map Assistant and return summary, issues, suggestions, and optional ask_vehicle."""
    logger.info("Map Assistant /chat called by user_id=%s", current_user.user_id)
    try:
        result = await assistant_chat(body)

        # Best-effort persistence of chat history, keyed by user + file
        try:
            file_id: UUID | None = None
            project_id: UUID | None = None

            # Prefer file_id from scanned_files then from maps
            if body.scanned_files:
                file_id = UUID(body.scanned_files[0].file_id)
            elif body.maps:
                file_id = UUID(body.maps[0].file_id)

            if file_id is not None:
                # Look up project_id from firmware file
                fw = await db.get(FirmwareFile, file_id)
                if fw is not None:
                    project_id = fw.project_id

            if file_id is not None:
                user_msg = AssistantChatMessage(
                    user_id=current_user.user_id,
                    project_id=project_id,
                    file_id=file_id,
                    role="user",
                    user_text=body.user_message,
                )
                assistant_msg = AssistantChatMessage(
                    user_id=current_user.user_id,
                    project_id=project_id,
                    file_id=file_id,
                    role="assistant",
                    summary=result.summary,
                    issues=result.issues or [],
                    suggestions=result.suggestions or [],
                    ask_vehicle=result.ask_vehicle,
                )
                db.add_all([user_msg, assistant_msg])
        except Exception:
            logger.exception("Failed to persist Map Assistant chat messages")

        return result
    except Exception as e:
        logger.exception("Map Assistant /chat raised: %s", e)
        raise


@router.get(
    "/history",
    status_code=status.HTTP_200_OK,
    summary="Get Map Assistant chat history for a file",
    response_model=AssistantChatHistoryResponse,
)
async def get_chat_history(
    file_id: UUID = Query(..., description="Firmware file UUID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AssistantChatHistoryResponse:
    """Return persisted chat messages for the current user and given file."""
    stmt = (
        select(AssistantChatMessage)
        .where(
            AssistantChatMessage.user_id == current_user.user_id,
            AssistantChatMessage.file_id == file_id,
        )
        .order_by(AssistantChatMessage.created_at.asc())
    )
    rows = (await db.scalars(stmt)).all()
    messages = [
        AssistantChatHistoryItem(
            message_id=row.message_id,
            role=row.role,  # type: ignore[arg-type]
            user_text=row.user_text,
            summary=row.summary,
            issues=row.issues or [],
            suggestions=row.suggestions or [],
            ask_vehicle=row.ask_vehicle,
            created_at=row.created_at,
        )
        for row in rows
    ]
    return AssistantChatHistoryResponse(messages=messages)


@router.delete(
    "/history",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Map Assistant chat history for a file",
)
async def delete_chat_history(
    file_id: UUID = Query(..., description="Firmware file UUID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete all persisted chat messages for the current user and given file."""
    stmt = delete(AssistantChatMessage).where(
        AssistantChatMessage.user_id == current_user.user_id,
        AssistantChatMessage.file_id == file_id,
    )
    await db.execute(stmt)
