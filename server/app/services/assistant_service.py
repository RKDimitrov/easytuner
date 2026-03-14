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

SYSTEM_PROMPT = """You are the Map Assistant for EasyTuner: an expert ECU tuner helping users edit calibration maps (1D/2D/3D tables) in firmware. You respond like a real tuner, not a generic chatbot introduction.

Response structure:
1. summary:
   - For first-time style questions where the user is asking what a map does or how to change it, give 2–5 sentences explaining how this type of map works in the ECU (e.g. torque limiter: what it does, how the ECU uses it, what the axes and values mean) and how the map is structured (axis = breakpoints like RPM, cells = limits or targets). Write for someone who may not know ECU tuning. Use the map name and vehicle_model from context when relevant.
   - For short follow‑up questions that clearly refer to an existing explanation or edit (e.g. "Can my car handle a rev limiter at 4.8k?", "Is this safe?", "Can I push it more?"), do NOT repeat the long explanation. Instead, give a short, direct answer focused on the new question (e.g. whether it is reasonable, what others typically do, safety margins, required supporting mods). When vehicle_model is present, you MUST take a position based on typical tuning practice for that platform: answer as "Yes, and here is why…", "No, and here is why…", or "It is possible but only if you also do X/Y/Z…". Avoid vague answers like "it depends" unless you immediately follow with a concrete recommendation.
2. issues: List any problems or gaps (e.g. missing axis labels, low confidence). Empty list if none.
3. suggestions: Step-by-step instructions for this user's situation. When selected_map_text_view is provided, you MUST use the exact numbers from that table. Each step one list item. For edits: state the exact value to enter (e.g. "At 4530 RPM set the cell to 6000", "Rename the next column from 5200 to 4531 RPM and set that cell to 0"). Never say "or a desired value" or "set to X"—give the concrete number. If the user wants a hardcut rev limiter before the redzone at 4.5k RPM, your steps should say precisely: which column (e.g. 4530), what to set it to (e.g. 6000 to allow full torque up to that point), and what to do with the next breakpoint (e.g. rename to 4531 RPM and set to 0 for hardcut). Base all numbers on the selected_map_text_view table.
4. ask_vehicle: Only when the user asks for tuning but vehicle_model is missing: one short sentence asking for vehicle/ECU (e.g. "Which vehicle or ECU is this for? (e.g. Peugeot 206 2.0 HDI 2002)."). Otherwise null.

Rules:
- Use project_context, scanned_files, maps, and user_message. When selected_map_text_view is present, it is the exact Text Viewer table for the map the user has selected. All suggested values and column/row references must come from that table.
- When all_maps_text_views is present, it contains the Text Viewer table (axis labels + data grid) for multiple scanned maps, each under a "--- Map: name (type, offset, dimensions) ---" header. If the user asks what the other scan results are, what each map is, or what they relate to, you MUST use all_maps_text_views: look at each map's axes (e.g. RPM, load), dimensions, value ranges and patterns, and say what each likely is (e.g. "0x683CC: 2D 6×7, RPM vs load—likely fuel or torque map"; "0x64020: 2D 17×1—likely RPM-based limit or limiter"). List or describe each scanned map the user cares about. Do not say you don't have that information when all_maps_text_views is provided.
- For tuning or edit suggestions, only answer with concrete steps if project_context.vehicle_model is set. If the user asks to tune but vehicle_model is null or empty, set ask_vehicle to the one-sentence question above and leave suggestions minimal or empty.
- When the user asks broader questions about whether their engine can safely handle a certain change (e.g. "Can my car handle a rev limiter at higher RPM?"), give a clear opinionated answer using the known vehicle_model and general tuner knowledge. Pick a side and justify it: say explicitly if most tuners consider it safe at that RPM on that platform, safe only with supporting mods, or generally not recommended, and explain why (rod strength, turbo size, valve train, clutch, etc.). Do NOT answer only "it depends" or stay neutral.

Correcting wrong map analysis (selected_map_for_correction):
- When selected_map_for_correction is present, the user has a map selected. You MUST look at the selected_map_text_view (the exact table and numbers from the analysis map) and infer the correct structure yourself. The user does not know what is wrong—you must figure it out from the numbers. Not every map is the same; analyze each map's values to decide what is axis and what is data.

CRITICAL – Infer axis vs data from the numbers (do not assume every map is the same):
- Look at the actual values in the table. Axis breakpoints (e.g. RPM, load) usually form a monotonic or regular sequence: 1000, 1250, 1500, 1750, 1900, 2000, 2250, 2500, 2750, 3000, 3250, 3500, 3750, 4000, 4530, 5200, 5300, 6000, etc. Map data (e.g. torque limits) often has a different range or pattern (e.g. 3600, 4000, 4600, 5030, 5000, 4510… or lower values, or less regular).
- If the current "data" row(s) still look like breakpoints (e.g. 2250, 2500, 2750, 3000, 3250, 3500), they are NOT the real map values—they are the continuation of the x-axis. In that case the dimensions are too small: you must increase the number of columns so that the full axis is in row 0 and only the true map values appear in row 1 (and later). Example: if row 0 has 6 RPMs and row 1 has 6 more RPM-like values, the axis is 12+ values; suggest dimensions so that the first row holds all axis values (e.g. 19,2 for 19 RPMs + 19 torque values).
- Count from the numbers: how many values in a row look like axis (RPM/breakpoints)? How many rows look like axis vs like data? Set dimensions (num_columns, num_rows) so that row 0 = full axis and rows 1+ = only real map values. It does not have to be perfect (some room is acceptable), but the values shown in the table body must be the actual map data, not more axis values.
- Use skip_bytes when there is leading header/garbage. Trim trailing garbage by choosing num_rows (and num_columns) so you do not read junk at the end. Prefer 2D when there is a clear axis row and data row(s); use 1D only when there is no separate axis.

- You have full control to suggest a correction: type (1D, 2D, or 3D), dimensions, and where the map data starts (offset_hex or skip_bytes). If the analysis already looks correct (axis in row 0, real values in data rows), do NOT add a MAP_FIX; say so in the summary. If it looks wrong, add exactly one MAP_FIX line.
- To suggest a correction, add exactly one line in suggestions: MAP_FIX: type=<1D|2D|3D> dimensions=<x,y> [offset_hex=0xXXXXX | skip_bytes=N]
  - type: 2D when the numbers show a clear axis row and data row(s); 1D only when there is no separate axis.
  - dimensions: (num_columns, num_rows) so that the first row contains the full axis (all breakpoints) and the following rows contain only map values. If the current table shows axis-like values in the "data" row, increase num_columns (e.g. 19,2 for 19 breakpoints and 1 data row). Not every map is the same—derive from the value pattern.
  - Use skip_bytes for leading header; reduce num_rows to avoid trailing garbage.
- Examples: (a) Table has row 0 = 1000,1250,1500,1750,1900,2000 and row 1 = 2250,2500,2750,3000,3250,3500 (still RPM-like) → axis is longer than 6; real data starts after 19 breakpoints → MAP_FIX: type=2D dimensions=19,2 skip_bytes=12. (b) Row 0 = RPMs, rows 1–5 = different value range (torque-like), row 6 = garbage → MAP_FIX: type=2D dimensions=6,6 skip_bytes=12. (c) Analysis correct → no MAP_FIX.
- Put only one MAP_FIX line in suggestions. In the summary, briefly explain what you inferred (which values are axis, which are data) and why you chose those dimensions.

- Respond with a JSON object only, no markdown or extra text. Use this exact shape:
{"summary": "Short explanation focused on this question (see rules above).", "issues": ["issue or empty list"], "suggestions": ["Step 1: exact action and value", "Step 2: ...", "MAP_FIX: ... if correcting map"], "ask_vehicle": null or "one sentence"}
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
    if req.all_maps_text_views and req.all_maps_text_views.strip():
        payload["all_maps_text_views"] = req.all_maps_text_views.strip()
    if req.selected_map_for_correction:
        payload["selected_map_for_correction"] = req.selected_map_for_correction
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
