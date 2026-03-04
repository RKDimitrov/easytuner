"""
Map Assistant chat endpoint.
"""
import logging

from fastapi import APIRouter, Depends, status

from app.auth.dependencies import get_current_user
from app.models.user import User
from app.schemas.assistant import AssistantChatRequest, AssistantChatResponse
from app.services.assistant_service import chat as assistant_chat

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post(
    "/chat",
    status_code=status.HTTP_200_OK,
    summary="Map Assistant chat",
    description="Send project context, scanned files, maps, and a user message; get a structured explanation and suggestions. Tuning advice is only given when vehicle_model is set.",
    response_model=AssistantChatResponse,
)
async def post_chat(
    body: AssistantChatRequest,
    current_user: User = Depends(get_current_user),
) -> AssistantChatResponse:
    """Run the Map Assistant and return summary, issues, suggestions, and optional ask_vehicle."""
    logger.info("Map Assistant /chat called by user_id=%s", current_user.user_id)
    try:
        result = await assistant_chat(body)
        return result
    except Exception as e:
        logger.exception("Map Assistant /chat raised: %s", e)
        raise
