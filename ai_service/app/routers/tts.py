"""Lightweight neural text-to-speech for the parent assistant.

Uses edge-tts (already a dependency of the video pipeline) to synthesise far more
natural voices than the browser's built-in speechSynthesis. The frontend calls
this first and falls back to on-device Web Speech when unavailable.
"""

import edge_tts
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

router = APIRouter(prefix="/tts", tags=["tts"])

# Neural voice per short language code. Keep aligned with the learner app's
# locales (en / hi / ar); unknown codes fall back to English.
VOICES = {
    "en": "en-US-JennyNeural",
    "hi": "hi-IN-SwaraNeural",
    "ar": "ar-SA-ZariyahNeural",
}


class SpeakRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    # short code ("en") or BCP-47 ("en-US") — only the prefix is used
    language: str = "en"


def _voice_for(language: str | None) -> str:
    lang = (language or "en").split("-")[0].lower()
    return VOICES.get(lang, VOICES["en"])


@router.get(
    "/v1/speak",
    summary="Stream synthesised speech (MP3) — starts playing before synthesis finishes",
    response_class=StreamingResponse,
)
async def speak_stream(
    text: str = Query(..., min_length=1, max_length=2000),
    language: str = Query("en"),
) -> StreamingResponse:
    """GET + streaming so an <audio src=…> element can start playback on the
    first buffered bytes instead of waiting for the whole file — this is what
    keeps the assistant's spoken answer snappy."""
    voice = _voice_for(language)

    async def gen():
        communicate = edge_tts.Communicate(text, voice)
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                yield chunk["data"]

    return StreamingResponse(gen(), media_type="audio/mpeg")


@router.post(
    "/v1/speak",
    summary="Synthesise speech (MP3) for short assistant answers",
    response_class=Response,
)
async def speak(req: SpeakRequest) -> Response:
    voice = _voice_for(req.language)
    try:
        communicate = edge_tts.Communicate(req.text, voice)
        chunks: list[bytes] = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                chunks.append(chunk["data"])
        if not chunks:
            raise HTTPException(status_code=502, detail="TTS produced no audio")
        return Response(content=b"".join(chunks), media_type="audio/mpeg")
    except HTTPException:
        raise
    except Exception as e:  # edge-tts is an external service — fail loud, client falls back
        raise HTTPException(status_code=502, detail=f"TTS failed: {e}")


__all__ = ["router"]
