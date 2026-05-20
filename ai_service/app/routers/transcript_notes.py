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


@router.post("/generate-notes", response_model=GenerateNotesResponse)
async def generate_notes(body: GenerateNotesRequest) -> GenerateNotesResponse:
    settings = get_settings()
    gemini_key: Optional[str] = getattr(settings, "gemini_api_key", None)
    if not gemini_key:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY is not configured on ai-service",
        )

    prompt = _build_prompt(
        transcript=body.transcript_text,
        title_hint=body.title_hint,
        target_language=body.target_language,
    )

    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            resp = await client.post(
                f"{_GEMINI_TEXT_ENDPOINT}?key={gemini_key}",
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.3,
                        "maxOutputTokens": 8192,
                    },
                },
            )
        except httpx.RequestError as e:
            logger.error("[transcript-notes] gemini transport error: %s", e)
            raise HTTPException(status_code=502, detail=f"Gemini transport error: {e}")

    if resp.status_code != 200:
        logger.error("[transcript-notes] gemini %s: %s", resp.status_code, resp.text[:500])
        raise HTTPException(
            status_code=502,
            detail=f"Gemini API error {resp.status_code}",
        )

    data = resp.json()
    # Gemini returns text under candidates[0].content.parts[].text
    markdown = ""
    for cand in data.get("candidates", []):
        for part in cand.get("content", {}).get("parts", []):
            if "text" in part:
                markdown = part["text"]
                break
        if markdown:
            break

    if not markdown or not markdown.strip():
        logger.error("[transcript-notes] empty response payload=%s", str(data)[:500])
        raise HTTPException(
            status_code=502,
            detail="Gemini returned an empty notes payload — retry or check the transcript length.",
        )

    # Defensive: if the model accidentally wrapped the whole document in
    # ```markdown fences, strip them so react-markdown doesn't render a
    # single huge code block.
    stripped = markdown.strip()
    if stripped.startswith("```"):
        first_newline = stripped.find("\n")
        if first_newline != -1 and stripped.rstrip().endswith("```"):
            stripped = stripped[first_newline + 1:].rstrip()
            if stripped.endswith("```"):
                stripped = stripped[:-3].rstrip()
            markdown = stripped

    return GenerateNotesResponse(markdown=markdown, model="gemini-2.5-flash")
