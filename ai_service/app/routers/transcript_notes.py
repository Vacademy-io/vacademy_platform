"""
Router for turning a lecture transcript into clean, structured study notes.

Used by the "View Transcript → Study Notes" tab in the live-session UI.
Returns Markdown so the caller can render with react-markdown in the
browser. We deliberately do NOT return a JSON outline — students/teachers
read these as notes, not parse them.
"""
from __future__ import annotations

import logging
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/transcript", tags=["transcript-notes"])


class GenerateNotesRequest(BaseModel):
    transcript_text: str = Field(..., min_length=10)
    # Optional hints — UI may forward the recording title and the detected
    # language so the model produces notes in the right tongue with a
    # sensible top-level heading.
    title_hint: Optional[str] = None
    target_language: str = Field(
        default="en",
        description="ISO code. Output notes will be in this language.",
    )


class GenerateNotesResponse(BaseModel):
    markdown: str
    model: str


_GEMINI_TEXT_ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.5-flash:generateContent"
)

# OpenRouter is the preferred path because it isn't subject to per-project
# Google Cloud restrictions — the same key works regardless of which Google
# project the org's direct API key is in. We still keep a direct-Gemini
# fallback so a single provider outage doesn't take the endpoint down.
_OPENROUTER_MODEL = "google/gemini-2.5-flash"


_LANG_NAMES = {
    "en": "English",
    "hi": "Hindi",
    "bn": "Bengali",
    "ta": "Tamil",
    "te": "Telugu",
    "mr": "Marathi",
    "gu": "Gujarati",
    "kn": "Kannada",
    "ml": "Malayalam",
    "pa": "Punjabi",
    "ur": "Urdu",
}


def _build_prompt(transcript: str, title_hint: Optional[str], target_language: str) -> str:
    lang_name = _LANG_NAMES.get(target_language.lower(), "English")
    title_line = (
        f"Suggested top-level title: {title_hint}\n"
        if title_hint
        else "Pick a concise top-level title that summarises the lecture.\n"
    )
    return (
        f"Convert the following lecture transcript into well-structured "
        f"study notes in {lang_name}. Write the notes in clean Markdown "
        "with these rules:\n"
        "1. Start with a single H1 (`# Title`) line.\n"
        "2. Use H2 (`##`) for major sections, H3 (`###`) for sub-topics.\n"
        "3. Prefer concise bullet points (`-`) over long paragraphs.\n"
        "4. Use **bold** for key terms the first time they appear.\n"
        "5. Use fenced code blocks (```) for any code snippets, "
        "formulas, or commands mentioned.\n"
        "6. Add a `> Key takeaway:` blockquote at the end of each major section.\n"
        "7. Keep markdown clean — no stray HTML, no horizontal rules, "
        "no tables unless they genuinely clarify a comparison.\n"
        "8. Skip filler ('um', 'so', 'right'), false starts, and audio glitches "
        "from the transcript.\n"
        "9. Do not invent facts that aren't in the transcript. If the "
        "transcript is too short or noisy to produce real notes, output a "
        "short Markdown paragraph explaining that politely.\n\n"
        f"{title_line}\n"
        "--- TRANSCRIPT ---\n"
        f"{transcript}\n"
        "--- END TRANSCRIPT ---\n\n"
        "Respond with the Markdown only — no preamble, no triple-backtick "
        "wrapper around the whole document."
    )


async def _call_openrouter(prompt: str, api_key: str, base_url: str) -> str:
    """Call OpenRouter's OpenAI-compatible chat completions endpoint and return the
    raw markdown content. Raises httpx.HTTPStatusError on non-2xx, RuntimeError on
    empty payload, httpx.RequestError on transport failure."""
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            base_url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": _OPENROUTER_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
                "max_tokens": 8192,
            },
        )
    if resp.status_code != 200:
        # Bubble up the OpenRouter error body so the orchestrator above can
        # decide whether to fall back to direct Gemini or surface to the user.
        raise httpx.HTTPStatusError(
            f"OpenRouter {resp.status_code}: {resp.text[:500]}",
            request=resp.request,
            response=resp,
        )
    data = resp.json()
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError(f"OpenRouter returned no choices: {str(data)[:300]}")
    content = (choices[0].get("message") or {}).get("content") or ""
    if not content.strip():
        raise RuntimeError(f"OpenRouter returned empty content: {str(data)[:300]}")
    return content


