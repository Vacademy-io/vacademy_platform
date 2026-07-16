"""Voice casting for DIALOGUE_SCENE characters.

Before this registry, dialogue voices were assigned by GENDER ONLY — an
elderly institute owner and his young student got the same stock voice, and
two same-gender characters in one scene shared literally one voice. This
module gives each character a DISTINCT provider voice matched to their
``voice_hint`` (age/timbre words), and lets the cast gate override it
per-character (``voice_id`` in the cast answer, persisted with the cast for
series reuse).

The tags are curated heuristics, editable in place — the hard guarantees are
(a) two characters never share a voice when the provider has enough voices,
and (b) a stored/user-picked ``voice_id`` always wins. Only providers that
honor ``voice_id`` in ``_synthesize_voice`` are listed (Sarvam validates
against SARVAM_VOICES; Google resolves names). Edge ignores voice_id — no
entry, callers fall back to gender-only behavior.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence, Set

# {provider: {gender: [{voice_id, label, tags}]}} — first entry per gender is
# the default (matches SARVAM_DEFAULT_VOICE so no-hint casting is unchanged).
VOICE_REGISTRY: Dict[str, Dict[str, List[Dict[str, Any]]]] = {
    "sarvam": {
        "male": [
            {"voice_id": "shubh", "label": "Shubh — steady adult",
             "tags": ("adult", "steady", "narrator")},
            {"voice_id": "ratan", "label": "Ratan — older, weathered",
             "tags": ("elderly", "older", "old", "senior", "mature", "weary",
                       "grandfather", "sir", "60s", "70s")},
            {"voice_id": "anand", "label": "Anand — warm, measured",
             "tags": ("warm", "measured", "teacher", "calm", "gentle", "40s", "50s")},
            {"voice_id": "kabir", "label": "Kabir — deep, confident",
             "tags": ("deep", "confident", "authoritative", "boss", "leader")},
            {"voice_id": "aditya", "label": "Aditya — young, energetic",
             "tags": ("young", "energetic", "student", "boy", "20s", "excited")},
        ],
        "female": [
            {"voice_id": "ritu", "label": "Ritu — steady adult",
             "tags": ("adult", "steady", "narrator")},
            {"voice_id": "kavitha", "label": "Kavitha — older, measured",
             "tags": ("elderly", "older", "old", "senior", "mature",
                       "grandmother", "madam", "60s", "70s")},
            {"voice_id": "pooja", "label": "Pooja — warm, friendly",
             "tags": ("warm", "friendly", "teacher", "gentle", "30s", "40s", "ma'am")},
            {"voice_id": "sophia", "label": "Sophia — polished, professional",
             "tags": ("professional", "polished", "confident", "corporate")},
            {"voice_id": "shreya", "label": "Shreya — young, bright",
             "tags": ("young", "bright", "girl", "student", "20s", "excited")},
        ],
    },
}


def _normalize_provider(tts_provider: Optional[str]) -> str:
    return str(tts_provider or "").strip().lower()


def voice_options(tts_provider: Optional[str]) -> List[Dict[str, str]]:
    """Flat [{voice_id, label, gender}] for the cast-gate payload — the FE
    voice picker renders these. Empty when the provider has no registry
    (Edge / unknown) so the picker simply doesn't render."""
    reg = VOICE_REGISTRY.get(_normalize_provider(tts_provider)) or {}
    out: List[Dict[str, str]] = []
    for gender, voices in reg.items():
        for v in voices:
            out.append({"voice_id": v["voice_id"], "label": v["label"], "gender": gender})
    return out


def is_registry_voice(tts_provider: Optional[str], voice_id: Optional[str]) -> bool:
    vid = str(voice_id or "").strip().lower()
    return any(o["voice_id"] == vid for o in voice_options(tts_provider))


def pick_voice(
    tts_provider: Optional[str],
    gender: str,
    voice_hint: str = "",
    used: Optional[Set[str]] = None,
) -> Optional[str]:
    """Cast one character: best tag-match against the hint, avoiding voices
    already used by other characters. None when the provider has no registry
    (caller keeps gender-only behavior)."""
    reg = VOICE_REGISTRY.get(_normalize_provider(tts_provider)) or {}
    voices: Sequence[Dict[str, Any]] = reg.get(str(gender or "").strip().lower()) or []
    if not voices:
        return None
    used = used or set()
    hint = str(voice_hint or "").lower()
    best, best_score = None, -1
    for v in voices:
        score = sum(1 for t in v["tags"] if t in hint)
        if v["voice_id"] in used:
            score -= 100  # only reuse when every voice is taken
        if score > best_score:
            best, best_score = v, score
    return best["voice_id"] if best else None
