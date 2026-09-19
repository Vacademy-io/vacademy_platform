"""What the voice, speech-to-text, OCR and image vendors charge us, so every
usage row can carry a real `total_price` (cost review 2026-09-07: those
rows had none, and margins were being read off list prices).

Rates are USD list prices as of September 2026; update them from the
invoices. Model token prices live in `ai_models`; image prices in
`ai_models.image_price_per_unit`.
"""
from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# USD per 1,000 characters synthesised.
TTS_USD_PER_1K_CHARS = {
    "smallest": 0.025,     # Lightning v3.1: ~$0.25 per 10k chars (~$0.02/min of audio)
    "sarvam": 0.036,       # Bulbul v3: ₹30 per 10k chars
    "google": 0.016,       # Chirp3-HD: $16 per 1M chars
    "edge": 0.0,
}
# USD per hour of audio transcribed.
STT_USD_PER_HOUR = {
    "sarvam": 0.36,        # Saaras: ₹30 per hour, billed per second
    "openrouter": 0.012,   # whisper-large-v3-turbo via DeepInfra: $0.0002/min
    "render": 0.0,         # our own worker (infra, not metered)
}
OCR_USD_PER_PAGE = 0.025   # MathPix PDF conversion, list price
IMAGE_USD_DEFAULT = 0.04   # qwen-image-3 (ai_models.image_price_per_unit)


def tts_cost_usd(provider: str, characters: int) -> float:
    return round(max(0, int(characters or 0)) / 1000.0 * TTS_USD_PER_1K_CHARS.get((provider or "").lower(), 0.0), 6)


def stt_cost_usd(provider: str, seconds: float) -> float:
    return round(max(0.0, float(seconds or 0.0)) / 3600.0 * STT_USD_PER_HOUR.get((provider or "").lower(), 0.0), 6)


def ocr_cost_usd(pages: int) -> float:
    return round(max(0, int(pages or 0)) * OCR_USD_PER_PAGE, 6)


def image_cost_usd(model_id: Optional[str]) -> float:
    """The image model's per-unit price from ai_models, else the default."""
    if model_id:
        try:
            from sqlalchemy import text
            from ..db import db_session
            with db_session() as db:
                row = db.execute(text("SELECT image_price_per_unit FROM ai_models WHERE model_id = :m"), {"m": model_id}).first()
            if row and row[0] is not None and float(row[0]) > 0:
                return float(row[0])
        except Exception:  # noqa: BLE001
            logger.debug("image price lookup failed for %s", model_id, exc_info=True)
    return IMAGE_USD_DEFAULT