async def _call_gemini_direct(prompt: str, api_key: str) -> str:
    """Call Google's direct Generative Language API. Raises httpx.HTTPStatusError on
    non-2xx, RuntimeError on empty payload, httpx.RequestError on transport failure."""
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{_GEMINI_TEXT_ENDPOINT}?key={api_key}",
            headers={"Content-Type": "application/json"},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.3,
                    "maxOutputTokens": 8192,
                },
            },
        )
    if resp.status_code != 200:
        raise httpx.HTTPStatusError(
            f"Gemini {resp.status_code}: {resp.text[:500]}",
            request=resp.request,
            response=resp,
        )
    data = resp.json()
    markdown = ""
    for cand in data.get("candidates", []):
        for part in cand.get("content", {}).get("parts", []):
            if "text" in part:
                markdown = part["text"]
                break
        if markdown:
            break
    if not markdown.strip():
        raise RuntimeError(f"Gemini returned empty payload: {str(data)[:300]}")
    return markdown


def _strip_outer_markdown_fence(text: str) -> str:
    """If the model wrapped the whole document in ```markdown fences, strip them
    so react-markdown doesn't render a single huge code block."""
    stripped = text.strip()
    if not stripped.startswith("```"):
        return text
    first_newline = stripped.find("\n")
    if first_newline == -1 or not stripped.rstrip().endswith("```"):
        return text
    inner = stripped[first_newline + 1:].rstrip()
    if inner.endswith("```"):
        inner = inner[:-3].rstrip()
    return inner


@router.post("/generate-notes", response_model=GenerateNotesResponse)
async def generate_notes(body: GenerateNotesRequest) -> GenerateNotesResponse:
    settings = get_settings()
    openrouter_key: Optional[str] = getattr(settings, "openrouter_api_key", None)
    gemini_key: Optional[str] = getattr(settings, "gemini_api_key", None)
    openrouter_url: str = getattr(settings, "llm_base_url",
                                  "https://openrouter.ai/api/v1/chat/completions")

    if not openrouter_key and not gemini_key:
        raise HTTPException(
            status_code=503,
            detail="No LLM provider configured. Set OPENROUTER_API_KEY (preferred) or GEMINI_API_KEY on ai-service.",
        )

    prompt = _build_prompt(
        transcript=body.transcript_text,
        title_hint=body.title_hint,
        target_language=body.target_language,
    )

    # Track per-provider failures so the final HTTPException tells the caller
    # exactly which providers were tried and why each rejected the request —
    # otherwise users get a generic 502 and operators have to grep logs.
    failures: list[str] = []
    markdown: Optional[str] = None
    used_model: Optional[str] = None

    # Primary: OpenRouter. Works around per-project Google API restrictions
    # because OpenRouter holds the upstream Google relationship, not us.
    if openrouter_key:
        try:
            markdown = await _call_openrouter(prompt, openrouter_key, openrouter_url)
            used_model = _OPENROUTER_MODEL
        except Exception as e:
            logger.warning("[transcript-notes] openrouter failed: %s", e)
            failures.append(f"OpenRouter: {e}")
    else:
        failures.append("OpenRouter: no key configured")

    # Fallback: direct Gemini. Useful when OpenRouter is rate-limited or
    # temporarily down AND the deploying env happens to have a working
    # direct Gemini key.
    if markdown is None and gemini_key:
        try:
            markdown = await _call_gemini_direct(prompt, gemini_key)
            used_model = "gemini-2.5-flash"
        except Exception as e:
            logger.error("[transcript-notes] gemini direct failed: %s", e)
            failures.append(f"Gemini direct: {e}")
    elif markdown is None:
        failures.append("Gemini direct: no key configured")

    if markdown is None:
        raise HTTPException(
            status_code=502,
            detail="All LLM providers failed - " + "; ".join(failures),
        )

    return GenerateNotesResponse(
        markdown=_strip_outer_markdown_fence(markdown),
        model=used_model or _OPENROUTER_MODEL,
    )
