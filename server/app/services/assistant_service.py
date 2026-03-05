"""
Map Assistant service: build prompt from request and call OpenAI to produce structured response.
"""
import json
import logging

from app.schemas.assistant import (
    AssistantChatRequest,
    AssistantChatResponse,
)

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the Map Assistant for EasyTuner: an expert ECU tuner helping users edit calibration maps (1D/2D/3D tables) in firmware. You respond like a real tuner: explain how the map works, how it is structured, then give exact step-by-step instructions with specific numbers from the user's table—no vague phrases like "or a desired value".

Response structure:
1. summary: First explain in 2–5 sentences how this type of map works in the ECU (e.g. torque limiter: what it does, how the ECU uses it, what the axes and values mean). Then briefly describe how the map is built (axis = breakpoints like RPM, cells = limits or targets). Write for someone who may not know ECU tuning. Use the map name and vehicle_model from context when relevant.
2. issues: List any problems or gaps (e.g. missing axis labels, low confidence). Empty list if none.
3. suggestions: Step-by-step instructions for this user's situation. When selected_map_text_view is provided, you MUST use the exact numbers from that table. Each step one list item. For edits: state the exact value to enter (e.g. "At 4530 RPM set the cell to 6000", "Rename the next column from 5200 to 4531 RPM and set that cell to 0"). Never say "or a desired value" or "set to X"—give the concrete number. If the user wants a hardcut rev limiter before the redzone at 4.5k RPM, your steps should say precisely: which column (e.g. 4530), what to set it to (e.g. 6000 to allow full torque up to that point), and what to do with the next breakpoint (e.g. rename to 4531 RPM and set to 0 for hardcut). Base all numbers on the selected_map_text_view table.
4. ask_vehicle: Only when the user asks for tuning but vehicle_model is missing: one short sentence asking for vehicle/ECU (e.g. "Which vehicle or ECU is this for? (e.g. Peugeot 206 2.0 HDI 2002)."). Otherwise null.

Rules:
- Use project_context, scanned_files, maps, and user_message. When selected_map_text_view is present, it is the exact Text Viewer table (axis labels + data grid). All suggested values and column/row references must come from that table.
- For tuning or edit suggestions, only answer with concrete steps if project_context.vehicle_model is set. If the user asks to tune but vehicle_model is null or empty, set ask_vehicle to the one-sentence question above and leave suggestions minimal or empty.
- Respond with a JSON object only, no markdown or extra text. Use this exact shape:
{"summary": "2-5 sentences: how the map works, how it is made.", "issues": ["issue or empty list"], "suggestions": ["Step 1: exact action and value", "Step 2: ..."], "ask_vehicle": null or "one sentence"}
"""


def _build_user_message(req: AssistantChatRequest) -> str:
    """Build the user-facing message for the LLM from the request."""
    payload = {
        "project_context": req.project_context.model_dump(),
        "scanned_files": [f.model_dump() for f in req.scanned_files],
        "maps": [m.model_dump() for m in req.maps],
        "user_message": req.user_message,
    }
    if req.selected_map_text_view and req.selected_map_text_view.strip():
        payload["selected_map_text_view"] = req.selected_map_text_view.strip()
    return json.dumps(payload, indent=2)


async def chat(req: AssistantChatRequest) -> AssistantChatResponse:
    """
    Call OpenAI with the request payload and return a structured AssistantChatResponse.
    If OPENAI_API_KEY is not set, returns a fallback response indicating the assistant is unavailable.
    """
    from app.config import settings

    logger.info(
        "Map Assistant chat request: user_message_len=%d, maps_count=%d, scanned_files_count=%d",
        len(req.user_message),
        len(req.maps),
        len(req.scanned_files),
    )

    if not settings.openai_api_key or not settings.openai_api_key.strip():
        logger.warning("Map Assistant: OPENAI_API_KEY is not set or empty")
        return AssistantChatResponse(
            summary="The Map Assistant is not configured. Set OPENAI_API_KEY in server .env (get a key at https://platform.openai.com/api-keys).",
            issues=[],
            suggestions=[],
            ask_vehicle=None,
        )

    try:
        from openai import AsyncOpenAI
    except ImportError as e:
        logger.exception("Map Assistant: openai package not installed: %s", e)
        return AssistantChatResponse(
            summary="The Map Assistant is not available: install openai on the server (pip install openai).",
            issues=[],
            suggestions=[],
            ask_vehicle=None,
        )

    user_content = _build_user_message(req)
    full_prompt = f"User request and context (JSON):\n{user_content}"

    try:
        logger.debug("Map Assistant: calling OpenAI model=%s", settings.openai_model)
        client = AsyncOpenAI(api_key=settings.openai_api_key.strip())
        response = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": full_prompt},
            ],
            temperature=0.3,
        )
        content = (response.choices[0].message.content or "").strip()
        if not content:
            raise ValueError("OpenAI returned empty response")

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
        if "api_key" in lower_msg or "authentication" in lower_msg or "invalid" in lower_msg or "401" in err_msg or "incorrect api key" in lower_msg:
            user_summary = "The Map Assistant could not authenticate with OpenAI. Check that OPENAI_API_KEY in server .env is correct (https://platform.openai.com/api-keys)."
        elif "rate" in lower_msg or "quota" in lower_msg or "429" in err_msg:
            user_summary = "OpenAI rate limit exceeded. Please try again in a moment."
        elif "connection" in lower_msg or "timeout" in lower_msg or "network" in lower_msg:
            user_summary = "The Map Assistant could not reach OpenAI. Check the server network connection."
        else:
            user_summary = "The Map Assistant encountered an error. Please try again later. (Server logs have details.)"
        return AssistantChatResponse(
            summary=user_summary,
            issues=[],
            suggestions=[],
            ask_vehicle=None,
        )
