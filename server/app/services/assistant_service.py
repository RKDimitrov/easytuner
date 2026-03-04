"""
Map Assistant service: build prompt from request and call Google Gemini to produce structured response.
Uses Gemini free tier (Google AI Studio API key).
"""
import asyncio
import json
import logging

from app.schemas.assistant import (
    AssistantChatRequest,
    AssistantChatResponse,
)

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the Map Assistant for EasyTuner, an ECU firmware analysis platform. You help users understand calibration maps (1D/2D/3D tables) detected in firmware, suggest improvements, and give tuning advice.

Rules:
1. Use the provided project_context, scanned_files, and maps to answer. Refer to maps by map_id or name when suggesting changes.
2. Explain what a map is for, how it fits the project, and note anything notable (e.g. low confidence, missing axis labels).
3. For tuning or edit suggestions: only give them if project_context.vehicle_model is set. If the user asks to tune or modify maps but vehicle_model is null or empty, set ask_vehicle to one short sentence asking which vehicle or ECU this firmware is for (e.g. "Which vehicle or engine is this firmware for? (e.g. BMW N55 2015). I need this so I don't suggest changes that don't match your platform."). Do not give tune suggestions until vehicle model is known.
4. Respond with a JSON object only, no markdown or extra text. Use this exact shape:
{"summary": "1-3 sentence summary", "issues": ["issue1", "issue2"], "suggestions": ["suggestion1"], "ask_vehicle": null or "one sentence asking for vehicle model"}
"""


def _build_user_message(req: AssistantChatRequest) -> str:
    """Build the user-facing message for the LLM from the request."""
    payload = {
        "project_context": req.project_context.model_dump(),
        "scanned_files": [f.model_dump() for f in req.scanned_files],
        "maps": [m.model_dump() for m in req.maps],
        "user_message": req.user_message,
    }
    return json.dumps(payload, indent=2)


def _call_gemini_sync(api_key: str, model_name: str, full_prompt: str) -> str:
    """Synchronous Gemini call (run in thread to not block event loop)."""
    import google.generativeai as genai

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_name)
    response = model.generate_content(
        full_prompt,
        generation_config={"temperature": 0.3},
    )
    if not response or not response.text:
        raise ValueError("Gemini returned empty response")
    return response.text.strip()


async def chat(req: AssistantChatRequest) -> AssistantChatResponse:
    """
    Call Google Gemini with the request payload and return a structured AssistantChatResponse.
    If GEMINI_API_KEY is not set, returns a fallback response indicating the assistant is unavailable.
    """
    from app.config import settings

    logger.info(
        "Map Assistant chat request: user_message_len=%d, maps_count=%d, scanned_files_count=%d",
        len(req.user_message),
        len(req.maps),
        len(req.scanned_files),
    )

    if not settings.gemini_api_key or not settings.gemini_api_key.strip():
        logger.warning("Map Assistant: GEMINI_API_KEY is not set or empty")
        return AssistantChatResponse(
            summary="The Map Assistant is not configured. Set GEMINI_API_KEY in server .env (get a free key at https://aistudio.google.com/app/apikey).",
            issues=[],
            suggestions=[],
            ask_vehicle=None,
        )

    try:
        import google.generativeai as genai
    except ImportError as e:
        logger.exception("Map Assistant: google-generativeai not installed: %s", e)
        return AssistantChatResponse(
            summary="The Map Assistant is not available: install google-generativeai on the server (pip install google-generativeai).",
            issues=[],
            suggestions=[],
            ask_vehicle=None,
        )

    full_prompt = f"{SYSTEM_PROMPT}\n\n---\n\nUser request and context (JSON):\n{_build_user_message(req)}"

    try:
        logger.debug("Map Assistant: calling Gemini model=%s", settings.gemini_model)
        content = await asyncio.to_thread(
            _call_gemini_sync,
            settings.gemini_api_key.strip(),
            settings.gemini_model,
            full_prompt,
        )
        # Remove markdown code block if present
        if content.startswith("```"):
            lines = content.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            content = "\n".join(lines)

        data = json.loads(content)
        logger.info("Map Assistant: success, summary_len=%d", len(data.get("summary", "")))
        return AssistantChatResponse(
            summary=data.get("summary", ""),
            issues=data.get("issues") or [],
            suggestions=data.get("suggestions") or [],
            ask_vehicle=data.get("ask_vehicle"),
        )
    except json.JSONDecodeError as e:
        logger.warning("Map Assistant: LLM response was not valid JSON: %s", e, exc_info=True)
        return AssistantChatResponse(
            summary="The assistant response could not be parsed. Please try rephrasing your question.",
            issues=[],
            suggestions=[],
            ask_vehicle=None,
        )
    except Exception as e:
        err_name = type(e).__name__
        err_msg = str(e)
        logger.exception(
            "Map Assistant: chat failed: %s: %s",
            err_name,
            err_msg,
        )
        lower_msg = err_msg.lower()
        if "api_key" in lower_msg or "authentication" in lower_msg or "invalid" in lower_msg or "401" in err_msg:
            user_summary = "The Map Assistant could not authenticate with Gemini. Check that GEMINI_API_KEY in server .env is correct (get a free key at https://aistudio.google.com/app/apikey)."
        elif err_name == "NotFound" or ("models/" in lower_msg and "not found" in lower_msg):
            user_summary = "The configured Gemini model is not available for your API key. Set GEMINI_MODEL in server .env to a model your key has access to (copy the model ID from Google AI Studio) and restart the server."
        elif "rate" in lower_msg or "quota" in lower_msg or "429" in err_msg:
            user_summary = "Gemini rate limit exceeded. Please try again in a moment."
        elif "connection" in lower_msg or "timeout" in lower_msg or "network" in lower_msg:
            user_summary = "The Map Assistant could not reach Gemini. Check the server network connection."
        else:
            user_summary = "The Map Assistant encountered an error. Please try again later. (Server logs have details.)"
        return AssistantChatResponse(
            summary=user_summary,
            issues=[],
            suggestions=[],
            ask_vehicle=None,
        )
