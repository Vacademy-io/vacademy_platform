#!/usr/bin/env python3
"""
Automation pipeline that turns a short prompt into a fully rendered video.

Steps:
1. Use OpenRouter to draft a single long-form script for the entire video.
2. Feed that script to ElevenLabs (via with_timestamps.sh) to get audio + timestamps.
3. Run parse_timestamps.py to derive per-word timings + phoneme info.
4. After narration timing is known, slice it into ~1-minute windows and call
   OpenRouter (in parallel) for HTML/CSS overlays for each slice.
5. Assemble a timeline JSON compatible with generate_video.py and render the MP4.
"""

from __future__ import annotations


import argparse
import base64
import concurrent.futures
import json
import os
import re
import subprocess
import sys
import textwrap
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

import urllib.error
import urllib.error
import urllib.request
import time
import functools

try:
    from rembg import remove as rembg_remove, new_session as rembg_new_session
    REMBG_AVAILABLE = True
except ImportError:
    REMBG_AVAILABLE = False
    rembg_remove = None       # type: ignore[assignment]
    rembg_new_session = None   # type: ignore[assignment]
    print("⚠️  rembg not installed — cutout background removal disabled. pip install rembg")

# Singleton rembg session — loads model ONCE, shared across threads.
# Uses u2netp (4.7MB) instead of u2net (176MB) to reduce memory footprint.
# A lock serializes inference calls so only one thread runs rembg at a time,
# preventing ONNX Runtime from allocating concurrent inference buffers → OOM.
_rembg_session = None
_rembg_lock = None
try:
    import threading
    _rembg_lock = threading.Lock()
except Exception:
    pass

def _get_rembg_session():
    """Lazy-init singleton rembg session (u2netp). Thread-safe."""
    global _rembg_session
    if not REMBG_AVAILABLE:
        return None
    if _rembg_session is not None:
        return _rembg_session
    # Double-checked locking
    if _rembg_lock:
        with _rembg_lock:
            if _rembg_session is not None:
                return _rembg_session
            print("    🧠 Loading rembg model (u2netp, ~4.7MB) — one-time init...")
            _rembg_session = rembg_new_session("u2netp")
            return _rembg_session
    _rembg_session = rembg_new_session("u2netp")
    return _rembg_session

REPO_ROOT = Path(__file__).resolve().parent
LOCAL_DEPS_DIR = REPO_ROOT / ".deps"
DEFAULT_RUNS_DIR = REPO_ROOT / "my_test_files" / "runs"
DEFAULT_VIDEO_OPTIONS = REPO_ROOT / "video_options.json"
DEFAULT_CAPTIONS_SETTINGS = REPO_ROOT / "captions_settings.json"
DEFAULT_BRANDING = REPO_ROOT / "branding.json"
WITH_TIMESTAMPS_SCRIPT = REPO_ROOT / "with_timestamps.sh"
PARSE_TIMESTAMPS_SCRIPT = REPO_ROOT / "parse_timestamps.py"
GENERATE_VIDEO_SCRIPT = REPO_ROOT / "generate_video.py"
try:
    from prompts import (
        SCRIPT_SYSTEM_PROMPT,
        get_script_system_prompt,
        SCRIPT_USER_PROMPT_TEMPLATE,
        SCRIPT_REVIEW_SYSTEM_PROMPT,
        SCRIPT_REVIEW_USER_PROMPT_TEMPLATE,
        STYLE_GUIDE_SYSTEM_PROMPT,
        STYLE_GUIDE_USER_PROMPT_TEMPLATE,
        HTML_GENERATION_SYSTEM_PROMPT_TEMPLATE,
        HTML_GENERATION_SAFE_AREA,
        get_html_generation_safe_area,
        _get_fewshot_examples,
        HTML_GENERATION_USER_PROMPT_TEMPLATE,
        SEGMENT_CONTEXT_ADDON,
        BACKGROUND_PRESETS,
        TOPIC_SHOT_PROFILES,
    )
except ImportError:
    # Fallback or error if not found. But since we just created it, it should be fine.
    # We will raise to ensure the user knows something is wrong.
    raise RuntimeError("Could not import prompts.py. Ensure it exists in the same directory.")

# Import content-type-specific prompts for QUIZ, STORYBOOK, etc.
try:
    from content_type_prompts import (
        CONTENT_TYPE_PROMPTS,
        get_content_type_prompts,
        format_user_prompt,
    )
except ImportError:
    # Not all deployments may have content_type_prompts yet
    CONTENT_TYPE_PROMPTS = {}
    def get_content_type_prompts(content_type):
        return {}
    def format_user_prompt(content_type, **kwargs):
        return None

# Import template gallery definitions
try:
    from video_templates import get_template_by_id as _get_template_by_id
except ImportError:
    def _get_template_by_id(_id):  # type: ignore[misc]
        return None

DEFAULT_OPENROUTER_KEY = os.environ.get("OPENROUTER_API_KEY", "")
DEFAULT_PEXELS_API_KEYS = os.environ.get("PEXELS_API_KEYS", "")
DEFAULT_PIXABAY_API_KEYS = os.environ.get("PIXABAY_API_KEYS", "")

VOICE_MAPPING = {
    # format: "lowercase language": {"edge": {"male": "...", "female": "..."}, "google": {"male": "...", "female": "..."}}
    "english": {
        "edge": {"female": "en-US-AriaNeural", "male": "en-US-ChristopherNeural"},
        "google": {"female": "en-US-Journey-F", "male": "en-US-Journey-D"}
    },
    "english (us)": {
        "edge": {"female": "en-US-AriaNeural", "male": "en-US-ChristopherNeural"},
        "google": {"female": "en-US-Journey-F", "male": "en-US-Journey-D"}
    },
    "english (uk)": {
        "edge": {"female": "en-GB-SoniaNeural", "male": "en-GB-RyanNeural"},
        "google": {"female": "en-GB-Neural2-A", "male": "en-GB-Neural2-B"}
    },
    "english (india)": {
        "edge": {"female": "en-IN-NeerjaNeural", "male": "en-IN-PrabhatNeural"},
        "google": {"female": "en-IN-Neural2-A", "male": "en-IN-Neural2-B"}
    },
    "hindi": {
        "edge": {"female": "hi-IN-SwaraNeural", "male": "hi-IN-MadhurNeural"},
        "google": {"female": "hi-IN-Neural2-A", "male": "hi-IN-Neural2-B"}
    },
    "bengali": {
        "edge": {"female": "bn-IN-TanishaaNeural", "male": "bn-IN-BashkarNeural"},
        "google": {"female": "bn-IN-Wavenet-A", "male": "bn-IN-Wavenet-B"}
    },
    "tamil": {
        "edge": {"female": "ta-IN-PallaviNeural", "male": "ta-IN-ValluvarNeural"},
        "google": {"female": "ta-IN-Wavenet-A", "male": "ta-IN-Wavenet-B"}
    },
    "telugu": {
        "edge": {"female": "te-IN-ShrutiNeural", "male": "te-IN-MohanNeural"},
        "google": {"female": "te-IN-Standard-A", "male": "te-IN-Standard-B"}
    },
    "marathi": {
        "edge": {"female": "mr-IN-AarohiNeural", "male": "mr-IN-ManoharNeural"},
        "google": {"female": "mr-IN-Wavenet-A", "male": "mr-IN-Wavenet-B"}
    },
    "kannada": {
        "edge": {"female": "kn-IN-SapnaNeural", "male": "kn-IN-GaganNeural"},
        "google": {"female": "kn-IN-Wavenet-A", "male": "kn-IN-Wavenet-B"}
    },
    "gujarati": {
        "edge": {"female": "gu-IN-DhwaniNeural", "male": "gu-IN-NiranjanNeural"},
        "google": {"female": "gu-IN-Wavenet-A", "male": "gu-IN-Wavenet-B"}
    },
    "malayalam": {
        "edge": {"female": "ml-IN-SobhanaNeural", "male": "ml-IN-MidhunNeural"},
        "google": {"female": "ml-IN-Wavenet-A", "male": "ml-IN-Wavenet-B"}
    },
    "spanish": {
        "edge": {"female": "es-ES-ElviraNeural", "male": "es-ES-AlvaroNeural"},
        "google": {"female": "es-ES-Neural2-A", "male": "es-ES-Neural2-B"}
    },
    "spanish (us)": {
        "edge": {"female": "es-US-PalomaNeural", "male": "es-US-AlonsoNeural"},
        "google": {"female": "es-US-Neural2-A", "male": "es-US-Neural2-B"}
    },
    "french": {
        "edge": {"female": "fr-FR-DeniseNeural", "male": "fr-FR-HenriNeural"},
        "google": {"female": "fr-FR-Neural2-A", "male": "fr-FR-Neural2-B"}
    },
    "french (canada)": {
        "edge": {"female": "fr-CA-SylvieNeural", "male": "fr-CA-AntoineNeural"},
        "google": {"female": "fr-CA-Neural2-A", "male": "fr-CA-Neural2-B"}
    },
    "german": {
        "edge": {"female": "de-DE-KatjaNeural", "male": "de-DE-ConradNeural"},
        "google": {"female": "de-DE-Neural2-A", "male": "de-DE-Neural2-B"}
    },
    "italian": {
        "edge": {"female": "it-IT-ElsaNeural", "male": "it-IT-DiegoNeural"},
        "google": {"female": "it-IT-Neural2-A", "male": "it-IT-Neural2-C"}
    },
    "portuguese (brazil)": {
        "edge": {"female": "pt-BR-FranciscaNeural", "male": "pt-BR-AntonioNeural"},
        "google": {"female": "pt-BR-Neural2-A", "male": "pt-BR-Neural2-B"}
    },
    "portuguese (portugal)": {
        "edge": {"female": "pt-PT-RaquelNeural", "male": "pt-PT-DuarteNeural"},

    },
    "dutch": {
        "edge": {"female": "nl-NL-ColetteNeural", "male": "nl-NL-MaartenNeural"},
        "google": {"female": "nl-NL-Wavenet-A", "male": "nl-NL-Wavenet-B"}
    },
    "dutch (belgium)": {
        "edge": {"female": "nl-BE-DenaNeural", "male": "nl-BE-ArnaudNeural"},

    },
    "danish": {
        "edge": {"female": "da-DK-ChristelNeural", "male": "da-DK-JeppeNeural"},
        "google": {"female": "da-DK-Neural2-D", "male": "da-DK-Wavenet-C"}
    },
    "finnish": {
        "edge": {"female": "fi-FI-SelmaNeural", "male": "fi-FI-HarriNeural"},

    },
    "norwegian": {
        "edge": {"female": "nb-NO-PernilleNeural", "male": "nb-NO-FinnNeural"},

    },
    "swedish": {
        "edge": {"female": "sv-SE-SofieNeural", "male": "sv-SE-MattiasNeural"},
        "google": {"female": "sv-SE-Wavenet-A", "male": "sv-SE-Wavenet-C"}
    },
    "icelandic": {
        "edge": {"female": "is-IS-GudrunNeural", "male": "is-IS-GunnarNeural"},

    },
    "polish": {
        "edge": {"female": "pl-PL-ZofiaNeural", "male": "pl-PL-MarekNeural"},
        "google": {"female": "pl-PL-Wavenet-A", "male": "pl-PL-Wavenet-B"}
    },
    "russian": {
        "edge": {"female": "ru-RU-SvetlanaNeural", "male": "ru-RU-DmitryNeural"},
        "google": {"female": "ru-RU-Wavenet-A", "male": "ru-RU-Wavenet-B"}
    },
    "ukrainian": {
        "edge": {"female": "uk-UA-PolinaNeural", "male": "uk-UA-OstapNeural"},
        "google": {"female": "uk-UA-Wavenet-A", "male": "uk-UA-Chirp3-HD-Charon"}
    },
    "czech": {
        "edge": {"female": "cs-CZ-VlastaNeural", "male": "cs-CZ-AntoninNeural"},

    },
    "slovak": {
        "edge": {"female": "sk-SK-ViktoriaNeural", "male": "sk-SK-LukasNeural"},

    },
    "hungarian": {
        "edge": {"female": "hu-HU-NoemiNeural", "male": "hu-HU-TamasNeural"},

    },
    "romanian": {
        "edge": {"female": "ro-RO-AlinaNeural", "male": "ro-RO-EmilNeural"},

    },
    "bulgarian": {
        "edge": {"female": "bg-BG-KalinaNeural", "male": "bg-BG-BorislavNeural"},

    },
    "greek": {
        "edge": {"female": "el-GR-AthinaNeural", "male": "el-GR-NestorasNeural"},

    },
    "arabic": {
        "edge": {"female": "ar-SA-ZariyahNeural", "male": "ar-SA-HamedNeural"},
        "google": {"female": "ar-XA-Wavenet-A", "male": "ar-XA-Wavenet-B"}
    },
    "hebrew": {
        "edge": {"female": "he-IL-HilaNeural", "male": "he-IL-AvriNeural"},
        "google": {"female": "he-IL-Wavenet-A", "male": "he-IL-Wavenet-B"}
    },
    "turkish": {
        "edge": {"female": "tr-TR-EmelNeural", "male": "tr-TR-AhmetNeural"},
        "google": {"female": "tr-TR-Wavenet-A", "male": "tr-TR-Wavenet-B"}
    },
    "afrikaans": {
        "edge": {"female": "af-ZA-AdriNeural", "male": "af-ZA-WillemNeural"},
        "google": {"female": "af-ZA-Standard-A", "male": "af-ZA-Standard-A"}
    },
    "catalan": {
        "edge": {"female": "ca-ES-JoanaNeural", "male": "ca-ES-EnricNeural"},

    },
    "indonesian": {
        "edge": {"female": "id-ID-GadisNeural", "male": "id-ID-ArdiNeural"},
        "google": {"female": "id-ID-Wavenet-A", "male": "id-ID-Wavenet-B"}
    },
    "malay": {
        "edge": {"female": "ms-MY-YasminNeural", "male": "ms-MY-OsmanNeural"},
        "google": {"female": "ms-MY-Wavenet-A", "male": "ms-MY-Wavenet-B"}
    },
    "filipino": {
        "edge": {"female": "fil-PH-BlessicaNeural", "male": "fil-PH-AngeloNeural"},
        "google": {"female": "fil-PH-Wavenet-A", "male": "fil-PH-Wavenet-C"}
    },
    "vietnamese": {
        "edge": {"female": "vi-VN-HoaiMyNeural", "male": "vi-VN-NamMinhNeural"},
        "google": {"female": "vi-VN-Wavenet-A", "male": "vi-VN-Wavenet-B"}
    },
    "thai": {
        "edge": {"female": "th-TH-PremwadeeNeural", "male": "th-TH-NiwatNeural"},
        "google": {"female": "th-TH-Neural2-C", "male": "th-TH-Chirp3-HD-Charon"}
    },
    "urdu": {
        "edge": {"female": "ur-PK-UzmaNeural", "male": "ur-PK-AsadNeural"},
        "google": {"female": "ur-IN-Wavenet-A", "male": "ur-IN-Wavenet-B"}
    },
    "english (australia)": {
        "edge": {"female": "en-AU-NatashaNeural", "male": "en-AU-WilliamNeural"},
        "google": {"female": "en-AU-Neural2-A", "male": "en-AU-Neural2-B"}
    },
    "japanese": {
        "edge": {"female": "ja-JP-NanamiNeural", "male": "ja-JP-KeitaNeural"},
        "google": {"female": "ja-JP-Neural2-B", "male": "ja-JP-Neural2-C"}
    },
    "korean": {
        "edge": {"female": "ko-KR-SunHiNeural", "male": "ko-KR-InJoonNeural"},
        "google": {"female": "ko-KR-Neural2-A", "male": "ko-KR-Neural2-C"}
    },
    "chinese": {
        "edge": {"female": "zh-CN-XiaoxiaoNeural", "male": "zh-CN-YunxiNeural"},
        "google": {"female": "cmn-CN-Wavenet-A", "male": "cmn-CN-Wavenet-B"}
    },
    "chinese (taiwan)": {
        "edge": {"female": "zh-TW-HsiaoChenNeural", "male": "zh-TW-YunJheNeural"},
        "google": {"female": "cmn-TW-Wavenet-A", "male": "cmn-TW-Wavenet-B"}
    }
}


# ---------------------------------------------------------------------------
# Sarvam AI TTS voice configuration (bulbul:v3)
# All voices work across all 11 supported languages.
# ---------------------------------------------------------------------------
SARVAM_VOICES = {
    "male": [
        "shubh", "aditya", "rahul", "rohan", "amit", "dev", "ratan", "varun",
        "manan", "sumit", "kabir", "aayan", "ashutosh", "advait", "anand",
        "tarun", "sunny", "mani", "gokul", "vijay", "mohit", "rehan", "soham",
    ],
    "female": [
        "ritu", "priya", "neha", "pooja", "simran", "kavya", "ishita", "shreya",
        "roopa", "amelia", "sophia", "tanya", "shruti", "suhani", "kavitha", "rupali",
    ],
}

# Default Sarvam voice per gender (must be present in SARVAM_VOICES above)
SARVAM_DEFAULT_VOICE = {"male": "shubh", "female": "ritu"}

# Sarvam-supported language → BCP-47 code
SARVAM_LANG_CODES = {
    "hindi": "hi-IN", "bengali": "bn-IN", "tamil": "ta-IN", "telugu": "te-IN",
    "marathi": "mr-IN", "kannada": "kn-IN", "gujarati": "gu-IN", "malayalam": "ml-IN",
    "punjabi": "pa-IN", "odia": "od-IN", "english (india)": "en-IN",
}

# Languages that route to Sarvam AI when premium TTS is selected
INDIAN_LANGUAGES = {
    "hindi", "bengali", "tamil", "telugu", "marathi", "kannada",
    "gujarati", "malayalam", "punjabi", "odia", "english (india)",
}

# Global languages for which Google Cloud TTS currently offers NO voices.
# Premium requests for these degrade to Edge TTS to avoid synth failures.
# Source: scripts/generate_google_tts_samples.py --prune-catalog output (2026-04).
GOOGLE_UNSUPPORTED_LANGUAGES = {
    "bulgarian", "catalan", "czech", "dutch (belgium)", "finnish", "greek",
    "hungarian", "icelandic", "norwegian", "portuguese (portugal)",
    "romanian", "slovak",
}


# Whisper ISO-639-1 language codes for forced alignment
WHISPER_LANG_MAP = {
    # English
    "english": "en", "english (us)": "en", "english (uk)": "en",
    "english (india)": "en", "english (australia)": "en",
    # Indian
    "hindi": "hi", "bengali": "bn", "tamil": "ta", "telugu": "te",
    "marathi": "mr", "kannada": "kn", "gujarati": "gu", "malayalam": "ml",
    "punjabi": "pa", "odia": "or", "urdu": "ur",
    # European
    "spanish": "es", "spanish (us)": "es",
    "portuguese (brazil)": "pt", "portuguese (portugal)": "pt",
    "french": "fr", "french (canada)": "fr",
    "german": "de", "italian": "it",
    "dutch": "nl", "dutch (belgium)": "nl",
    "danish": "da", "finnish": "fi", "norwegian": "no", "swedish": "sv",
    "icelandic": "is", "polish": "pl", "russian": "ru", "ukrainian": "uk",
    "czech": "cs", "slovak": "sk", "hungarian": "hu", "romanian": "ro",
    "bulgarian": "bg", "greek": "el", "catalan": "ca",
    # Middle East / Africa
    "arabic": "ar", "hebrew": "he", "turkish": "tr", "afrikaans": "af",
    # Asian
    "japanese": "ja", "korean": "ko",
    "chinese": "zh", "chinese (taiwan)": "zh",
    "thai": "th", "vietnamese": "vi",
    "indonesian": "id", "malay": "ms", "filipino": "tl",
}

# Unicode script ranges for validating Whisper output matches expected language
_SCRIPT_RANGES: dict[str, tuple[int, int]] = {
    "hi": (0x0900, 0x097F),   # Devanagari (Hindi, Marathi)
    "mr": (0x0900, 0x097F),   # Devanagari
    "bn": (0x0980, 0x09FF),   # Bengali
    "ta": (0x0B80, 0x0BFF),   # Tamil
    "te": (0x0C00, 0x0C7F),   # Telugu
    "kn": (0x0C80, 0x0CFF),   # Kannada
    "gu": (0x0A80, 0x0AFF),   # Gujarati
    "pa": (0x0A00, 0x0A7F),   # Gurmukhi (Punjabi)
    "ml": (0x0D00, 0x0D7F),   # Malayalam
    "or": (0x0B00, 0x0B7F),   # Odia
    "ur": (0x0600, 0x06FF),   # Arabic (Urdu shares script)
    "ja": (0x3040, 0x30FF),   # Hiragana/Katakana
    "zh": (0x4E00, 0x9FFF),   # CJK Unified Ideographs
    "ko": (0xAC00, 0xD7AF),   # Hangul Syllables
    "th": (0x0E00, 0x0E7F),   # Thai
    "ar": (0x0600, 0x06FF),   # Arabic
    "he": (0x0590, 0x05FF),   # Hebrew
    "el": (0x0370, 0x03FF),   # Greek
    "ru": (0x0400, 0x04FF),   # Cyrillic
    "uk": (0x0400, 0x04FF),   # Cyrillic
    "bg": (0x0400, 0x04FF),   # Cyrillic
}


# ---------------------------------------------------------------------------
# Quality tier configuration
# ---------------------------------------------------------------------------
QUALITY_TIERS: dict[str, dict[str, Any]] = {
    "free": {
        "script_temperature": 0.5,
        "script_max_tokens": 16000,
        "html_temperature": 0.7,
        "html_max_tokens": 24000,
        "two_pass_script": False,
        "html_validation": False,
        "image_prompt_enhancement": False,
        "shot_diversity_enforcement": False,
        "segment_context": False,
        # Stock-only: no AI image generation; use CSS gradients + stock photos/videos
        "stock_preference": "stock_only",
        # Use cheap flash model for all LLM calls in this tier
        "preferred_script_model": "google/gemini-3-flash-preview",
        "preferred_shot_model": "google/gemini-3-flash-preview",
    },
    "standard": {
        "script_temperature": 0.5,
        "script_max_tokens": 16000,
        "html_temperature": 0.7,
        "html_max_tokens": 24000,
        "two_pass_script": False,
        "html_validation": True,
        "image_prompt_enhancement": False,
        "shot_diversity_enforcement": True,
        "segment_context": True,
        # Strongly prefer stock; fall back to AI only for abstract/conceptual content
        "stock_preference": "stock_first",
        "preferred_script_model": "google/gemini-3-flash-preview",
        "preferred_shot_model": "google/gemini-3-flash-preview",
        # Background music: standard does not run Director, so the music_plan is
        # synthesized from a generic cinematic-ambient default in run().
        "background_music_enabled": True,
        "background_music_default_volume": 0.18,
    },
    "premium": {
        "script_temperature": 0.6,
        "script_max_tokens": 24000,
        "html_temperature": 0.7,
        "html_max_tokens": 32000,
        "two_pass_script": True,
        "html_validation": True,
        "image_prompt_enhancement": True,
        "shot_diversity_enforcement": True,
        "segment_context": True,
        "use_director": True,
        "director_max_tokens": 14000,  # was 20000 — Director JSON plans don't need essay budgets
        "shot_pack_enabled": True,
        "shot_templates_enabled": True,
        "per_shot_max_tokens": 12000,  # was 16000 — measured outputs 8-12K; cap removed waste
        "crossfade_duration": 0.35,
        "transition_picker_enabled": True,
        "sound_enabled": True,
        "sound_max_cues_per_shot": 1,
        "sound_max_cues_per_video": 10,
        # Prefer stock; Director runs on main model, script+shots use flash
        "stock_preference": "stock_first",
        "preferred_script_model": "google/gemini-3-flash-preview",
        "preferred_shot_model": "google/gemini-3-flash-preview",
    },
    "ultra": {
        "script_temperature": 0.6,
        "script_max_tokens": 32000,
        "html_temperature": 0.7,
        "html_max_tokens": 32000,
        "two_pass_script": True,
        "html_validation": True,
        "image_prompt_enhancement": True,
        "shot_diversity_enforcement": True,
        "segment_context": True,
        "use_director": True,
        "director_max_tokens": 20000,  # was 32000
        "director_emphasis_map": True,
        "director_motion_bias": True,
        "director_shot_density": True,
        "motion_density_enforcement": True,
        # Track C — cheap-model-friendly quality bump.
        # `director_two_pass` decomposes "plan all shots" into Act Planner →
        # Shot Planner; cheap planners do measurably better on focused calls.
        # `director_few_shot` injects worked plan examples (one of which we
        # added explicitly for 4-min landscape educational pacing).
        # `shot_animation_validator` runs a regex pass on every generated
        # shot's HTML and triggers ONE corrective regen if density is too low
        # OR if a forbidden anti-pattern (vertical text, high-rotation type)
        # slipped past the system-prompt rule.
        "director_two_pass": True,
        "director_few_shot": True,
        "shot_animation_validator": True,
        "min_animated_elements": 4,  # ultra: looser than super_ultra's 6
        "shot_pack_enabled": True,
        "shot_templates_enabled": True,
        "skill_library_enabled": True,
        "image_continuity_enabled": True,
        "per_shot_max_tokens": 16000,  # was 24000 — measured outputs ~10-14K
        "crossfade_duration": 0.35,
        "transition_picker_enabled": True,
        "sound_enabled": True,
        "sound_max_cues_per_shot": 2,
        "sound_max_cues_per_video": 20,
        "background_music_enabled": True,
        "background_music_default_volume": 0.20,
        # Use stock where available; AI for hero/conceptual shots
        "stock_preference": "stock_first",
    },
    "super_ultra": {
        "script_temperature": 0.6,
        "script_max_tokens": 32000,
        "html_temperature": 0.82,
        "html_max_tokens": 32000,
        "two_pass_script": True,
        "html_validation": True,
        "image_prompt_enhancement": True,
        "shot_diversity_enforcement": True,
        "segment_context": True,
        "use_director": True,
        "director_max_tokens": 28000,  # was 40000 — still generous for two-pass + few-shot
        "director_emphasis_map": True,
        "director_two_pass": True,
        "director_few_shot": True,
        "director_shot_density": True,
        "shot_pack_enabled": True,
        "shot_templates_enabled": True,
        "shot_animation_validator": True,
        "stock_video_ranking": True,
        "skill_library_enabled": True,
        "image_continuity_enabled": True,
        "per_shot_max_tokens": 20000,  # was 32000 — densest HTML ~14-18K; 20K gives headroom
        "kinetic_text_shots": True,
        "crossfade_duration": 0.35,
        "transition_picker_enabled": True,
        "motion_density_enforcement": True,
        "director_motion_bias": True,
        "min_animated_elements": 6,
        "sound_enabled": True,
        "sound_max_cues_per_shot": 3,
        "sound_max_cues_per_video": 40,
        "background_music_enabled": True,
        "background_music_default_volume": 0.20,
        # Use stock where available; AI for motion-biased hero shots that need precise visuals
        "stock_preference": "stock_first",
    },
}


def _validate_whisper_script(word_entries: list, lang_code: str) -> bool:
    """Check if Whisper output contains characters in the expected script.

    For Latin-script languages (en, es, fr, de) always returns True.
    For non-Latin scripts, requires ≥30 % of letter characters to be in the
    expected Unicode range — otherwise Whisper hallucinated in the wrong language.
    """
    script_range = _SCRIPT_RANGES.get(lang_code)
    if script_range is None:
        return True  # Latin-script language — no validation needed

    lo, hi = script_range
    total_letters = 0
    matching_letters = 0
    for entry in word_entries:
        for ch in entry.get("word", ""):
            if ch.isalpha():
                total_letters += 1
                if lo <= ord(ch) <= hi:
                    matching_letters += 1

    if total_letters == 0:
        return False
    ratio = matching_letters / total_letters
    return ratio >= 0.30


# Module-level lock so concurrent video generations don't load multiple
# faster-whisper models in parallel — each instance peaks at ~1–2 GB RAM and
# loading two simultaneously is the most common cause of OOM kills.
_WHISPER_LOCK = threading.Lock()


def _whisper_align(audio_path: Path, language: str = "English") -> list:
    """Standalone Whisper forced alignment. Returns word-level timestamps.

    Works for any language supported by Whisper (Hindi, Bengali, etc.).
    Validates that Whisper output matches expected script; returns [] if not.
    """
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("    ⚠️ faster-whisper not installed. Run: pip install faster-whisper")
        return []

    lang_code = WHISPER_LANG_MAP.get(language.lower().strip(), "en")
    # Default sizes per language. Allow override via env so we can step down
    # without a code change if the host is memory-constrained.
    _default_size = "medium" if lang_code != "en" else "base"
    model_size = os.environ.get("WHISPER_MODEL_SIZE", _default_size)
    # Concurrency knobs — keep memory peaks predictable on shared hosts.
    # Default to 2 threads / 1 worker; override via env for beefier boxes.
    try:
        cpu_threads = int(os.environ.get("WHISPER_CPU_THREADS", "2"))
    except ValueError:
        cpu_threads = 2
    try:
        num_workers = int(os.environ.get("WHISPER_NUM_WORKERS", "1"))
    except ValueError:
        num_workers = 1

    model = None
    try:
        print(
            f"    🎯 Running Whisper forced alignment (lang={lang_code}, "
            f"model={model_size}, threads={cpu_threads}, workers={num_workers})..."
        )
        with _WHISPER_LOCK:
            model = WhisperModel(
                model_size,
                device="cpu",
                compute_type="int8",
                cpu_threads=cpu_threads,
                num_workers=num_workers,
            )
            segments, _ = model.transcribe(
                str(audio_path), word_timestamps=True, language=lang_code
            )
            word_entries = []
            for segment in segments:
                if segment.words:
                    for wi in segment.words:
                        word_entries.append({
                            "word": wi.word.strip(),
                            "start": round(wi.start, 3),
                            "end": round(wi.end, 3),
                        })

        if not word_entries:
            print("    ⚠️ Whisper returned no word timestamps")
            return []

        # Validate Whisper output is in the expected script
        if not _validate_whisper_script(word_entries, lang_code):
            print(f"    ⚠️ Whisper output is NOT in expected script for '{language}' "
                  f"(lang={lang_code}). Discarding Whisper results.")
            return []

        print(f"    ✅ Whisper alignment extracted {len(word_entries)} word timestamps")
        return word_entries
    except Exception as e:
        print(f"    ❌ Whisper alignment failed: {e}")
        return []
    finally:
        # Drop the model + decoded segments before returning. faster-whisper
        # holds onto CTranslate2 buffers via the model handle, so explicit
        # del + gc.collect() is what actually returns memory to the OS on
        # CPython between back-to-back generation requests.
        if model is not None:
            del model
        try:
            import gc
            gc.collect()
        except Exception:
            pass


class _ImageGenRateLimitError(Exception):
    """Raised by _call_image_generation_llm on HTTP 429 so the executor thread
    is freed immediately and the sleep/requeue happens in the main thread."""
    def __init__(self, retry_after: float = 15.0):
        self.retry_after = retry_after
        super().__init__(f"Image gen rate limited (retry after {retry_after:.0f}s)")


def retry_with_backoff(max_retries=3, initial_delay=2.0, backoff_factor=2.0, exceptions=(Exception,)):
    """
    Simple retry decorator with exponential backoff.
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            delay = initial_delay
            last_exception = None
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    # Don't retry on user interruption
                    if isinstance(e, KeyboardInterrupt):
                        raise e
                    
                    if attempt == max_retries:
                        break
                    
                    print(f"⚠️  Op failed (attempt {attempt + 1}/{max_retries}): {e}. Retrying in {delay:.1f}s...")
                    time.sleep(delay)
                    delay *= backoff_factor
            
            print(f"❌ Op failed after {max_retries} attempts.")
            raise last_exception
        return wrapper
    return decorator


def _extract_json_blob(raw: str) -> Any:
    """
    Try to recover a JSON object from a model response.
    Accepts fenced code blocks, plain JSON, or JSON mixed with text.
    Handles common JSON errors gracefully.
    """
    text = raw.strip()
    
    # 1. Try stripping code fences first
    fence_match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
    if fence_match:
        try:
            return json.loads(fence_match.group(1))
        except json.JSONDecodeError:
            pass

    # 2. Try parsing the whole text
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 3. Find the outermost JSON object by matching balanced braces.
    # LLMs sometimes prepend <style> or text. We find `{` and matching `}`.
    # We will search for EVERY candidate and try them all.
    candidates = []
    
    start_idx = text.find('{')
    while start_idx != -1:
        stack = 0
        end_idx = -1
        in_string = False
        escape = False
        
        for i in range(start_idx, len(text)):
            char = text[i]
            
            if in_string:
                if char == '\\':
                    escape = not escape
                elif char == '"' and not escape:
                    in_string = False
                else:
                    escape = False
            else:
                if char == '"':
                    in_string = True
                elif char == '{':
                    stack += 1
                elif char == '}':
                    stack -= 1
                    if stack == 0:
                        end_idx = i
                        break
        
        if end_idx != -1:
            candidate = text[start_idx : end_idx + 1]
            try:
                data = json.loads(candidate)
                # If it's a valid dict or list, return it immediately!
                if isinstance(data, (dict, list)):
                    return data
            except json.JSONDecodeError:
                pass
                
        # Move on to the next potential '{' character if this one didn't work out
        start_idx = text.find('{', start_idx + 1)
                
    raise ValueError(f"Could not parse JSON from response. Raw output:\n{raw}")


class OpenRouterClient:
    def __init__(
        self,
        api_key: str,
        default_model: str,
        referer: str = "https://stilllift-automation.local",
        title: str = "StillLift Automation",
        use_prompt_cache: bool = True,
    ) -> None:
        self.api_key = api_key
        self.default_model = default_model
        self.use_prompt_cache = use_prompt_cache
        # Tracks the model used in the last successful chat() call (for cost reporting)
        self.current_model: str = default_model

        self.model_chain = self._fetch_models()
        self.base_url = "https://openrouter.ai/api/v1/chat/completions"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": referer,
            "X-Title": title,
        }

    def _fetch_models(self) -> list[str]:
        models = []
        try:
            api_base = os.environ.get("AI_SERVICE_BASE_URL", "http://localhost:8077/ai-service")
            url = f"{api_base}/models/v2/use-case/video"
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=5) as res:
                if res.status == 200:
                    data = json.loads(res.read().decode("utf-8"))
                    for m in data.get("recommended_models", []):
                        if m.get("model_id"):
                            models.append(m["model_id"])
                    if not models and data.get("free_tier_model", {}).get("model_id"):
                        models.append(data["free_tier_model"]["model_id"])
        except Exception as e:
            print(f"Warning: Failed to fetch dynamic models from registry: {e}")
        return models

    @retry_with_backoff(max_retries=4, initial_delay=2.0, exceptions=(urllib.error.URLError, RuntimeError))
    def chat(
        self,
        messages: Sequence[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.6,
        max_tokens: int = 2000,
        response_format: Optional[Dict[str, Any]] = None,
    ) -> Tuple[str, Dict[str, Any]]:
        # Use provided model or fall back to chain/default
        if model:
            models_to_try = [model]
        elif self.model_chain:
            models_to_try = self.model_chain
        else:
            models_to_try = [self.default_model]

        # Apply prompt caching: wrap system message content in cache_control array
        if self.use_prompt_cache:
            cached_messages: list = []
            for msg in messages:
                if msg.get("role") == "system" and isinstance(msg.get("content"), str):
                    msg = {
                        "role": "system",
                        "content": [
                            {"type": "text", "text": msg["content"],
                             "cache_control": {"type": "ephemeral"}}
                        ],
                    }
                cached_messages.append(msg)
        else:
            cached_messages = list(messages)

        last_error = None
        for model_to_use in models_to_try:
            try:
                payload: Dict[str, Any] = {
                    "model": model_to_use,
                    "messages": cached_messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                }
                if response_format is not None:
                    payload["response_format"] = response_format
                request = urllib.request.Request(
                    self.base_url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers=self.headers,
                    method="POST",
                )
                with urllib.request.urlopen(request, timeout=120) as response:
                    raw = response.read().decode("utf-8")
                    # Parse JSON response and return content
                    data = json.loads(raw)
                    content = data["choices"][0]["message"]["content"]

                    if not content or not content.strip():
                        raise ValueError("Model returned an empty string.")

                    usage = data.get("usage", {})
                    # Expose cache hit metrics when available (OpenRouter passes these through)
                    cache_read = usage.get("cache_read_input_tokens", 0)
                    cache_write = usage.get("cache_creation_input_tokens", 0)
                    if cache_read or cache_write:
                        usage["cache_read_input_tokens"] = cache_read
                        usage["cache_creation_input_tokens"] = cache_write
                    self.current_model = model_to_use
                    return content, usage
            except Exception as exc:
                if isinstance(exc, urllib.error.HTTPError):
                    detail = exc.read().decode("utf-8", errors="ignore")
                    last_error = RuntimeError(f"OpenRouter request failed with {model_to_use}: {exc.code} {exc.reason}\n{detail}")
                else:
                    last_error = RuntimeError(f"OpenRouter request error with {model_to_use}: {str(exc)}")
                    
                # If this is not the last model, continue to next
                if model_to_use != models_to_try[-1]:
                    print(f"⚠️ Model {model_to_use} failed. Trying next model...")
                    continue
                # Last model failed, raise the error
                raise last_error from exc
        
        # Should never reach here, but just in case
        if last_error:
            raise last_error
        raise RuntimeError("No models available to try")


class GoogleCloudTTSClient:
    def __init__(self, credentials_path: Optional[str] = None, credentials_json: Optional[str] = None):
        self.credentials_path = credentials_path
        self.credentials_json = credentials_json

    @retry_with_backoff(max_retries=3, initial_delay=1.0)
    def synthesize(
        self, 
        text: str, 
        output_path: Path, 
        raw_json_path: Path,
        voice_name: str = "en-US-Journey-F",
        language_code: str = "en-US"
    ) -> None:
        try:
            from google.cloud import texttospeech_v1beta1 as texttospeech
            from google.oauth2 import service_account
        except ImportError:
            raise RuntimeError("google-cloud-texttospeech not installed. Run `pip install google-cloud-texttospeech`.")

        if self.credentials_json:
            print(f"🔑 Using Service Account from Environment Variable")
            try:
                # Sanitize: Remove wrapping quotes if they were injected by shell/k8s
                clean_json = self.credentials_json.strip()
                if clean_json.startswith("'") and clean_json.endswith("'"):
                    clean_json = clean_json[1:-1]
                elif clean_json.startswith('"') and clean_json.endswith('"'):
                    clean_json = clean_json[1:-1]
                
                info = json.loads(clean_json)
                
                # Fix private_key formatting issues (missing newlines)
                if "private_key" in info:
                    pk = info["private_key"]
                    updated = False
                    
                    if "\\n" in pk:
                        pk = pk.replace("\\n", "\n")
                        updated = True
                    
                    # Ensure header is followed by a newline
                    header = "-----BEGIN PRIVATE KEY-----"
                    if header in pk and not pk.startswith(header + "\n"):
                        pk = pk.replace(header, header + "\n")
                        updated = True
                        
                    # Ensure footer is preceded by a newline
                    footer = "-----END PRIVATE KEY-----"
                    if footer in pk and not pk.endswith("\n" + footer) and not pk.endswith("\n" + footer + "\n"):
                        pk = pk.replace(footer, "\n" + footer)
                        updated = True
                    
                    if updated:
                        print("    🔧 Fixing private_key formatting/newlines...")
                        # Remove any double newlines we might have introduced
                        info["private_key"] = pk.replace("\n\n", "\n")
                
                credentials = service_account.Credentials.from_service_account_info(info)
            except json.JSONDecodeError as e:
                print(f"❌ JSON Decode Error. Content preview: {self.credentials_json[:50]}...")
                raise e
        elif self.credentials_path:
            print(f"🔑 Using Service Account: {self.credentials_path}")
            credentials = service_account.Credentials.from_service_account_file(self.credentials_path)
        else:
            raise RuntimeError("No Google Cloud credentials provided (path or json content).")

        client = texttospeech.TextToSpeechClient(credentials=credentials)

        voice = texttospeech.VoiceSelectionParams(
            language_code=language_code,
            name=voice_name
        )
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3
        )

        # Voices that do NOT support SSML <mark> tags / timepoints
        # Journey, Studio, and Polyglot voices return 400 with SSML marks
        unsupported_mark_prefixes = ("Journey", "Studio", "Polyglot")
        voice_short = voice_name.split("-")[-1] if voice_name else ""
        supports_marks = not any(voice_short.startswith(p) for p in unsupported_mark_prefixes)

        # ── Split text into chunks if it exceeds the 5000-byte API limit ──
        # For SSML, each word gets ~20 bytes of markup overhead, so use a
        # lower limit; for plain text the raw byte limit applies.
        ssml_max = self._MAX_TTS_BYTES  # ~4500 (leaves room for <speak> tags + marks)
        plain_max = 4800  # closer to 5000 for plain text
        chunks = self._split_text_into_chunks(text, max_bytes=ssml_max if supports_marks else plain_max)

        if len(chunks) > 1:
            print(f"    📄 Text is {len(text.encode('utf-8'))} bytes — split into {len(chunks)} chunks")

        all_audio_bytes = b""
        all_word_entries: list[dict] = []
        cumulative_offset = 0.0  # seconds offset for timestamp merging

        for chunk_idx, chunk_text in enumerate(chunks):
            response = None
            word_list = []

            if supports_marks:
                ssml_input, word_list = self._create_ssml_with_marks(chunk_text)
                # Verify SSML doesn't exceed the byte limit
                if len(ssml_input.encode("utf-8")) <= 5000:
                    input_text = texttospeech.SynthesisInput(ssml=ssml_input)
                    try:
                        request = texttospeech.SynthesizeSpeechRequest(
                            input=input_text,
                            voice=voice,
                            audio_config=audio_config,
                            enable_time_pointing=[
                                texttospeech.SynthesizeSpeechRequest.TimepointType.SSML_MARK
                            ]
                        )
                        response = client.synthesize_speech(request=request)
                    except Exception as tp_error:
                        print(f"    ⚠️ Timepoint request failed ({tp_error}), falling back to simple synthesis")
                        response = None

            if response is None:
                simple_input = texttospeech.SynthesisInput(text=chunk_text)
                response = client.synthesize_speech(
                    input=simple_input,
                    voice=voice,
                    audio_config=audio_config
                )

            # Accumulate audio bytes (MP3 is concatenatable)
            chunk_audio = response.audio_content
            all_audio_bytes += chunk_audio

            # Process timepoints for this chunk
            chunk_word_entries = []
            if hasattr(response, 'timepoints') and response.timepoints:
                chunk_word_entries = self._process_timepoints(response, word_list)

            # Get this chunk's audio duration (needed for offset and per-chunk fallback)
            chunk_duration = self._get_mp3_duration(chunk_audio) if len(chunks) > 1 else 0.0

            # Per-chunk Whisper fallback: if this chunk got no timestamps,
            # try Whisper on just this chunk's audio so we don't lose data
            if not chunk_word_entries and len(chunks) > 1:
                print(f"    ⚠️ Chunk {chunk_idx + 1}/{len(chunks)} has no timepoints — trying Whisper...")
                import tempfile as _tmpmod
                _tmp = _tmpmod.NamedTemporaryFile(suffix=".mp3", delete=False)
                _tmp.write(chunk_audio)
                _tmp.close()
                try:
                    chunk_word_entries = _whisper_align(Path(_tmp.name))
                finally:
                    os.unlink(_tmp.name)

            # Offset timestamps by cumulative duration of previous chunks
            for entry in chunk_word_entries:
                entry["start"] = round(entry["start"] + cumulative_offset, 3)
                entry["end"] = round(entry["end"] + cumulative_offset, 3)
            all_word_entries.extend(chunk_word_entries)

            if len(chunks) > 1:
                cumulative_offset += chunk_duration

        # Save concatenated audio
        output_path.write_bytes(all_audio_bytes)

        if all_word_entries:
            print(f"    ✅ Got {len(all_word_entries)} word timestamps from Google TTS Timepoints")
            raw_json_path.write_text(json.dumps(all_word_entries, indent=2))
        else:
            # Fallback to Whisper alignment if no timepoints returned
            print(f"    ⚠️ No timepoints returned, using Whisper alignment fallback")
            self._generate_timestamps_with_fallback(output_path, text, raw_json_path)

    # Maximum bytes for a single Google TTS request (API limit is 5000; leave headroom)
    _MAX_TTS_BYTES = 4500

    def _split_text_into_chunks(self, text: str, max_bytes: int | None = None) -> list[str]:
        """Split text into chunks that fit within the Google TTS byte limit.

        Splits on sentence boundaries (. ! ?) first, then on commas/semicolons,
        and finally mid-sentence if a single sentence is still too long.
        """
        max_bytes = max_bytes or self._MAX_TTS_BYTES

        # If already under limit, return as-is
        if len(text.encode("utf-8")) <= max_bytes:
            return [text]

        import re
        # Split into sentences (keep the delimiter attached)
        sentences = re.split(r'(?<=[.!?])\s+', text)

        chunks: list[str] = []
        current_chunk = ""

        for sentence in sentences:
            candidate = (current_chunk + " " + sentence).strip() if current_chunk else sentence
            if len(candidate.encode("utf-8")) <= max_bytes:
                current_chunk = candidate
            else:
                # Current chunk is full — save it if non-empty
                if current_chunk:
                    chunks.append(current_chunk)

                # If this single sentence itself exceeds the limit, split further
                if len(sentence.encode("utf-8")) > max_bytes:
                    # Try splitting on commas / semicolons
                    sub_parts = re.split(r'(?<=[,;])\s+', sentence)
                    sub_chunk = ""
                    for part in sub_parts:
                        sub_candidate = (sub_chunk + " " + part).strip() if sub_chunk else part
                        if len(sub_candidate.encode("utf-8")) <= max_bytes:
                            sub_chunk = sub_candidate
                        else:
                            if sub_chunk:
                                chunks.append(sub_chunk)
                            # Last resort: split by words
                            if len(part.encode("utf-8")) > max_bytes:
                                words = part.split()
                                word_chunk = ""
                                for w in words:
                                    wc = (word_chunk + " " + w).strip() if word_chunk else w
                                    if len(wc.encode("utf-8")) <= max_bytes:
                                        word_chunk = wc
                                    else:
                                        if word_chunk:
                                            chunks.append(word_chunk)
                                        word_chunk = w
                                if word_chunk:
                                    sub_chunk = word_chunk
                            else:
                                sub_chunk = part
                    if sub_chunk:
                        current_chunk = sub_chunk
                    else:
                        current_chunk = ""
                else:
                    current_chunk = sentence

        if current_chunk:
            chunks.append(current_chunk)

        return chunks

    @staticmethod
    def _get_mp3_duration(audio_bytes: bytes) -> float:
        """Get duration of MP3 audio in seconds using ffprobe."""
        import tempfile
        tmp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
        try:
            tmp.write(audio_bytes)
            tmp.flush()
            result = subprocess.run(
                ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                 "-of", "default=noprint_wrappers=1:nokey=1", tmp.name],
                capture_output=True, text=True, timeout=10
            )
            return float(result.stdout.strip())
        except Exception:
            # Rough fallback: ~16 kB/s for 128kbps MP3
            return len(audio_bytes) / 16000.0
        finally:
            tmp.close()
            os.unlink(tmp.name)

    def _create_ssml_with_marks(self, text: str) -> tuple:
        """Create SSML with <mark> tags for each word to track timing."""
        import re
        
        # Split text into words while preserving punctuation
        words = re.findall(r'\S+', text)
        word_list = []
        
        ssml_parts = ['<speak>']
        for i, word in enumerate(words):
            mark_name = f"w{i}"
            word_list.append({"index": i, "word": word, "mark": mark_name})
            ssml_parts.append(f'<mark name="{mark_name}"/>{word} ')
        ssml_parts.append('</speak>')
        
        ssml = ''.join(ssml_parts)
        return ssml, word_list

    def _process_timepoints(self, response, word_list: list) -> list:
        """Process Google TTS timepoints to create word timestamp entries."""
        word_entries = []
        
        # Create a mapping from mark name to time
        mark_times = {}
        for tp in response.timepoints:
            mark_times[tp.mark_name] = tp.time_seconds
        
        if not mark_times:
            return []
        
        # Build word entries with start/end times
        for i, word_info in enumerate(word_list):
            mark = word_info["mark"]
            word = word_info["word"]
            
            if mark not in mark_times:
                continue
                
            start_time = mark_times[mark]
            
            # End time is the start of the next word, or estimated duration
            if i + 1 < len(word_list):
                next_mark = word_list[i + 1]["mark"]
                if next_mark in mark_times:
                    end_time = mark_times[next_mark]
                else:
                    # Estimate: 0.06s per character
                    end_time = start_time + len(word) * 0.06
            else:
                # Last word: estimate duration
                end_time = start_time + len(word) * 0.06 + 0.3  # Add 0.3s pause at end
            
            word_entries.append({
                "word": word,
                "start": round(start_time, 3),
                "end": round(end_time, 3)
            })
        
        return word_entries

    def _align_with_whisper(self, audio_path: Path, text: str, language: str = "English") -> list:
        """Use Whisper for forced alignment to get accurate word timestamps from audio."""
        return _whisper_align(audio_path, language)

    def _generate_timestamps_with_fallback(self, audio_path: Path, text: str, raw_json_path: Path) -> None:
        """Generate word timestamps using Whisper alignment, with linear fallback."""
        
        # Try Whisper alignment first
        word_entries = self._align_with_whisper(audio_path, text)
        
        if word_entries:
            raw_json_path.write_text(json.dumps(word_entries, indent=2))
            return
        
        # Fallback to linear interpolation
        print("    ⚠️ Using linear interpolation fallback (less accurate)")
        self._generate_mock_timestamps(text, raw_json_path)

    def _generate_mock_timestamps(self, text: str, raw_json_path: Path) -> None:
        """Last resort fallback: Linear interpolation for timestamps (approx 16 chars/sec)."""
        import re
        
        words = re.findall(r'\S+', text)
        word_entries = []
        t = 0.0
        
        for word in words:
            # Estimate ~0.06s per character + small gap between words
            duration = len(word) * 0.06 + 0.1
            word_entries.append({
                "word": word,
                "start": round(t, 3),
                "end": round(t + duration, 3)
            })
            t += duration
        
        raw_json_path.write_text(json.dumps(word_entries, indent=2))


class VideoGenerationPipeline:
    STAGE_ORDER = ("script", "tts", "words", "html", "avatar", "render")
    STAGE_INDEX = {name: idx for idx, name in enumerate(STAGE_ORDER)}

    def __init__(
        self,
        openrouter_key: str,
        script_model: str = "xiaomi/mimo-v2-flash:free",  # Free tier model for script generation
        html_model: str = "xiaomi/mimo-v2-flash:free",  # Free tier model for HTML generation
        voice_id: str = "Qggl4b0xRMiqOwhPtVWT",
        voice_model: str = "eleven_multilingual_v2",
        pexels_api_keys: str = DEFAULT_PEXELS_API_KEYS,
        pixabay_api_keys: str = DEFAULT_PIXABAY_API_KEYS,
        runs_dir: Path = DEFAULT_RUNS_DIR,
        quality_tier: str = "ultra",
    ) -> None:
        if not openrouter_key:
            raise ValueError("OpenRouter API key is required (set OPENROUTER_API_KEY or pass --openrouter-key).")
        self.script_client = OpenRouterClient(openrouter_key, script_model)
        self.html_client = OpenRouterClient(openrouter_key, html_model)
        self.voice_id = voice_id
        self.voice_model = voice_model
        self.runs_dir = runs_dir
        self.runs_dir.mkdir(parents=True, exist_ok=True)
        # Quality tier configuration
        self._quality_tier = quality_tier if quality_tier in QUALITY_TIERS else "ultra"
        self._tier_config = QUALITY_TIERS[self._quality_tier]
        print(f"⚡ Quality tier: {self._quality_tier}")

        # Pexels stock photo/video service (optional — graceful if not configured)
        self._pexels_service = None
        if pexels_api_keys:
            try:
                from pexels_service import PexelsService
                self._pexels_service = PexelsService(pexels_api_keys)
                print(f"📷 Pexels: {len(self._pexels_service._keys)} API key(s) configured")
            except ImportError:
                print("⚠️ pexels_service.py not found — Pexels disabled")

        # Pixabay stock photo/video service (optional — graceful if not configured)
        self._pixabay_service = None
        if pixabay_api_keys:
            try:
                from pixabay_service import PixabayService
                self._pixabay_service = PixabayService(pixabay_api_keys)
                print(f"🖼️ Pixabay: {len(self._pixabay_service._keys)} API key(s) configured")
            except ImportError:
                print("⚠️ pixabay_service.py not found — Pixabay disabled")

    # Keywords that hint the asset is illustration-y / educational — route
    # Pixabay first when no explicit provider hint is given.
    _PIXABAY_FIRST_KEYWORDS = (
        "diagram", "illustration", "illustrated", "cartoon", "vector",
        "icon", "educational", "anatomy", "history", "infographic",
        "schematic", "clipart", "hand-drawn", "flat design",
    )

    def _resolve_stock_provider_chain(self, provider_hint: str, query: str) -> List[Any]:
        """Return an ordered list of available stock services to try.

        `provider_hint` is the value of `data-stock-provider` from the HTML (may be
        "pexels", "pixabay", "auto", or "" for unset). Providers that aren't
        configured are filtered out. The second provider is always the fallback.
        """
        hint = (provider_hint or "").strip().lower()
        services: List[Any] = []

        pexels = self._pexels_service if (self._pexels_service and self._pexels_service.is_available) else None
        pixabay = self._pixabay_service if (self._pixabay_service and self._pixabay_service.is_available) else None

        if hint == "pexels":
            ordered = [pexels, pixabay]
        elif hint == "pixabay":
            ordered = [pixabay, pexels]
        else:
            q_lower = (query or "").lower()
            pixabay_first = any(kw in q_lower for kw in self._PIXABAY_FIRST_KEYWORDS)
            ordered = [pixabay, pexels] if pixabay_first else [pexels, pixabay]

        for svc in ordered:
            if svc is not None and svc not in services:
                services.append(svc)
        return services

    @staticmethod
    def _get_default_branding() -> Dict[str, Any]:
        """Return default Vacademy branding configuration."""
        return {
            "intro": {
                "enabled": True,
                "duration_seconds": 3.0,
                "html": "<div style='display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; background:linear-gradient(160deg, #ffffff 0%, #f8f8fa 50%, #ffffff 100%);'><h1 style='color:#1a1a1a; font-size:64px; font-family:Inter,sans-serif; font-weight:300; letter-spacing:6px; margin:0; text-transform:uppercase;'>Vacademy</h1><div style='width:48px; height:1px; background:rgba(0,0,0,0.12); margin:20px 0;'></div><p style='color:rgba(0,0,0,0.35); font-size:16px; font-family:Inter,sans-serif; font-weight:400; letter-spacing:3px; text-transform:uppercase;'>Learn Smarter</p></div>"
            },
            "outro": {
                "enabled": True,
                "duration_seconds": 4.0,
                "html": "<div style='display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; background:#ffffff;'><p style='color:rgba(0,0,0,0.4); font-size:15px; font-family:Inter,sans-serif; font-weight:400; letter-spacing:4px; text-transform:uppercase; margin:0 0 24px 0;'>Thank you for watching</p><div style='width:32px; height:1px; background:rgba(0,0,0,0.1); margin:0 0 24px 0;'></div><p style='color:rgba(0,0,0,0.2); font-size:13px; font-family:Inter,sans-serif; font-weight:300; letter-spacing:2px;'>Powered by Vacademy</p></div>"
            },
            "watermark": {
                "enabled": True,
                "position": "top-right",
                "max_width": 200,
                "max_height": 80,
                "margin": 40,
                "opacity": 0.5,
                "html": "<div style='font-family:Inter,sans-serif; font-weight:300; color:rgba(0,0,0,0.2); font-size:14px; letter-spacing:2px; text-align:right;'>vacademy</div>"
            }
        }

    # ── Pacing profiles (The Video Pacing Map) ──────────────────────────
    # Reels:     Frenetic, high cut frequency, 2-4s per shot
    # Marketing: Rhythmic, moderate cuts, 4-6s per shot, builds to climax
    # Education: Deliberate, low cuts, 6-10s per shot, room to breathe
    PACING_PROFILES = {
        "reels": {
            "seconds_per_shot": 3,
            "min_shots": 3,
            "max_shots": 8,      # was 12 — tightened to control free/standard segment call count
            "min_shot_duration": 2.0,
            "max_shot_duration": 5.0,
        },
        "marketing": {
            "seconds_per_shot": 5,
            "min_shots": 2,
            "max_shots": 7,      # was 9
            "min_shot_duration": 3.0,
            "max_shot_duration": 12.0,
        },
        "education": {
            "seconds_per_shot": 8,
            "min_shots": 2,
            "max_shots": 5,      # was 7
            "min_shot_duration": 4.0,
            "max_shot_duration": 20.0,
        },
    }

    @staticmethod
    def _derive_pacing_style(target_duration: str, content_type: str) -> str:
        """Derive pacing style from target_duration string and content_type.

        Returns 'reels', 'marketing', or 'education'.
        """
        # Non-video content types are always education-paced
        if content_type != "VIDEO":
            return "education"

        # Parse target_duration (e.g. "2-3 minutes", "30 seconds", "1 minute")
        import re
        dur_lower = target_duration.lower().strip()
        # Extract numbers
        nums = [float(n) for n in re.findall(r"[\d.]+", dur_lower)]
        if not nums:
            return "education"  # default

        # Convert to seconds
        if "second" in dur_lower:
            avg_seconds = sum(nums) / len(nums)
        else:  # minutes (default)
            avg_seconds = (sum(nums) / len(nums)) * 60

        # Short (< 60s) → reels, Medium (60-180s) → marketing, Long (> 180s) → education
        if avg_seconds <= 60:
            return "reels"
        elif avg_seconds <= 180:
            return "marketing"
        else:
            return "education"

    def _build_default_music_plan(self, audio_duration: float) -> Optional[Dict[str, Any]]:
        """Synthesize a generic cinematic-ambient music plan for tiers that don't
        run the Director (free / standard). Emits the new `chunks[]` shape with
        Lyria-style timestamped prompts, tiled under the per-call ~180 s cap.
        Returns None if duration is unusable.
        """
        if audio_duration <= 1.0:
            return None
        chunk_max = 180.0
        chunks: list[Dict[str, Any]] = []
        cursor = 0.0
        chunk_idx = 0
        while cursor < audio_duration - 1.0:
            chunk_end = min(cursor + chunk_max, audio_duration)
            chunk_dur = chunk_end - cursor
            mid = chunk_dur / 2
            late = max(0.0, chunk_dur - 20.0)
            timestamped_prompt = (
                f"[00:00] {'Begin with a soft warm cinematic instrumental — gentle solo piano melody, contemplative and curious mood, sparse arrangement, no vocals, no lyrics.' if chunk_idx == 0 else 'Continue from previous section — soft warm piano and string pads sustain, instrumental, no vocals, no lyrics.'} "
                f"[{int(mid)//60:02d}:{int(mid)%60:02d}] Slow warm string pads layer underneath, adding depth and a sense of attentive focus, gentle pulse around 72 bpm. "
                f"[{int(late)//60:02d}:{int(late)%60:02d}] Subtle resolution — strings soften, piano returns to a gentle reflective melody, no vocals throughout."
            )
            chunks.append({
                "start_time": round(cursor, 2),
                "end_time": round(chunk_end, 2),
                "timestamped_prompt": timestamped_prompt,
            })
            cursor = chunk_end
            chunk_idx += 1
        if not chunks:
            return None
        return {
            "overall_mood": "calm, attentive, lightly uplifting",
            "overall_genre": "cinematic ambient + soft piano",
            "chunks": chunks,
        }

    def _is_background_music_enabled(self) -> bool:
        """Resolve the final on/off state for Lyria background music.

        Request override (True/False) always wins. When None, falls back to
        the tier config. Only ultra / super_ultra set the flag, so lower tiers
        stay off by default unless a client explicitly forces True (in which
        case we still honor it — the tier only controls the DEFAULT).
        """
        override = getattr(self, "_background_music_enabled_override", None)
        if override is not None:
            return bool(override)
        return bool(self._tier_config.get("background_music_enabled", False))

    def run(
        self,
        base_prompt: Optional[str],
        run_name: Optional[str] = None,
        resume_run: Optional[str] = None,
        start_from: str = "script",
        stop_at: Optional[str] = None,
        language: str = "English",
        show_captions: bool = True,
        html_quality: str = "advanced",
        background_type: str = "white",
        target_audience: str = "General/Adult",
        target_duration: str = "2-3 minutes",
        voice_gender: str = "female",
        tts_provider: str = "standard",
        voice_id: Optional[str] = None,
        branding_config: Optional[Dict[str, Any]] = None,
        style_config: Optional[Dict[str, Any]] = None,
        content_type: str = "VIDEO",
        generate_avatar: bool = False,
        avatar_image_url: Optional[str] = None,
        max_segments: int = 8,
        reference_context: Optional[Dict[str, Any]] = None,
        video_width: int = 1920,
        video_height: int = 1080,
        visual_style: str = "standard",  # deprecated: Director now picks styles per-shot
        sound_effects_enabled: bool = True,
        input_video_context: Optional[Dict[str, Any]] = None,
        input_video_contexts: Optional[list] = None,
        mute_tts_on_source_clips: bool = False,
        background_music_enabled: Optional[bool] = None,
        background_music_volume: Optional[float] = None,
        sub_shots_enabled: bool = False,
        routing_plan: Optional[Dict[str, Any]] = None,
        video_type_plan: Optional[Dict[str, Any]] = None,
        host_plan: Optional[Dict[str, Any]] = None,
        progress_callback: Optional[Any] = None,
    ) -> Dict[str, Any]:
        # Store video dimensions (landscape 1920x1080 or portrait 1080x1920)
        self.video_width = video_width
        self.video_height = video_height
        self.aspect_label = "9:16 portrait" if video_width < video_height else "16:9 landscape"
        # visual_style is accepted for API back-compat but no longer gates behavior —
        # the Director now decides theme / background / animation per shot.
        del visual_style
        # Sound-effects kill switch. When False, the Sound Planner is bypassed
        # regardless of tier config. Stored on the instance so _generate_html_per_shot
        # can read it alongside self._tier_config.
        self._sound_effects_enabled = bool(sound_effects_enabled)
        # Input video contexts from indexed source videos. List of dicts, each
        # with keys: context, source_url, assets_urls, input_video_id, mode, etc.
        # Backward compat: singular input_video_context is wrapped into a list.
        if input_video_contexts:
            self._input_video_contexts = input_video_contexts
        elif input_video_context:
            self._input_video_contexts = [input_video_context]
        else:
            self._input_video_contexts = None
        # Convenience: first context for backward-compat code paths
        self._input_video_context = (
            self._input_video_contexts[0] if self._input_video_contexts else None
        )
        # If True, audio mixing replaces TTS with source audio during SOURCE_CLIP
        # shots. Default False: TTS plays continuously (marketing/explainer mode).
        self._mute_tts_on_source_clips = bool(mute_tts_on_source_clips)
        # Routing plan (from IntentRouterService) — drives:
        # • script LLM enrichment (narration_fit_to_source)
        # • Director system prompt (source_clip_priority)
        # • SOURCE_CLIP card layout (infographic_mode)
        # • coverage warning (coverage_min_pct)
        # When None: pipeline behaves as before (medium priority, side mode, no fit, no coverage check).
        self._routing_plan: Dict[str, Any] = routing_plan or {}
        _rcfg = (self._routing_plan.get("config") or {}) if isinstance(self._routing_plan, dict) else {}
        self._routing_config: Dict[str, Any] = {
            "mute_tts_on_source_clips": bool(_rcfg.get("mute_tts_on_source_clips", False)),
            "source_clip_priority": str(_rcfg.get("source_clip_priority", "medium")),
            "infographic_mode": str(_rcfg.get("infographic_mode", "side")),
            "narration_fit_to_source": bool(_rcfg.get("narration_fit_to_source", False)),
            "coverage_min_pct": int(_rcfg.get("coverage_min_pct", 0) or 0),
        }
        # Background music (Lyria) knobs — threaded through from the request.
        # None for enabled = "use tier default"; explicit True/False overrides.
        # Volume is only used when a track is actually generated.
        self._background_music_enabled_override: Optional[bool] = background_music_enabled
        self._background_music_volume_override: Optional[float] = background_music_volume
        # Experimental: split dense shots into 2 focused sub-shots before HTML gen.
        self._sub_shots_enabled: bool = bool(sub_shots_enabled)
        if self._sub_shots_enabled:
            print("✂️  Sub-shot decomposition ENABLED (experimental)")
        # Populated by the music stage once segments are generated + merged.
        # Read by _write_timeline to insert a "Background Music" entry into
        # meta.audio_tracks so the player + renderer see it automatically.
        self._background_music_track: Optional[Dict[str, Any]] = None
        # Caller-provided callback for real-time progress events (SSE bridge).
        # Called as progress_callback(event_dict) from any pipeline thread.
        # Must be thread-safe (the caller is responsible for queue/lock).
        self._progress_callback = progress_callback
        # Thread-safe running token totals — updated by each shot thread so every
        # shot_done event carries an up-to-date cumulative snapshot.
        import threading as _threading_mod
        self._token_lock = _threading_mod.Lock()
        self._cumulative_tokens: dict = {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        }
        # True when user's input prompt contained a complete script (NARRATOR lines,
        # scene markers, timing). Used to switch Director to narrative-first mode.
        self._user_had_script: bool = False
        # Dedup set for LLM-ranked stock video selection (super_ultra only).
        # Tracks Pexels video IDs already used in this run so shots don't reuse clips.
        self._used_pexels_video_ids: set = set()
        # Store max_segments for use in concept-aligned segmentation
        self._max_segments = max_segments

        # Video type plan (from VideoTypeClassifierService) — drives:
        # • pacing style override (cadence_hint wins over duration heuristic)
        # • script narration tone (downstream prompt sites read self._video_type)
        # • Director cadence label (long-form vs reel)
        # When None: pipeline falls back to duration-only pacing as before.
        self._video_type_plan: Dict[str, Any] = video_type_plan or {}
        self._video_type: str = str(self._video_type_plan.get("type") or "explainer")
        _cadence_hint = str(self._video_type_plan.get("cadence_hint") or "").strip()

        # Host plan (from HostPlannerService — runs in pre-script preamble).
        # When enabled=True, downstream stages branch:
        #   • script LLM       → 1st-person directive (Change 7)
        #   • Director         → HOST_DIRECTOR_EXTENSION + per-shot host fields (Change 8)
        #   • HTML stage       → AvatarBatch sub-stage generates per-shot avatars (Change 9)
        # When enabled=False (default): pipeline behaves identically to today.
        self._host_plan: Dict[str, Any] = host_plan or {}
        self._host_enabled: bool = bool(self._host_plan.get("enabled"))
        self._host_type: str = str(self._host_plan.get("type") or "avatar")
        # Convenience: host-in-video % as a 0–100 int for downstream math.
        try:
            self._host_pct: int = int(self._host_plan.get("host_in_video_percentage") or 0)
        except (TypeError, ValueError):
            self._host_pct = 0
        if self._host_enabled:
            print(
                f"🎙️ Host enabled: type={self._host_type} pct={self._host_pct}% "
                f"(avatar_model={(self._host_plan.get('avatar') or {}).get('avatar_model', '?')})"
            )

        # ── Pacing profile ──
        # Cadence hint from the type classifier wins when present (it's already
        # an LLM-grounded read of the prompt). Otherwise fall back to the
        # duration-only heuristic.
        if _cadence_hint in self.PACING_PROFILES or _cadence_hint == "documentary":
            # PACING_PROFILES has reels/marketing/education; map "documentary"
            # to education-paced (slowest profile we have today).
            self._pacing_style = "education" if _cadence_hint == "documentary" else _cadence_hint
        else:
            self._pacing_style = self._derive_pacing_style(target_duration, content_type)

        # Tier-aware shot cap for Director-based tiers (videos > 2 min only).
        # super_ultra: no cap — two-pass Director, motion_bias, and kinetic_text_shots all
        # rely on dense, short shots. A hard cap fights these features directly.
        # ultra: capped at 40 — no two-pass, saves ~20% LLM calls without quality loss.
        # premium: capped at 30 — no animation validator; longer shots are the right tradeoff.
        # free/standard: use segment path (hardened pacing hints instead of a shot cap).
        import re as _re_dur
        _dur_lower = target_duration.lower().strip()
        _dur_nums = [float(n) for n in _re_dur.findall(r"[\d.]+", _dur_lower)]
        if _dur_nums:
            _dur_s = (sum(_dur_nums) / len(_dur_nums)) * (1 if "second" in _dur_lower else 60)
        else:
            _dur_s = 0.0
        _SHOT_CAPS: dict[str, int] = {
            "premium": 30,
            "ultra":   40,
            # super_ultra: intentionally absent — no cap
        }
        self._max_total_shots: int | None = (
            _SHOT_CAPS.get(self._quality_tier) if _dur_s > 120 else None
        )
        self._target_shot_duration_s: float | None = (
            round(_dur_s / self._max_total_shots, 1) if self._max_total_shots else None
        )
        if self._max_total_shots:
            print(f"🎬 Shot cap: ≤{self._max_total_shots} shots "
                  f"(~{self._target_shot_duration_s}s each) for {_dur_s:.0f}s video"
                  f" [{self._quality_tier}]")

        # Store reference context (processed images/PDFs from user uploads)
        self._reference_context = reference_context
        if start_from not in self.STAGE_INDEX:
            raise ValueError(f"Invalid start_from value: {start_from}")
        
        if stop_at and stop_at not in self.STAGE_INDEX:
            raise ValueError(f"Invalid stop_at value: {stop_at}")
        
        if html_quality not in ["classic", "advanced"]:
            raise ValueError(f"Invalid html_quality value: {html_quality}. Must be 'classic' or 'advanced'")
        
        if background_type not in ["black", "white"]:
            raise ValueError(f"Invalid background_type value: {background_type}. Must be 'black' or 'white'")

        run_dir = self._resolve_run_dir(run_name, resume_run)
        run_dir.mkdir(parents=True, exist_ok=True)
        
        # Use provided language parameter (fallback to file if not provided)
        if language == "English" and DEFAULT_VIDEO_OPTIONS.exists():
            try:
                opts = json.loads(DEFAULT_VIDEO_OPTIONS.read_text())
                language = opts.get("language", "English")
            except Exception as e:
                print(f"⚠️ Could not load video options: {e}")
        
        print(f"🌍 Language set to: {language}")
        print(f"📝 Captions enabled: {show_captions}")
        print(f"🎨 HTML Quality: {html_quality}")
        print(f"🖼️  Background Type: {background_type}")
        print(f"📦 Content Type: {content_type}")
        
        # Store parameters for use in pipeline stages
        self._current_language = language
        self._current_show_captions = show_captions
        self._current_html_quality = html_quality
        self._current_background_type = background_type
        self._current_content_type = content_type
        self._current_avatar_image_url = avatar_image_url
        
        # Store branding config (use defaults if not provided)
        self._current_branding = branding_config or self._get_default_branding()
        # Store style config for brand colors/fonts overrides
        self._current_style_config = style_config
        
        stage_idx = self.STAGE_INDEX[start_from]
        # stop_at means "stop after this stage", so stop_idx is the next stage after stop_at
        if stop_at:
            stop_idx = self.STAGE_INDEX[stop_at] + 1  # Stop before the stage after stop_at
        else:
            stop_idx = len(self.STAGE_ORDER)  # No stop, run all stages
        
        # Only run a stage if: 1) we're starting from that stage or earlier, AND 2) it's before the stop point
        do_script = stage_idx <= self.STAGE_INDEX["script"] and self.STAGE_INDEX["script"] < stop_idx
        do_tts = stage_idx <= self.STAGE_INDEX["tts"] and self.STAGE_INDEX["tts"] < stop_idx
        do_words = stage_idx <= self.STAGE_INDEX["words"] and self.STAGE_INDEX["words"] < stop_idx

        # SLIDES is purely visual — no audio generation needed
        if content_type == "SLIDES":
            do_tts = False
            do_words = False
        do_html = stage_idx <= self.STAGE_INDEX["html"] and self.STAGE_INDEX["html"] < stop_idx
        do_avatar = stage_idx <= self.STAGE_INDEX["avatar"] and self.STAGE_INDEX["avatar"] < stop_idx and generate_avatar
        do_render = stage_idx <= self.STAGE_INDEX["render"] and self.STAGE_INDEX["render"] < stop_idx

        # Path variables must be defined before any bypass block or stage uses them
        script_path = run_dir / "script.txt"
        response_json = run_dir / "narration_raw.json"
        audio_path = run_dir / "narration.mp3"
        words_json = run_dir / "narration.words.json"
        words_csv = run_dir / "narration.words.csv"
        alignment_json = run_dir / "alignment.json"
        timeline_path = run_dir / "time_based_frame.json"

        # ── Input video context handling ──
        # Two modes based on audio_preference:
        #   "original" → skip SCRIPT+TTS, use source video audio + transcript
        #   "tts"      → run SCRIPT+TTS normally, inject video context into prompts
        _iv_audio_pref = (self._input_video_contexts[0] if self._input_video_contexts else (self._input_video_context or {})).get("audio_preference", "original")
        if self._input_video_context and _iv_audio_pref == "original":
            print("🎬 INPUT VIDEO MODE — skipping Script/TTS/Words stages")
            _iv_ctx = self._input_video_context.get("context", {})
            _iv_transcript = _iv_ctx.get("transcript", [])
            _iv_source_url = self._input_video_context.get("source_url", "")

            # Build script_text from indexed transcript
            _iv_script_text = " ".join(s.get("text", "") for s in _iv_transcript).strip()
            if not _iv_script_text:
                _iv_script_text = str(base_prompt or "")

            # Write script.txt
            script_path.write_text(_iv_script_text, encoding="utf-8")

            # Build beat_outline from scenes + transcript
            _iv_scenes = _iv_ctx.get("scenes", [])
            _iv_highlight = _iv_ctx.get("meta", {}).get("highlight_window", {})
            _iv_beats = []
            for i, sent in enumerate(_iv_transcript):
                _iv_beats.append({
                    "label": f"beat_{i}",
                    "narration": sent.get("text", ""),
                    "visual_idea": "",
                    "visual_type": "SOURCE_CLIP",
                })

            script_plan = {
                "plan": {
                    "script": _iv_script_text,
                    "beat_outline": _iv_beats,
                    "subject_domain": "general",
                },
                "script_path": script_path,
                "script_text": _iv_script_text,
            }
            (run_dir / "script_plan.json").write_text(
                json.dumps(script_plan["plan"], indent=2, ensure_ascii=False), encoding="utf-8"
            )

            # Extract audio from source video → narration.mp3
            if not audio_path.exists():
                print(f"🔊 Extracting audio from source video: {_iv_source_url}")
                _iv_video_local = run_dir / "source_video_for_audio"
                # Download source video
                import httpx as _httpx
                # Try S3 download first for private bucket videos
                try:
                    import boto3 as _boto3
                    _s3c = _boto3.client("s3",
                        aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID") or None,
                        aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY") or None,
                        region_name=os.environ.get("AWS_REGION", "ap-south-1"),
                    )
                    for _bkt in ["vacademy-media-storage", "vacademy-media-storage-public"]:
                        if _bkt in _iv_source_url:
                            _parts = _iv_source_url.split(f"{_bkt}.s3.amazonaws.com/")
                            if len(_parts) == 2:
                                _s3c.download_file(_bkt, _parts[1], str(_iv_video_local))
                                break
                    else:
                        # HTTP fallback
                        _resp = _httpx.get(_iv_source_url, timeout=300, follow_redirects=True)
                        _resp.raise_for_status()
                        _iv_video_local.write_bytes(_resp.content)
                except Exception:
                    _resp = _httpx.get(_iv_source_url, timeout=300, follow_redirects=True)
                    _resp.raise_for_status()
                    _iv_video_local.write_bytes(_resp.content)

                # ffmpeg extract audio
                _ffmpeg_cmd = [
                    "ffmpeg", "-y", "-i", str(_iv_video_local),
                    "-vn", "-acodec", "libmp3lame", "-q:a", "2",
                    str(audio_path),
                ]
                subprocess.run(_ffmpeg_cmd, capture_output=True, check=True, timeout=120)
                # Clean up the large video file
                _iv_video_local.unlink(missing_ok=True)
                print(f"   ✅ Audio extracted: {audio_path.stat().st_size / 1024:.0f} KB")

            tts_outputs = {"response_json": response_json, "audio_path": audio_path}

            # Create placeholder files expected by downstream resume-path checks
            # (the elif branches in do_tts/do_words require these files to exist)
            if not response_json.exists():
                response_json.write_text("{}", encoding="utf-8")
            if not words_csv.exists():
                words_csv.write_text("word,start,end\n", encoding="utf-8")

            # Build word timestamps from indexed transcript
            _iv_words_list = []
            for sent in _iv_transcript:
                for w in sent.get("words", []):
                    _iv_words_list.append({
                        "word": w.get("word", ""),
                        "start": w.get("start", 0.0),
                        "end": w.get("end", 0.0),
                    })
            if _iv_words_list:
                words_json.write_text(json.dumps(_iv_words_list, ensure_ascii=False), encoding="utf-8")
            word_outputs = {"words_json": words_json if _iv_words_list else None, "words_csv": None}
            words = _iv_words_list

            # Skip all three stages
            do_script = False
            do_tts = False
            do_words = False

            print(f"   📝 Script: {len(_iv_transcript)} sentences, {len(_iv_words_list)} words")
            print(f"   🎯 Highlight: {_iv_highlight.get('t_start', 0):.1f}-{_iv_highlight.get('t_end', 0):.1f}s")

        elif self._input_video_context and _iv_audio_pref == "tts":
            # TTS mode: script+TTS run normally. We enrich base_prompt with
            # video context so the script LLM knows what's on screen.
            print("🎬 INPUT VIDEO MODE (TTS) — enriching prompt with video context")
            _iv_ctx = self._input_video_context.get("context", {})
            _iv_v_mode = self._input_video_context.get("mode", "demo")
            _iv_demo = _iv_ctx.get("demo_only", {}) if _iv_v_mode == "demo" else {}
            _iv_transcript = _iv_ctx.get("transcript", [])

            # Detect user-authored script BEFORE building context block so we can
            # use a different closing instruction (preserve vs rewrite).
            import re as _re_tts_detect
            _tts_script_markers = [
                r"NARRATOR\s*\(?V?\.?O?\.?\)?\s*:",
                r"\[\s*OPENING", r"\[\s*CLOSING", r"\[\s*SCENE",
                r"\bV\.O\.", r"\bVOICEOVER\b", r"SCRIPT\s*\n", r"SHOT\s*LIST",
                r"\d{1,2}:\d{2}\s*[-–—]",
            ]
            _user_has_script = any(
                _re_tts_detect.search(p, base_prompt, flags=_re_tts_detect.IGNORECASE)
                for p in _tts_script_markers
            ) or (len(base_prompt) > 800 and "\n\n" in base_prompt)
            # Store on self so the Director prompt can use it
            self._user_had_script = _user_has_script

            # Build a context block describing what's in the video
            _iv_meta = _iv_ctx.get("meta", {})
            _iv_dur = _iv_meta.get("duration_s", 0)
            _context_parts = []

            # Source video duration + mode-specific guidance
            if _iv_dur > 0:
                if _user_has_script:
                    _context_parts.append(
                        f"Source video duration: {_iv_dur:.0f}s. "
                        "The user has already written their narration script. "
                        "DO NOT rewrite or replace their wording. "
                        "Your job is to PRESERVE their script and use the video context "
                        "below ONLY to understand which UI elements and timestamps correspond "
                        "to each narrative beat."
                    )
                elif _iv_v_mode == "demo":
                    _context_parts.append(
                        f"Source video duration: {_iv_dur:.0f}s. "
                        "Write narration as a GUIDED WALKTHROUGH of this demo — "
                        "describe what the viewer sees at each step, explain the UI actions, "
                        "and highlight key features. Don't add generic marketing filler. "
                        "Every sentence should relate to something visible in the demo."
                    )
                else:  # podcast
                    _context_parts.append(
                        f"Source video duration: {_iv_dur:.0f}s. "
                        "Write narration that introduces and contextualizes the speaker's key points. "
                        "The viewer will see clips of the speaker — your narration bridges between clips, "
                        "provides background, and highlights the most impactful quotes. "
                        "Don't repeat what the speaker says verbatim — add context and insight."
                    )

            # In user-script mode skip demo narration/UI from context — the video's
            # own narration ("Front Desk Test", "Interaction Model") pollutes the LLM
            # and overrides the user's script. Only include timing-relevant data.
            if not _user_has_script:
                if _iv_demo:
                    ui_elements = _iv_demo.get("ui_elements_seen", [])
                    if ui_elements:
                        _context_parts.append(f"UI elements visible: {', '.join(ui_elements[:15])}")
                    key_events = _iv_demo.get("key_onscreen_events", [])
                    if key_events:
                        event_descs = [f"{e.get('kind', '?')} near '{e.get('near_text', '?')}' at {e.get('t', 0):.1f}s"
                                      for e in key_events[:10]]
                        _context_parts.append(f"Key events: {'; '.join(event_descs)}")
                if _iv_transcript:
                    transcript_text = " ".join(s.get("text", "") for s in _iv_transcript[:20])
                    if transcript_text.strip():
                        _context_parts.append(f"Narration heard: {transcript_text[:500]}")

            # Routing plan: hard duration constraint when narration_fit_to_source is on.
            # When the user attached source videos and asked us to "use parts of the videos"
            # / "trim based on need", the narration must not exceed the combined source
            # duration — otherwise SOURCE_CLIPs get speed-warped or chopped.
            if self._routing_config.get("narration_fit_to_source") and self._input_video_contexts:
                _total_src_dur = 0.0
                for _ivc in self._input_video_contexts:
                    _ivc_meta = (_ivc.get("context") or {}).get("meta") or {}
                    _total_src_dur += float(_ivc_meta.get("duration_s", 0) or 0)
                if _total_src_dur > 0:
                    _context_parts.append(
                        f"HARD CONSTRAINT: total source video duration is {_total_src_dur:.0f}s. "
                        f"Narration must fit within {_total_src_dur:.0f}s (±10%). "
                        "Do not invent steps, screens, or features that are not visible in the source videos. "
                        "Every sentence must correspond to something the viewer can actually see."
                    )

            if _context_parts:
                if _user_has_script:
                    _closing = (
                        "\n\n🚨 USER SCRIPT DETECTED: The user has already written their narration. "
                        "OUTPUT THEIR SCRIPT VERBATIM. Do NOT rewrite, paraphrase, or replace any "
                        "sentence. Use the video context above only to confirm timing/structure. "
                        "Your entire output should be the user's own words, preserved exactly.\n"
                    )
                elif _iv_v_mode == "demo":
                    _closing = (
                        "\n\nIMPORTANT: Write narration that walks through the demo "
                        "step by step. Describe what the viewer sees on screen at each moment. "
                        "Do NOT add generic filler like 'In today's digital age' or 'Let's explore'. "
                        "Every sentence should describe a specific screen, button, or action visible in the demo.\n"
                    )
                else:
                    _closing = (
                        "\n\nIMPORTANT: Write narration that contextualizes the speaker's message. "
                        "Bridge between key quotes, provide background on the speaker/topic, "
                        "and highlight the most powerful moments. Don't narrate over the speaker — "
                        "your narration fills the gaps between source video clips.\n"
                    )
                _video_context_block = (
                    "\n\n--- SOURCE VIDEO CONTEXT ---\n"
                    f"The user has provided a {'screen recording / demo' if _iv_v_mode == 'demo' else 'podcast / interview'} video. "
                    f"Write the narration {'as a guided walkthrough' if _iv_v_mode == 'demo' else 'to complement the speaker'}:\n\n"
                    + "\n".join(f"- {p}" for p in _context_parts)
                    + _closing
                    + "--- END SOURCE VIDEO CONTEXT ---\n"
                )
                if base_prompt:
                    base_prompt = base_prompt + _video_context_block
                else:
                    base_prompt = _video_context_block
                self._base_prompt = base_prompt

            print(f"   📝 Enriched prompt with {len(_context_parts)} context items")

        # Token usage aggregation
        total_usage = {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
            "image_count": 0,
            "tts_character_count": 0,
            "stock_count": 0,
        }

        def accumulate_usage(u: Dict[str, Any]):
            if not u: return
            total_usage["prompt_tokens"] += u.get("prompt_tokens", 0)
            total_usage["completion_tokens"] += u.get("completion_tokens", 0)
            total_usage["total_tokens"] += u.get("total_tokens", 0)
            total_usage["image_count"] += u.get("image_count", 0)
            total_usage["tts_character_count"] += u.get("tts_character_count", 0)
            total_usage["stock_count"] += u.get("stock_count", 0)

        # Initialize outputs to safe defaults in case stages are skipped
        tts_outputs = {"response_json": None, "audio_path": None}
        word_outputs = {"words_json": None, "words_csv": None, "alignment_json": None}

        # Store user's original prompt so it can be forwarded to HTML generation
        if base_prompt and base_prompt.strip():
            self._base_prompt = base_prompt.strip()

        if do_script:
            if not base_prompt or not base_prompt.strip():
                raise ValueError("A prompt is required when starting from the script stage.")
            print(f"📝 Drafting refined script ({run_dir.name}) for {target_audience} [{target_duration}]...")
            self._emit_progress({"type": "sub_stage", "sub_stage": "script_writing",
                                  "message": "Writing script..."})
            script_out = self._draft_script(base_prompt, run_dir, language=language, target_audience=target_audience, target_duration=target_duration, content_type=content_type)
            script_plan = script_out["result"]
            _script_usage = script_out.get("usage", {})
            accumulate_usage(_script_usage)
            self._emit_progress({
                "type": "sub_stage", "sub_stage": "script_done",
                "message": "Script ready",
                "token_delta": {
                    "prompt_tokens": _script_usage.get("prompt_tokens", 0),
                    "completion_tokens": _script_usage.get("completion_tokens", 0),
                },
                "cumulative_tokens": dict(total_usage),
            })

            # Two-pass script review (Premium/Ultra tiers)
            if self._tier_config.get("two_pass_script") and content_type == "VIDEO":
                reviewed_plan = self._review_script(script_plan.get("plan", script_plan), run_dir)
                if reviewed_plan:
                    script_plan["plan"] = reviewed_plan
                    reviewed_text = str(reviewed_plan.get("script") or reviewed_plan.get("script_text") or "").strip()
                    if reviewed_text:
                        script_plan["script_text"] = reviewed_text
                    # Repair narrations after review (reviewer may have edited the script)
                    script_plan["plan"] = self._repair_beat_narrations(
                        script_plan["plan"],
                        script_plan.get("script_text", ""),
                    )
        else:
            self._require_file(script_path, "script.txt (narration text)")
            # Try to load the plan if it exists, otherwise provide a dummy one
            plan_path = run_dir / "script_plan.json"
            if plan_path.exists():
                plan_data = json.loads(plan_path.read_text())
            else:
                plan_data = {}
            
            script_plan = {
                "plan": plan_data,
                "script_path": script_path,
                "script_text": script_path.read_text(),
            }

        # Content types that produce no audio (purely visual)
        NO_AUDIO_TYPES = {"SLIDES"}

        # Only proceed to TTS if we are not stopping before it
        if self.STAGE_INDEX["tts"] < stop_idx:
            if do_tts:
                self._emit_progress({"type": "sub_stage", "sub_stage": "tts_generating",
                                      "message": "Generating voice narration..."})
                tts_outputs = self._synthesize_voice(
                    script_plan["script_path"],
                    run_dir,
                    language=language,
                    voice_gender=voice_gender,
                    tts_provider=tts_provider,
                    voice_id=voice_id,
                )
                # Track TTS character count for credit deduction
                _tts_chars = tts_outputs.get("tts_character_count", 0)
                accumulate_usage({"tts_character_count": _tts_chars})
                self._emit_progress({"type": "sub_stage", "sub_stage": "tts_done",
                                      "message": "Voice narration ready",
                                      "tts_character_count": _tts_chars,
                                      "cumulative_tokens": dict(total_usage)})
            elif content_type not in NO_AUDIO_TYPES:
                # Resuming from a checkpoint after TTS — files must already exist
                self._require_file(response_json, "narration_raw.json (ElevenLabs response)")
                self._require_file(audio_path, "narration.mp3 (decoded audio)")
                # Recover TTS character count from the script file so cost/credit
                # accounting still reflects the TTS work done in the prior run.
                _resumed_tts_chars = 0
                try:
                    _script_text_for_tts = script_path.read_text(encoding="utf-8") if script_path and script_path.exists() else ""
                    _resumed_tts_chars = len(_script_text_for_tts)
                except Exception:
                    _resumed_tts_chars = 0
                if _resumed_tts_chars:
                    accumulate_usage({"tts_character_count": _resumed_tts_chars})
                tts_outputs = {
                    "response_json": response_json,
                    "audio_path": audio_path,
                    "tts_character_count": _resumed_tts_chars,
                }
            # else: no-audio content type (e.g. SLIDES) — leave tts_outputs as empty defaults

        # Only proceed to WORDS if we are not stopping before it
        if self.STAGE_INDEX["words"] < stop_idx:
            if do_words:
                print("🔤 Deriving word timings ...")
                word_outputs = self._parse_timestamps(tts_outputs["response_json"], run_dir)
            elif content_type not in NO_AUDIO_TYPES:
                # Resuming from a checkpoint after WORDS — files must already exist
                self._require_file(words_json, "narration.words.json")
                self._require_file(words_csv, "narration.words.csv")
                # Note: alignment.json not required since phonemes disabled
                word_outputs = {
                    "words_json": words_json,
                    "words_csv": words_csv,
                }
            # else: no-audio content type — leave word_outputs as empty defaults

            if word_outputs["words_json"] is not None:
                words = self._load_words(word_outputs["words_json"])
                if not words:
                    raise RuntimeError("No words parsed from timestamps; cannot continue.")
            else:
                words = []
        else:
            words = []

        style_guide = None  # Will be set if do_html; used later to store palette in timeline meta
        if do_html:
            # Checkpoint: load style guide from prior run to skip this LLM call on resume
            _sg_ckpt = run_dir / "style_guide.json"
            if _sg_ckpt.exists():
                try:
                    _sg_cached = json.loads(_sg_ckpt.read_text())
                    if _sg_cached and _sg_cached.get("palette"):
                        style_guide = _sg_cached
                        print("♻️  Loaded style guide from checkpoint")
                except Exception:
                    pass
            if style_guide is None:
                print("🎨 Designing Visual Style Guide ...")
                # Stash script text for the Sound Planner's topic-aware palette.
                self._current_script_text = str(script_plan.get("script_text", "") or "")
                style_guide = self._generate_style_guide(script_plan["script_text"], run_dir, background_type=background_type, style_config=self._current_style_config)
            
            # CHECK FOR INTERACTIVE CONTENT TYPES
            interactive_types = ["QUIZ", "STORYBOOK", "FLASHCARDS", "PUZZLE_BOOK", "INTERACTIVE_GAME", "SIMULATION", "WORKSHEET", "CODE_PLAYGROUND", "TIMELINE", "CONVERSATION", "MAP_EXPLORATION", "SLIDES"]
            
            if content_type in interactive_types:
                print(f"🎮 Processing interactive content type: {content_type}")
                # For interactive content, we bypass audio-based segmentation and directly use the structure from the plan
                html_segments, html_usage = self._process_interactive_content(script_plan, content_type)
                accumulate_usage(html_usage)
                
                # Some interactive types still need image generation (like Storybooks)
                print("🖼️  Checking for visual assets to generate ...")
                html_segments, image_usage = self._process_generated_images(html_segments, run_dir)
                accumulate_usage(image_usage)
                html_segments, stock_usage = self._process_stock_videos(html_segments)
                accumulate_usage(stock_usage)
            else:
                # STANDARD VIDEO FLOW
                # Extract subject domain from AI-classified script plan
                plan_data = script_plan.get("plan", {})
                subject_domain = plan_data.get("subject_domain", "general")
                if subject_domain not in TOPIC_SHOT_PROFILES:
                    subject_domain = "general"
                self._current_subject_domain = subject_domain
                # `_current_image_style` is the LLM-picked IMAGE STYLE used as a prefix
                # for AI image generation prompts ("realistic cinematic photograph",
                # "flat vector illustration", etc.). Shot style (cream infographic vs
                # dark stage vs product hero) is now chosen per-shot by the Director.
                self._current_image_style = plan_data.get("visual_style", "realistic cinematic photograph")
                print(f"📘 Subject domain: {subject_domain} ({TOPIC_SHOT_PROFILES[subject_domain]['description']})")
                print(f"🎨 Image style: {self._current_image_style}")
                
                print("🧠 Building concept-aligned segments ...")
                # Use beat_outline for concept-aligned segmentation if available
                beat_outline = plan_data.get("beat_outline", [])

                # Store raw questions from script plan (chapter timestamps assigned later)
                self._current_questions = plan_data.get("questions", [])
                if self._current_questions:
                    print(f"   📝 Loaded {len(self._current_questions)} MCQ questions from script plan")

                # Get actual audio duration so segments cover the full narration
                _seg_audio_dur = 0.0
                _seg_audio_path = tts_outputs.get("audio_path")
                if _seg_audio_path and Path(_seg_audio_path).exists():
                    # Try ffprobe first, then fall back to mutagen (pure Python)
                    try:
                        _probe_res = subprocess.run(
                            ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                             "-of", "default=noprint_wrappers=1:nokey=1", str(_seg_audio_path)],
                            capture_output=True, text=True, timeout=10,
                        )
                        _seg_audio_dur = float(_probe_res.stdout.strip())
                    except Exception:
                        # ffprobe not available — use mutagen (pure Python)
                        try:
                            from mutagen.mp3 import MP3
                            _seg_audio_dur = MP3(str(_seg_audio_path)).info.length
                        except Exception:
                            pass
                    if _seg_audio_dur > 0:
                        print(f"   ℹ️  Actual audio duration: {_seg_audio_dur:.1f}s")

                # Configurable max segments to limit LLM expense
                # Default: max 12 segments (covers ~8 minutes of video at ~40s each)
                max_segments = getattr(self, '_max_segments', 12)

                if beat_outline and len(beat_outline) >= 2 and words:
                    segments = self._segment_words_by_beats(
                        words, beat_outline, max_segments=max_segments,
                        audio_duration=_seg_audio_dur,
                    )
                    print(f"   ✅ Created {len(segments)} concept-aligned segments from {len(beat_outline)} beats (max: {max_segments})")
                else:
                    segments = self._segment_words(words, audio_duration=_seg_audio_dur)
                    print(f"   ℹ️  Using fixed-window segmentation ({len(segments)} segments)")

                # Store segment start times + labels for chapter markers in the frontend player
                self._current_chapters = [
                    {"time": seg["start"], "label": seg.get("beat_label", f"Section {i + 1}")}
                    for i, seg in enumerate(segments)
                ]

                # Store glossary terms: each key term introduced at its segment's start time
                # De-duplicate terms (keep earliest occurrence)
                seen_terms: Set[str] = set()
                glossary: List[Dict[str, Any]] = []
                for seg in segments:
                    for term in seg.get("key_terms", []):
                        if term and term not in seen_terms:
                            seen_terms.add(term)
                            glossary.append({"term": term, "time": seg["start"]})
                self._current_glossary = glossary

                if not segments:
                    raise RuntimeError("Failed to derive segments from narration.")
                
                print(f"🎨 Generating {len(segments)} HTML overlay sets via OpenRouter ...")

                # ── Pipelined HTML + image generation ─────────────────────────────────
                # As each HTML segment completes, its entries are immediately queued for
                # image generation in a background thread — so image work starts while
                # the remaining segments are still being generated by the LLM.
                # _process_generated_images is still called at the end to handle any
                # segments that were completed after image gen started (and to apply
                # the base64 replacements in a single pass).
                #
                # Thread-safety: the callback appends to `_early_image_segments` under
                # a lock; _process_generated_images only reads once all HTML is done.
                import threading as _threading
                _early_image_segments: List[Dict[str, Any]] = []
                _early_image_lock = _threading.Lock()
                _early_image_results: List[Dict[str, Any]] = []  # raw result dicts
                _early_image_usage: Dict[str, Any] = {
                    "prompt_tokens": 0, "completion_tokens": 0,
                    "total_tokens": 0, "image_count": 0,
                }

                _SVG_KW_RE_PIPE = re.compile(
                    r'\b(diagram|flowchart|bar chart|pie chart|line chart|infographic|'
                    r'comparison chart|data table|workflow|process flow|timeline diagram|'
                    r'schematic|blueprint|concept map|mind map|venn diagram)\b',
                    re.IGNORECASE,
                )
                _img_executor = concurrent.futures.ThreadPoolExecutor(max_workers=4)
                _early_futures: List[concurrent.futures.Future] = []
                _images_dir_early = run_dir / "generated_images"
                _images_dir_early.mkdir(parents=True, exist_ok=True)

                def _on_html_segment_done(entries: List[Dict[str, Any]]) -> None:
                    """Callback: called from HTML gen pool as each segment finishes."""
                    if not getattr(self.script_client, "api_key", None):
                        return
                    for entry in entries:
                        html_e = entry.get("html", "")
                        if "data-img-prompt" not in html_e:
                            continue
                        matches_e = list(re.finditer(
                            r'(<img[^>]+data-img-prompt=(["\'])(.*?)\2[^>]*>)', html_e))
                        for m in matches_e:
                            full_tag = m.group(1)
                            prompt_e = m.group(3)
                            if _SVG_KW_RE_PIPE.search(prompt_e):
                                continue
                            # Use IMAGE STYLE (LLM-picked), not the pipeline visual mode
                            image_style_e = getattr(
                                self, '_current_image_style', 'realistic cinematic photograph')
                            if image_style_e.lower() not in prompt_e.lower():
                                prompt_e = f"{image_style_e}, {prompt_e}"

                            img_source_e = "generate"  # default for backwards compat
                            source_match_e = re.search(r'data-img-source=["\'](\w+)["\']', full_tag)
                            if source_match_e:
                                img_source_e = source_match_e.group(1).lower()
                            provider_match_e = re.search(r'data-stock-provider=["\'](\w+)["\']', full_tag)
                            stock_provider_e = provider_match_e.group(1).lower() if provider_match_e else ""
                            task_e = {
                                "entry": entry,
                                "full_tag": full_tag,
                                "prompt": prompt_e,
                                "seg_idx": id(entry),
                                "img_source": img_source_e,
                                "stock_provider": stock_provider_e,
                                "timestamp": datetime.now().strftime("%f"),
                            }
                            with _early_image_lock:
                                _early_image_segments.append(entry)
                            fut = _img_executor.submit(
                                self._process_image_task_simple, task_e, _images_dir_early)
                            _early_futures.append(fut)

                # ── Director Stage (premium/ultra) ─────────────────────────
                # If enabled, run a Director LLM call to plan shots, then
                # generate HTML per-shot with focused prompts. Falls back to
                # segment-based flow on failure.
                _director_plan = None
                if self._tier_config.get("use_director") and content_type == "VIDEO":
                    # Checkpoint: load existing Director plan on resume (avoids re-running 2 LLM calls)
                    _director_ckpt = run_dir / "director_plan.json"
                    if _director_ckpt.exists():
                        try:
                            _ckpt_plan = json.loads(_director_ckpt.read_text())
                            if _ckpt_plan and _ckpt_plan.get("shots"):
                                _director_plan = _ckpt_plan
                                print(f"♻️  Loaded Director plan from checkpoint ({len(_ckpt_plan['shots'])} shots)")
                                self._emit_progress({
                                    "type": "sub_stage", "sub_stage": "director_done",
                                    "message": f"Shot plan loaded from checkpoint ({len(_ckpt_plan['shots'])} shots)",
                                    "shot_count": len(_ckpt_plan["shots"]),
                                    "from_checkpoint": True,
                                    "shots_summary": [
                                        {"shot_index": s.get("shot_index", i),
                                         "shot_type": s.get("shot_type", ""),
                                         "duration_s": round(s.get("end_time", 0) - s.get("start_time", 0), 2),
                                         "start_time": s.get("start_time", 0),
                                         "end_time": s.get("end_time", 0),
                                         "narration_excerpt": s.get("narration_excerpt", "")[:80]}
                                        for i, s in enumerate(_ckpt_plan["shots"])
                                    ],
                                })
                        except Exception as _ckpt_err:
                            print(f"⚠️ Could not load Director checkpoint: {_ckpt_err} — re-running Director")
                    if _director_plan is None:
                        if _seg_audio_dur > 0:
                            self._emit_progress({
                                "type": "sub_stage", "sub_stage": "director_planning",
                                "message": f"Director planning shots for {_seg_audio_dur:.0f}s video...",
                                "quality_tier": self._quality_tier,
                            })
                            _director_plan, director_usage = self._run_director(
                                script_plan, words, style_guide, run_dir,
                                language=language,
                                audio_duration=_seg_audio_dur,
                                target_audience=target_audience,
                            )
                            _dir_usage = director_usage
                            accumulate_usage(_dir_usage)
                            if _director_plan and _director_plan.get("shots"):
                                self._emit_progress({
                                    "type": "sub_stage", "sub_stage": "director_done",
                                    "message": f"Shot plan ready: {len(_director_plan['shots'])} shots",
                                    "shot_count": len(_director_plan["shots"]),
                                    "from_checkpoint": False,
                                    "token_delta": {
                                        "prompt_tokens": _dir_usage.get("prompt_tokens", 0),
                                        "completion_tokens": _dir_usage.get("completion_tokens", 0),
                                    },
                                    "cumulative_tokens": dict(total_usage),
                                    "shots_summary": [
                                        {"shot_index": s.get("shot_index", i),
                                         "shot_type": s.get("shot_type", ""),
                                         "duration_s": round(s.get("end_time", 0) - s.get("start_time", 0), 2),
                                         "start_time": s.get("start_time", 0),
                                         "end_time": s.get("end_time", 0),
                                         "narration_excerpt": s.get("narration_excerpt", "")[:80]}
                                        for i, s in enumerate(_director_plan["shots"])
                                    ],
                                })
                        else:
                            print("⚠️ Audio duration unknown — skipping Director stage")

                if _director_plan and _director_plan.get("shots"):
                    # Per-shot HTML generation using Director plan
                    print(f"🎬 Using Director plan: {len(_director_plan['shots'])} shots")

                    # Avatar batch — run BEFORE per-shot HTML gen so each shot's
                    # prompt receives its avatar_video_url (no post-swap needed).
                    # No-op when host is disabled or content_type != VIDEO.
                    if (
                        getattr(self, "_host_enabled", False)
                        and getattr(self, "_host_type", "") == "avatar"
                        and content_type == "VIDEO"
                    ):
                        try:
                            # Side-effects only: writes run_dir/host_outputs.json,
                            # mutates director_plan["shots"][i] with avatar_video_url,
                            # and flips host_present=false for any failed shots.
                            self._run_avatar_batch_sync(_director_plan, run_dir)
                        except Exception as _ab_err:
                            print(f"[AvatarBatch] ⚠️  catastrophic failure: {_ab_err}")
                            # Disable host on every shot so per-shot HTML falls through
                            for _s in _director_plan.get("shots", []):
                                if _s.get("host_present"):
                                    _s["host_present"] = False
                    elif (
                        getattr(self, "_host_enabled", False)
                        and getattr(self, "_host_type", "") == "raw"
                    ):
                        # Raw-host generation is plumbed only this round.
                        # Surface a clear error event but keep the run going as
                        # a regular non-host video.
                        print("[AvatarBatch] host.type='raw' is not yet implemented — falling back to non-host run")
                        for _s in _director_plan.get("shots", []):
                            if _s.get("host_present"):
                                _s["host_present"] = False
                        self._emit_progress({
                            "type": "warning",
                            "stage": "html",
                            "message": "host.type='raw' is not implemented yet; rendering without host",
                        })

                    self._emit_progress({
                        "type": "sub_stage", "sub_stage": "html_generating",
                        "message": f"Generating visuals for {len(_director_plan['shots'])} shots...",
                        "total_shots": len(_director_plan["shots"]),
                        "mode": "per_shot",
                    })
                    html_results, html_usage = self._generate_html_per_shot(
                        _director_plan, style_guide, words, run_dir,
                        language=language,
                        on_segment_done=_on_html_segment_done,
                    )
                else:
                    # Fallback: segment-based flow (free/standard, or Director failed)
                    self._emit_progress({
                        "type": "sub_stage", "sub_stage": "html_generating",
                        "message": f"Generating visuals for {len(segments)} segments...",
                        "total_shots": len(segments),
                        "mode": "segment",
                    })
                    html_results, html_usage = self._generate_html_segments(
                        segments, style_guide, plan_data, run_dir,
                        language=language,
                        on_segment_done=_on_html_segment_done,
                    )
                html_segments = html_results
                _html_usage = html_usage
                accumulate_usage(_html_usage)
                self._emit_progress({
                    "type": "sub_stage", "sub_stage": "html_done",
                    "message": f"Visuals ready ({len(html_segments)} shots)",
                    "total_shots": len(html_segments),
                    "token_delta": {
                        "prompt_tokens": _html_usage.get("prompt_tokens", 0),
                        "completion_tokens": _html_usage.get("completion_tokens", 0),
                    },
                    "cumulative_tokens": dict(total_usage),
                })

                # Collect results from pipelined image tasks (already running/done)
                print(f"🖼️  Waiting for {len(_early_futures)} pipelined image task(s)...")
                _img_requeue: List[Dict] = []  # collect 429s for main-thread retry
                for _fut in concurrent.futures.as_completed(_early_futures):
                    try:
                        _res = _fut.result()
                    except _ImageGenRateLimitError as _rl:
                        # requeue after delay — handled below
                        _img_requeue.append({"fut": _fut, "rl": _rl})
                        continue
                    except Exception as _ex:
                        print(f"    ⚠️  Pipelined image task error: {_ex}")
                        continue
                    if _res:
                        _early_image_results.append(_res)
                        _early_image_usage["image_count"] += 1

                # Retry any 429-limited tasks (sleep in main thread, not executor)
                _MAX_REQUEUE_PIPE = 2
                _requeue_counts_pipe: Dict[str, int] = {}
                for _rq in _img_requeue:
                    _rl_err = _rq["rl"]
                    _wait = min(_rl_err.retry_after, 60.0)
                    print(f"    ⏳ Pipelined image 429 — sleeping {_wait:.0f}s then retrying...")
                    time.sleep(_wait)
                    # re-submit and collect result synchronously (rare path)
                    try:
                        _res = self._process_image_task_simple(
                            _rq.get("task", {}), _images_dir_early)
                        if _res:
                            _early_image_results.append(_res)
                    except Exception:
                        pass

                _img_executor.shutdown(wait=False)

                # Apply in-memory replacements from pipelined results.
                # Generated images: emit the local filename so the post-upload
                # URL swap in video_generation_service.py rewrites it to the
                # public S3 URL. Avoids 1-2MB base64 blobs per <img> that
                # bloated timeline JSON and caused audio/visual drift in the
                # browser player on long videos.
                _repl_applied_pipe = 0
                for _res in _early_image_results:
                    _entry   = _res.get("entry")
                    _old_tag = _res.get("full_tag", "")
                    _ibytes  = _res.get("image_bytes")
                    _stock_url = _res.get("stock_url")
                    _filename = _res.get("filename")
                    _is_svg   = _res.get("is_svg", False)
                    if not (_entry and _old_tag and (_ibytes or _stock_url)):
                        continue
                    _html_e = _entry.get("html", "")
                    if _stock_url:
                        _nsrc = _stock_url
                    elif _is_svg and _ibytes:
                        # SVG synthesized placeholders are tiny, never round-trip
                        # through S3 — keep them inline as data URIs.
                        _b64  = base64.b64encode(_ibytes).decode("utf-8")
                        _nsrc = f"data:image/svg+xml;base64,{_b64}"
                    elif _filename:
                        # Saved to generated_images/{filename}; post-upload
                        # swap rewrites this to the S3 URL.
                        _nsrc = _filename
                    else:
                        # Last-resort fallback: in-memory bytes with no filename.
                        _b64  = base64.b64encode(_ibytes).decode("utf-8")
                        _nsrc = f"data:image/png;base64,{_b64}"
                    if _old_tag in _html_e:
                        _new_tag = re.sub(r'src=["\'][^"\']*["\']',
                                          f'src="{_nsrc}"', _old_tag)
                        _entry["html"] = _html_e.replace(_old_tag, _new_tag)
                        _repl_applied_pipe += 1
                print(f"    📝 Pipelined image replacements applied: {_repl_applied_pipe}")

                # Fall back to full _process_generated_images for any segments whose
                # images weren't submitted early (e.g. segments that finished after
                # the executor was already done, or images with no early result).
                print("🖼️  Checking for any remaining visual assets to generate ...")
                html_segments, image_usage = self._process_generated_images(html_segments, run_dir)
                accumulate_usage(image_usage)
                html_segments, stock_usage = self._process_stock_videos(html_segments)
                accumulate_usage(stock_usage)

            # ── Background music (Lyria) ──
            # Runs before _write_timeline so the generated track can land in
            # meta.audio_tracks alongside any user-added tracks. Gated by
            # tier + request override; never fatal — music failures log and
            # let the video ship without a score.
            # Tiers that don't run the Director (standard) get a synthesized
            # default plan so they can still ship with a score.
            _music_plan_to_use: Optional[Dict[str, Any]] = None
            if _director_plan and _director_plan.get("music_plan"):
                _music_plan_to_use = _director_plan["music_plan"]
            elif self._is_background_music_enabled() and _seg_audio_dur > 0:
                _music_plan_to_use = self._build_default_music_plan(float(_seg_audio_dur))

            if (
                self._is_background_music_enabled()
                and content_type == "VIDEO"
                and _music_plan_to_use
                and _seg_audio_dur > 0
            ):
                try:
                    from music_generator import generate_background_music
                    _music_result = generate_background_music(
                        music_plan=_music_plan_to_use,
                        audio_duration=float(_seg_audio_dur),
                        video_id=run_name or run_dir.name,
                        run_dir=run_dir,
                        progress_callback=self._progress_callback,
                    )
                    if _music_result and _music_result.get("url"):
                        _music_vol = (
                            self._background_music_volume_override
                            if self._background_music_volume_override is not None
                            else float(self._tier_config.get("background_music_default_volume", 0.20))
                        )
                        self._background_music_track = {
                            "id": "background-music",
                            "label": "Background Music",
                            "url": _music_result["url"],
                            "volume": _music_vol,
                            "delay": 0.0,
                            "fadeIn": 2.0,
                            "fadeOut": 3.0,
                        }
                        print(f"🎼 Background music ready: {_music_result['url']}")
                except Exception as _mus_err:
                    print(f"⚠️ Background music generation failed: {_mus_err}")
                    # Curated-bed fallback. Picks a royalty-free track from the
                    # MUSIC_BED_* env-var library (asset rollout pending, see
                    # music_fallback_library.py docstring). When no env vars
                    # are configured the video ships without a score (legacy).
                    try:
                        from music_fallback_library import pick_fallback_bed
                        _fb_bed = pick_fallback_bed(_music_plan_to_use)
                        if _fb_bed and _fb_bed.get("url"):
                            _music_vol = (
                                self._background_music_volume_override
                                if self._background_music_volume_override is not None
                                else float(self._tier_config.get("background_music_default_volume", 0.20))
                            )
                            self._background_music_track = {
                                "id": "background-music",
                                "label": f"Background Music ({_fb_bed.get('mood', 'ambient')} bed)",
                                "url": _fb_bed["url"],
                                "volume": _music_vol,
                                "delay": 0.0,
                                "fadeIn": 2.0,
                                "fadeOut": 3.0,
                            }
                            print(
                                f"🎼 Fell back to curated bed (mood={_fb_bed.get('mood')}): "
                                f"{_fb_bed['url']}"
                            )
                        else:
                            print(
                                "ℹ️ No MUSIC_BED_* env-var configured for chosen mood — "
                                "shipping video without score"
                            )
                    except Exception as _fb_err:
                        print(f"⚠️ Curated-bed fallback errored: {_fb_err} — shipping silent")
            elif self._is_background_music_enabled():
                print(
                    f"ℹ️ Background music skipped "
                    f"(content_type={content_type}, has_music_plan="
                    f"{bool(_music_plan_to_use)}, audio_dur={_seg_audio_dur:.1f}s)"
                )

            print("🧾 Writing timeline JSON ...")
            timeline_path = self._write_timeline(
                html_segments, run_dir, self._current_branding, self._current_content_type,
                chapters=getattr(self, '_current_chapters', None),
                glossary=getattr(self, '_current_glossary', None),
                questions=getattr(self, '_current_questions', None),
                language=language,
                audio_path=tts_outputs.get("audio_path"),
                style_guide=style_guide,
            )

            # ── Per-shot audio mixing (opt-in) ──
            # Only runs when user explicitly requested `mute_tts_on_source_clips`.
            # Default behavior: TTS plays continuously (marketing/explainer mode).
            # When True: source video audio replaces TTS during SOURCE_CLIP shots
            # (podcast mode where hearing the speaker matters).
            _iv_audio_pref = (self._input_video_contexts[0] if self._input_video_contexts else {}).get("audio_preference", "")
            _tts_audio = tts_outputs.get("audio_path")
            if (
                self._mute_tts_on_source_clips
                and _iv_audio_pref == "tts"
                and _tts_audio
                and self._input_video_contexts
            ):
                _words_path = word_outputs.get("words_json")
                if _words_path:
                    print("🎵 Audio mixing enabled: TTS will be muted during SOURCE_CLIP shots")
                    self._mix_audio_with_source_clips(
                        audio_path=Path(_tts_audio),
                        words_json_path=Path(_words_path),
                        timeline_path=timeline_path,
                        run_dir=run_dir,
                    )
            elif _iv_audio_pref == "tts" and self._input_video_contexts:
                print("🎵 TTS plays continuously during SOURCE_CLIP shots (mute_tts_on_source_clips=False)")

        avatar_video_path = None
        if do_avatar:
            if content_type == "VIDEO":
                print("👤 Starting AVATAR stage...")
                avatar_video_path = self._generate_avatar_runpod(run_dir)
            else:
                print(f"⏩ Skipping AVATAR stage (content_type={content_type} is not VIDEO)")

        if do_render:
            print("🎥 Rendering final video with Playwright...")
            
            # Get background color from style guide
            style_guide_path = run_dir / "style_guide.json"
            if style_guide_path.exists():
                saved_style = json.loads(style_guide_path.read_text())
                render_bg_color = saved_style.get("palette", {}).get("background", "#000000")
            else:
                # Use preset based on background_type
                preset = BACKGROUND_PRESETS.get(background_type, BACKGROUND_PRESETS["black"])
                render_bg_color = preset["background"]
            
            
            video_path = self._render_video(
                audio_path=tts_outputs.get("audio_path") or audio_path,
                timeline_path=timeline_path,
                words_json_path=word_outputs.get("words_json") or words_json,
                run_dir=run_dir,
                avatar_video_path=run_dir / "avatar_video.mp4" if (run_dir / "avatar_video.mp4").exists() else None,
                show_captions=show_captions,
                background_color=render_bg_color,
            )
        else:
            video_path = None

        # Token totals are emitted; cost estimation is the service layer's job
        # (it has DB access to the canonical ai_models pricing table).
        total_usage["model"] = getattr(
            self.html_client, "current_model", self.html_client.default_model
        )
        print(f"📊 Generation token totals: "
              f"{total_usage.get('prompt_tokens', 0):,} in / "
              f"{total_usage.get('completion_tokens', 0):,} out tokens, "
              f"{total_usage.get('image_count', 0)} images, "
              f"{total_usage.get('tts_character_count', 0):,} TTS chars")

        return {
            "run_dir": run_dir,
            "script_path": script_plan["script_path"],
            "voice_json": tts_outputs.get("response_json"),
            "audio_path": tts_outputs.get("audio_path"),
            "words_json": word_outputs.get("words_json"),
            "words_csv": word_outputs.get("words_csv", words_csv),
            "alignment_json": word_outputs.get("alignment_json", alignment_json),
            "timeline_json": timeline_path,
            "avatar_video_path": avatar_video_path,
            "video_path": video_path,
            "token_usage": total_usage,
        }

    # --- Script generation -------------------------------------------------
    def _draft_script(
        self, 
        base_prompt: str, 
        run_dir: Path, 
        language: str = "English", 
        target_audience: str = "General/Adult", 
        target_duration: str = "2-3 minutes",
        content_type: str = "VIDEO"
    ) -> Dict[str, Any]:
        """
        Generate a script or content plan based on the content type.
        
        For VIDEO: Generates a narration script for TTS
        For QUIZ: Generates quiz questions and answers
        For STORYBOOK: Generates page-by-page story with illustrations
        For INTERACTIVE_GAME: Generates game data and logic
        etc.
        """
        # Get content-type-specific prompts if available
        ct_prompts = get_content_type_prompts(content_type)
        
        if content_type == "VIDEO" or not ct_prompts.get("system"):
            # Use existing VIDEO prompts
            system_prompt = get_script_system_prompt(
                getattr(self, 'video_width', 1920),
                getattr(self, 'video_height', 1080)
            )
            _aspect = getattr(self, 'aspect_label', '16:9 landscape')
            user_prompt = SCRIPT_USER_PROMPT_TEMPLATE.format(
                base_prompt=base_prompt.strip(),
                language=language,
                target_audience=target_audience,
                target_duration=target_duration,
                aspect_label=_aspect,
            ).strip()

            # Detect if user's prompt already contains a script (NARRATOR lines,
            # scene markers, V.O., timing). If so, prepend a strong instruction
            # to use it AS-IS rather than invent new content.
            import re as _re_script
            _script_markers = [
                r"NARRATOR\s*\(?V?\.?O?\.?\)?\s*:",
                r"\[\s*OPENING",
                r"\[\s*CLOSING",
                r"\[\s*SCENE",
                r"\bV\.O\.",
                r"\bVOICEOVER\b",
                r"SCRIPT\s*\n",
                r"SHOT\s*LIST",
                r"\d{1,2}:\d{2}\s*[-–—]",  # timing like "0:08-0:20"
            ]
            _has_script = any(
                _re_script.search(p, base_prompt, flags=_re_script.IGNORECASE)
                for p in _script_markers
            )
            # Also treat very long prompts (>800 chars) with structure as user-authored
            _is_long_structured = len(base_prompt) > 800 and "\n\n" in base_prompt

            if _has_script or _is_long_structured:
                print("📝 Detected user-authored script in prompt — prioritizing verbatim usage")
                _priority_block = (
                    "\n\n🚨 CRITICAL INSTRUCTION: The user has provided a COMPLETE SCRIPT "
                    "or highly-structured content above. Your job is to EXTRACT and USE "
                    "the narration content from their input — NOT to invent new narration.\n\n"
                    "RULES:\n"
                    "1. If the input has NARRATOR / V.O. / voiceover lines, use THOSE as the script.\n"
                    "2. Strip scene markers like [OPENING], [CLOSING], timing (0:00–0:08), "
                    "SHOT LIST, and stage directions — these are for the Director, not the narrator.\n"
                    "3. Keep the user's WORDING and TONE — don't rewrite sentences to be more "
                    "'marketing-friendly' or 'concise'. The user chose those words deliberately.\n"
                    "4. Maintain the sequence/structure of their script. Don't reorder sections.\n"
                    "5. The user's content takes priority over your own creative instincts.\n"
                    "6. Only generate new content if a section has no narration specified.\n"
                )
                user_prompt = user_prompt + _priority_block

            # Host-led narration — 1st-person rewrite when host=avatar.
            # Skipped on host=raw (script comes from input video transcripts).
            if getattr(self, "_host_enabled", False) and getattr(self, "_host_type", "") == "avatar":
                _host_details = (
                    (self._host_plan.get("avatar") or {}).get("details_prompt") or ""
                ).strip()
                _host_block = (
                    "\n\n🎙️ HOST-LED NARRATION (1ST PERSON):\n"
                    "This video is delivered by an on-screen host who speaks every line. "
                    "Write the narration as the host speaking DIRECTLY to the viewer.\n"
                    "RULES:\n"
                    "- Use 1st-person voice: 'I', 'we', 'let me show you', 'I'll walk you through'.\n"
                    "- Avoid 3rd-person framing: 'the speaker says…', 'we'll see how…', 'this video covers…'.\n"
                    "- The host IS the narration — make their voice present, warm, and conversational.\n"
                    "- Do not write stage directions, scene markers, or 3rd-person summaries — that's the Director's job.\n"
                    "- Keep the narration self-contained: the host should be able to read it cold without external cues.\n"
                )
                if _host_details:
                    _host_block += (
                        f"- Host context (clothing / setting / persona): {_host_details}\n"
                        "  Use this only to keep tone consistent — don't describe their appearance in narration.\n"
                    )
                user_prompt = user_prompt + _host_block
        else:
            # Use content-type-specific prompts
            system_prompt = ct_prompts["system"]
            
            # Format user prompt with all available parameters
            defaults = ct_prompts.get("defaults", {})
            # Resolve institute style (used by SLIDES and future styled content types)
            _style = self._current_style_config or {}
            user_prompt = ct_prompts["user_template"].format(
                base_prompt=base_prompt.strip(),
                language=language,
                target_audience=target_audience,
                target_duration=target_duration,
                # Content-type-specific defaults
                question_count=defaults.get("question_count", 10),
                page_count=defaults.get("page_count", 12),
                card_count=defaults.get("card_count", 20),
                puzzle_count=defaults.get("puzzle_count", 5),
                game_type=defaults.get("game_type", "memory_match"),
                illustration_style=defaults.get("illustration_style", "watercolor"),
                puzzle_types=defaults.get("puzzle_types", "crossword"),
                simulation_type=defaults.get("simulation_type", "physics"),
                map_type=defaults.get("map_type", "geographic"),
                # New content type parameters
                worksheet_type=defaults.get("worksheet_type", "practice_problems"),
                programming_language=defaults.get("programming_language", "javascript"),
                difficulty_level=defaults.get("difficulty_level", "beginner"),
                exercise_count=defaults.get("exercise_count", 5),
                event_count=defaults.get("event_count", 10),
                timeline_type=defaults.get("timeline_type", "historical"),
                time_period=defaults.get("time_period", "auto"),
                scenario_type=defaults.get("scenario_type", "role_play"),
                exchange_count=defaults.get("exchange_count", 8),
                # SLIDES slide-count defaults
                slide_count_short=defaults.get("slide_count_short", 6),
                slide_count_medium=defaults.get("slide_count_medium", 10),
                slide_count_long=defaults.get("slide_count_long", 15),
                # Institute style (used by SLIDES; ignored by other templates)
                primary_color=_style.get("primary_color", "#6366f1"),
                heading_font=_style.get("heading_font", "Inter"),
                body_font=_style.get("body_font", "Inter"),
                background_type=_style.get("background_type", "white"),
                layout_theme=_style.get("layout_theme", "clean_light"),
            ).strip()
            
        # ── Inject reference material context into the script prompt ──
        if getattr(self, '_reference_context', None):
            ref_text = self._reference_context.get("text_context", "")
            if ref_text:
                # Truncate to avoid exceeding context limits (keep first ~8000 chars)
                if len(ref_text) > 8000:
                    ref_text = ref_text[:8000] + "\n... [truncated]"
                user_prompt += (
                    "\n\n**📎 REFERENCE MATERIALS PROVIDED BY THE USER:**\n"
                    f"{ref_text}\n\n"
                    "Use the above reference material to inform your content. "
                    "Include relevant facts, data, and concepts from these materials. "
                    "The reference materials are the primary source of truth for this content."
                )
                print(f"📎 Injected {len(ref_text)} chars of reference context into script prompt")

        print(f"📝 Generating {content_type} content...")

        # Retry up to 3 times if we get invalid JSON
        max_attempts = 3
        last_error = None
        for attempt in range(max_attempts):
            try:
                # SLIDES needs a large token budget: each slide has rich HTML (inline SVGs,
                # styles) that must be JSON-escaped, so 10 slides ≈ 20 000–30 000 tokens.
                _max_tokens = 32000 if content_type == "SLIDES" else self._tier_config.get("script_max_tokens", 16000)
                raw, usage = self.script_client.chat(
                    messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
                    temperature=self._tier_config.get("script_temperature", 0.5),
                    max_tokens=_max_tokens,
                )
                data = _extract_json_blob(raw)
                break  # Success
            except ValueError as e:
                last_error = e
                print(f"⚠️ JSON extraction failed (attempt {attempt + 1}/{max_attempts}): {e}")
                time.sleep(2)
        else:
            raise last_error
        
        # Handle different content type outputs
        if content_type == "VIDEO":
            # Standard video script extraction
            script_text = str(data.get("script") or data.get("script_text") or "").strip()
            if not script_text:
                # fallback for older responses with segments
                segments = data.get("segments") or []
                script_parts: List[str] = []
                for seg in segments:
                    part = seg.get("script", "").strip()
                    if part:
                        script_parts.append(part)
                script_text = "\n\n".join(script_parts).strip()
            if not script_text:
                raise RuntimeError("Script model did not return usable narration text.")
        elif content_type == "QUIZ":
            # Extract quiz questions for TTS narration (read questions aloud)
            questions = data.get("questions", [])
            script_parts = []
            for i, q in enumerate(questions, 1):
                # Extract question text from HTML or text field
                q_text = q.get("question_text", "")
                if not q_text and "question_html" in q:
                    # Try to extract text from HTML (simplified)
                    import re
                    q_text = re.sub(r'<[^>]+>', '', q.get("question_html", ""))
                if q_text:
                    script_parts.append(f"Question {i}. {q_text}")
                    # Read options for audio
                    for opt in q.get("options", []):
                        script_parts.append(f"Option {opt.get('id', '').upper()}. {opt.get('text', '')}")
            script_text = "\n\n".join(script_parts) if script_parts else data.get("title", "Quiz")
        elif content_type == "STORYBOOK":
            # Extract page text for TTS narration
            pages = data.get("pages", [])
            script_parts = [data.get("title", "")]
            for page in pages:
                audio_text = page.get("audio_text") or page.get("text", "")
                if audio_text:
                    script_parts.append(audio_text)
            script_text = "\n\n".join(script_parts).strip()
        elif content_type in ["INTERACTIVE_GAME", "SIMULATION"]:
            # Games/simulations may have minimal or no narration
            script_text = data.get("title", content_type) + ". " + data.get("instructions", data.get("description", ""))
        elif content_type == "PUZZLE_BOOK":
            # Read puzzle titles + instructions so TTS covers the full book
            puzzles = data.get("puzzles", [])
            script_parts = [data.get("title", "Puzzle Book")]
            for i, p in enumerate(puzzles, 1):
                title = p.get("title", f"Puzzle {i}")
                instructions = p.get("instructions", "")
                script_parts.append(f"Puzzle {i}. {title}. {instructions}" if instructions else f"Puzzle {i}. {title}")
            script_text = "\n\n".join(script_parts)
        elif content_type == "FLASHCARDS":
            # Read all cards so word timestamps cover the full deck (needed for per-page audio seek)
            cards = data.get("cards", [])
            script_parts = [data.get("deck_title", "Flashcard Deck")]
            for card in cards:
                script_parts.append(f"Card. {card.get('front_text', 'Question')}. Answer. {card.get('back_text', 'Answer')}")
            script_text = "\n\n".join(script_parts)
        elif content_type == "WORKSHEET":
            # Extract worksheet title and section instructions for audio
            script_parts = [data.get("title", "Worksheet")]
            instructions = data.get("instructions", "")
            if instructions:
                script_parts.append(instructions)
            # Read first few questions as examples
            sections = data.get("sections", [])
            for section in sections[:2]:  # Limit to first 2 sections
                section_title = section.get("section_title", "")
                if section_title:
                    script_parts.append(section_title)
                section_instructions = section.get("section_instructions", "")
                if section_instructions:
                    script_parts.append(section_instructions)
            script_text = "\n\n".join(script_parts)
        elif content_type == "CODE_PLAYGROUND":
            # Code playgrounds are self-contained - minimal audio needed
            script_parts = [data.get("title", "Code Playground")]
            description = data.get("description", "")
            if description:
                script_parts.append(description)
            # Read first exercise instructions
            exercises = data.get("exercises", [])
            if exercises and len(exercises) > 0:
                first_ex = exercises[0]
                script_parts.append(f"Exercise 1. {first_ex.get('title', '')}")
                script_parts.append(first_ex.get("instructions", ""))
            script_text = "\n\n".join(script_parts)
        elif content_type == "TIMELINE":
            # Read all events so word timestamps cover every entry (needed for per-entry audio seek)
            script_parts = [data.get("title", "Timeline")]
            description = data.get("description", "")
            if description:
                script_parts.append(description)
            events = data.get("events", [])
            for event in events:
                date_display = event.get("date_display", event.get("date", ""))
                title = event.get("title", "")
                desc = event.get("description", "")
                if title:
                    script_parts.append(f"{date_display}. {title}. {desc}")
            script_text = "\n\n".join(script_parts)
        elif content_type == "CONVERSATION":
            # Read all exchanges so word timestamps cover the full dialogue
            script_parts = [data.get("title", "Conversation Practice")]
            scenario = data.get("scenario", "")
            if scenario:
                script_parts.append(f"Scenario: {scenario}")
            exchanges = data.get("exchanges", [])
            for ex in exchanges:
                speaker_name = ex.get("speaker_name", "Speaker")
                speech = ex.get("audio_text", ex.get("speech_text", ""))
                if speech:
                    script_parts.append(f"{speaker_name} says: {speech}")
            script_text = "\n\n".join(script_parts)
        elif content_type == "MAP_EXPLORATION":
            # Read region names + descriptions so TTS covers the full map
            script_parts = [data.get("title", "Map Exploration")]
            description = data.get("description", "")
            if description:
                script_parts.append(description)
            for region in data.get("regions", []):
                name = region.get("name", "")
                info = region.get("info", {})
                desc = info.get("description", "") if isinstance(info, dict) else ""
                if name:
                    script_parts.append(f"{name}. {desc}" if desc else name)
            script_text = "\n\n".join(script_parts)
        elif content_type == "SLIDES":
            # SLIDES are purely visual — no TTS needed. Store a minimal placeholder.
            script_text = data.get("presentation_title", "Presentation")
        else:
            # Default fallback
            script_text = data.get("script", data.get("title", content_type))

        # Store the content type in the plan for later stages
        data["_content_type"] = content_type

        # Repair beat narration splits — LLMs frequently skip/duplicate sentences
        if content_type == "VIDEO":
            data = self._repair_beat_narrations(data, script_text)

        plan_path = run_dir / "script_plan.json"
        plan_path.write_text(json.dumps(data, indent=2))
        script_path = run_dir / "script.txt"
        script_path.write_text(script_text + "\n")
        return {"result": {"plan": data, "script_path": script_path, "script_text": script_text}, "usage": usage}

    @staticmethod
    def _repair_beat_narrations(data: Dict[str, Any], script_text: str) -> Dict[str, Any]:
        """Programmatically repair beat narration fields so they exactly cover the full script.

        LLMs frequently skip sentences, duplicate content, or mis-split narration across beats.
        This method checks whether concatenating all beat narrations reproduces the script text.
        If not, it re-splits the script across beats using sentence-boundary matching so that
        downstream beat-based segmentation stays accurate.

        The repair is lossless — every word of the original script is preserved.
        """
        beats = data.get("beat_outline", [])
        if not beats or not script_text:
            return data

        # Normalize whitespace for comparison
        def _norm(s: str) -> str:
            return " ".join(s.split())

        full_script_norm = _norm(script_text)
        concat_narrations = _norm(" ".join(b.get("narration", "") for b in beats))

        # If they already match (within whitespace), no repair needed
        if concat_narrations == full_script_norm:
            return data

        print(f"   🔧 Beat narrations don't match script ({len(concat_narrations)} vs {len(full_script_norm)} chars) — repairing...")

        # Split script into sentences (preserving punctuation)
        import re as _re
        sentences = _re.split(r'(?<=[.!?])\s+', script_text.strip())
        sentences = [s.strip() for s in sentences if s.strip()]

        if not sentences:
            return data

        num_beats = len(beats)

        # Strategy: distribute sentences across beats proportionally.
        # Each beat's existing narration length (or equal share) determines its share of sentences.
        # This preserves the LLM's intended pacing as much as possible.
        existing_lengths = []
        for b in beats:
            narr = b.get("narration", "").strip()
            existing_lengths.append(len(narr) if narr else 1)  # minimum 1 to avoid division by zero

        total_len = sum(existing_lengths)
        # Calculate target sentence count per beat (at least 1 each)
        target_counts = []
        remaining_sentences = len(sentences)
        for i, length in enumerate(existing_lengths):
            if i == num_beats - 1:
                # Last beat gets all remaining
                target_counts.append(remaining_sentences)
            else:
                share = max(1, round(len(sentences) * length / total_len))
                share = min(share, remaining_sentences - (num_beats - i - 1))  # leave at least 1 per remaining beat
                target_counts.append(share)
                remaining_sentences -= share

        # Assign sentences to beats
        idx = 0
        for beat_idx, beat in enumerate(beats):
            count = target_counts[beat_idx]
            beat_sentences = sentences[idx:idx + count]
            beat["narration"] = " ".join(beat_sentences)
            idx += count

        # Verify repair
        repaired_concat = _norm(" ".join(b.get("narration", "") for b in beats))
        if repaired_concat == full_script_norm:
            print(f"   ✅ Beat narrations repaired successfully ({num_beats} beats, {len(sentences)} sentences)")
        else:
            print(f"   ⚠️ Beat narration repair approximate — sentence splitting may not perfectly match script whitespace")

        data["beat_outline"] = beats
        return data

    def _review_script(
        self,
        script_data: Dict[str, Any],
        run_dir: Path,
    ) -> Dict[str, Any]:
        """Two-pass script review — improves transitions, hook, analogies, pacing.

        Only called when tier_config["two_pass_script"] is True (Premium/Ultra).
        Returns improved script_data with the same JSON structure.
        """
        print("🔍 Running two-pass script review (Premium/Ultra tier)...")
        script_json_str = json.dumps(script_data, indent=2, ensure_ascii=False)

        try:
            raw, usage = self.script_client.chat(
                messages=[
                    {"role": "system", "content": SCRIPT_REVIEW_SYSTEM_PROMPT},
                    {"role": "user", "content": SCRIPT_REVIEW_USER_PROMPT_TEMPLATE.format(
                        script_json=script_json_str
                    )},
                ],
                temperature=0.5,
                max_tokens=32000,
            )
            reviewed = _extract_json_blob(raw)

            # Ensure critical fields survived the review
            if not reviewed.get("script") and not reviewed.get("script_text"):
                print("⚠️ Script review returned empty script — keeping original.")
                return script_data

            # Preserve fields that the review shouldn't touch
            reviewed.setdefault("_content_type", script_data.get("_content_type"))

            # Save reviewed plan
            reviewed_path = run_dir / "script_plan_reviewed.json"
            reviewed_path.write_text(json.dumps(reviewed, indent=2, ensure_ascii=False))

            # Update script.txt with reviewed narration
            reviewed_script = str(reviewed.get("script") or reviewed.get("script_text") or "").strip()
            if reviewed_script:
                script_path = run_dir / "script.txt"
                script_path.write_text(reviewed_script + "\n")

            print("✅ Script review complete — using improved version.")
            return reviewed
        except Exception as e:
            print(f"⚠️ Script review failed ({e}) — keeping original script.")
            return script_data

    @staticmethod
    def _validate_html_segment(html_str: str, expected_shot_type: str = "") -> Tuple[bool, List[str]]:
        """Validate generated HTML for structural correctness.

        Returns (is_valid, list_of_issues).
        """
        issues: list[str] = []
        if not html_str or len(html_str.strip()) < 50:
            issues.append("HTML is empty or too short (< 50 chars).")
            return False, issues

        # Check for unclosed script tags (common LLM mistake)
        open_scripts = html_str.lower().count("<script")
        close_scripts = html_str.lower().count("</script>")
        if open_scripts != close_scripts:
            issues.append(f"Mismatched <script> tags: {open_scripts} open vs {close_scripts} close.")

        # Check image shots have data-img-prompt
        if expected_shot_type in ("IMAGE_HERO", "IMAGE_SPLIT", "ANNOTATION_MAP"):
            if "data-img-prompt" not in html_str:
                issues.append(f"Shot type {expected_shot_type} expected a <img data-img-prompt=...> but none found.")

        # Check Mermaid syntax (basic: must have at least one arrow or node)
        if "<div class='mermaid'" in html_str or '<div class="mermaid"' in html_str:
            # Ensure it contains actual diagram content, not empty
            mermaid_match = re.search(r"class=['\"]mermaid['\"][^>]*>(.*?)</div>", html_str, re.DOTALL)
            if mermaid_match:
                content = mermaid_match.group(1).strip()
                if len(content) < 10:
                    issues.append("Mermaid diagram block is nearly empty.")

        # Check KaTeX delimiters are paired
        dollar_count = html_str.count("$$")
        if dollar_count % 2 != 0:
            issues.append(f"Unpaired $$ delimiters (found {dollar_count} — should be even).")

        return (len(issues) == 0, issues)

    def _repair_html_segment(
        self,
        html_str: str,
        issues: List[str],
        original_user_prompt: str,
    ) -> Tuple[str, Dict[str, Any]]:
        """Attempt a single LLM repair pass on invalid HTML.

        Returns repaired HTML string and token usage.
        """
        print(f"    🔧 Attempting HTML repair for issues: {issues}")
        repair_prompt = (
            "The following HTML segment has issues that need fixing:\n\n"
            f"**Issues found:**\n" + "\n".join(f"- {i}" for i in issues) + "\n\n"
            f"**Current HTML:**\n```html\n{html_str[:6000]}\n```\n\n"
            "Fix ONLY the listed issues. Return the corrected HTML only — no JSON wrapper, no explanation."
        )
        total_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        try:
            raw, _usage = self.html_client.chat(
                messages=[
                    {"role": "system", "content": "You are an HTML/CSS repair assistant. Fix the issues and return corrected HTML only."},
                    {"role": "user", "content": repair_prompt},
                ],
                temperature=0.3,
                max_tokens=8000,
            )
            if _usage:
                total_usage["prompt_tokens"] += _usage.get("prompt_tokens", 0)
                total_usage["completion_tokens"] += _usage.get("completion_tokens", 0)
                total_usage["total_tokens"] += _usage.get("total_tokens", 0)
            repaired = raw.strip()
            # Strip markdown code fences if present
            if repaired.startswith("```"):
                repaired = re.sub(r"^```(?:html)?\n?", "", repaired)
                repaired = re.sub(r"\n?```$", "", repaired)
            if len(repaired) > 50:
                print("    ✅ HTML repair successful.")
                return repaired, total_usage
        except Exception as e:
            print(f"    ⚠️ HTML repair failed: {e}")
        return html_str, total_usage

    # --- Google TTS bridge -------------------------------------------------
    # --- Edge TTS bridge (Free, Timed) -------------------------------------------------
    @retry_with_backoff(max_retries=3, initial_delay=2.0)
    def _synthesize_voice(
        self, 
        script_path: Path,
        run_dir: Path,
        language: str = "English",
        voice_gender: str = "female",
        tts_provider: str = "standard",
        voice_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        # Map new tier names to internal provider keys
        # "standard" → edge, "premium" → sarvam (Indian) or google (global)
        # Legacy values "edge"/"google" still supported for backward compatibility
        lang_key = language.lower().strip()
        gender_key = voice_gender.lower().strip()
        if gender_key not in ["male", "female"]:
            gender_key = "female"

        tier = tts_provider.lower().strip()
        if tier == "premium":
            # Route Indian languages → Sarvam, global → Google.
            # Languages Google doesn't support (see GOOGLE_UNSUPPORTED_LANGUAGES)
            # degrade to Edge to avoid synth failures — the endpoint's
            # /tts/voices response also reflects this fallback.
            if lang_key in INDIAN_LANGUAGES:
                provider_key = "sarvam"
            elif lang_key in GOOGLE_UNSUPPORTED_LANGUAGES:
                print(f"    ℹ️  Premium requested for '{language}', but Google TTS has no voices for it. Falling back to Edge TTS.")
                provider_key = "edge"
            else:
                provider_key = "google"
        elif tier in ("standard", "edge"):
            provider_key = "edge"
        elif tier == "google":
            provider_key = "google"
        elif tier == "sarvam":
            provider_key = "sarvam"
        else:
            provider_key = "edge"

        print(f"🗣️  Synthesizing narration (tier={tier}, provider={provider_key}) - {language} [{voice_gender}]...")

        # Ensure local deps are available
        if str(LOCAL_DEPS_DIR) not in sys.path:
            sys.path.insert(0, str(LOCAL_DEPS_DIR))

        import asyncio
        import edge_tts
        from edge_tts import submaker

        response_json = run_dir / "narration_raw.json"
        audio_path = run_dir / "narration.mp3"
        script_text = script_path.read_text().strip()

        # --- Sarvam AI TTS Path (premium, Indian languages) ---
        if provider_key == "sarvam":
            try:
                return self._synthesize_voice_sarvam(
                    script_text=script_text,
                    run_dir=run_dir,
                    response_json=response_json,
                    audio_path=audio_path,
                    language=language,
                    voice_gender=gender_key,
                    voice_id=voice_id,
                )
            except Exception as sarvam_err:
                print(f"    ⚠️  Sarvam TTS failed: {sarvam_err}")
                print(f"    🔄 Falling back to Edge TTS...")
                provider_key = "edge"
                # Fall through to Edge TTS path below

        # --- Voice Selection Logic (Edge / Google) ---
        # Fallback to English if language not found
        if lang_key not in VOICE_MAPPING:
             print(f"    ⚠️  Language '{language}' not found in mapping, falling back to 'english'")
             lang_key = "english"

        # For Google premium, allow voice_id override
        edge_or_google = "google" if provider_key == "google" else "edge"

        # Select voice
        if voice_id and provider_key == "google":
            selected_voice = voice_id
            print(f"    🗣️  Using explicit voice_id: {selected_voice}")
        else:
            try:
                selected_voice = VOICE_MAPPING[lang_key][edge_or_google][gender_key]
            except KeyError:
                # Deep fallback
                selected_voice = VOICE_MAPPING["english"][edge_or_google][gender_key]

        print(f"    🗣️  Voice: {selected_voice} (Provider: {provider_key}, Lang: {language})")

        # --- Google TTS Path ---
        if provider_key == "google":
            credentials_path = REPO_ROOT / "google_credentials.json"
            credentials_json = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON")
            
            gc_client = None
            if credentials_path.exists():
                gc_client = GoogleCloudTTSClient(credentials_path=str(credentials_path))
            elif credentials_json:
                gc_client = GoogleCloudTTSClient(credentials_json=credentials_json)
            else:
                 raise RuntimeError(
                     "Google TTS requested but no credentials found.\n"
                     "1. Place 'google_credentials.json' in ai-video-gen-main/ directory OR\n"
                     "2. Set 'GOOGLE_APPLICATION_CREDENTIALS_JSON' env var with content."
                 )
            
            try:
                # Pass explicit voice name and verify language code from voice name (e.g. en-US-Journey-F -> en-US)
                lang_code_parts = selected_voice.split("-")
                lang_code = f"{lang_code_parts[0]}-{lang_code_parts[1]}"
                
                gc_client.synthesize(
                    text=script_text,
                    output_path=audio_path,
                    raw_json_path=response_json,
                    voice_name=selected_voice,
                    language_code=lang_code
                )
                print(f"    ✅ Google TTS generation successful.")
                return {"response_json": response_json, "audio_path": audio_path, "tts_character_count": len(script_text)}
            except Exception as e:
                print(f"    ❌ Google TTS failed: {e}")
                raise e

        # --- Edge TTS Path ---
        # Default behavior: Use EdgeTTS with selected voice

        async def _run_tts():
            communicate = edge_tts.Communicate(script_text, selected_voice)
            audio_data = bytearray()
            word_entries = []
            # Always initialise SubMaker and feed it on the FIRST (and only) pass.
            # If WordBoundary events are absent for this voice/language, SubMaker
            # will already hold all the data — no second network round-trip needed.
            tts_submaker = edge_tts.SubMaker()
            chunk_count = 0
            max_chunks = min(len(script_text) * 100, 50000)
            max_timeout = min(300, max(180, len(script_text) * 0.05))

            print(f"    ℹ️  EdgeTTS Processing script of length: {len(script_text)} "
                  f"(timeout: {max_timeout:.0f}s, chunk cap: {max_chunks})")

            stream_timed_out = False

            async def _stream_first_pass():
                nonlocal chunk_count
                async for chunk in communicate.stream():
                    chunk_count += 1
                    if chunk_count % 500 == 0:
                        print(f"    ℹ️  Processed {chunk_count} chunks (max: {max_chunks})...")
                    if chunk_count > max_chunks:
                        print(f"    ⚠️  Reached chunk limit ({max_chunks}). Stopping stream.")
                        break
                    if chunk["type"] == "audio":
                        audio_data.extend(chunk["data"])
                    elif chunk["type"] == "WordBoundary":
                        start_s = chunk["offset"] / 1e7
                        dur_s   = chunk["duration"] / 1e7
                        word_entries.append({
                            "word":  chunk["text"],
                            "start": start_s,
                            "end":   start_s + dur_s,
                        })
                        tts_submaker.feed(chunk)
                    elif chunk["type"] == "SentenceBoundary":
                        tts_submaker.feed(chunk)

            try:
                await asyncio.wait_for(_stream_first_pass(), timeout=max_timeout)
                print(f"    ✅ Stream completed ({chunk_count} chunks)")
            except asyncio.TimeoutError:
                print(f"    ⚠️  Stream timed out after {max_timeout:.0f}s. Using partial audio.")
                stream_timed_out = True

            chars  = []
            starts = []
            ends   = []

            if word_entries:
                # ── Normal path: WordBoundary events received ──────────────────
                print(f"    ✅ Captured {len(word_entries)} words from WordBoundary events.")

                # ── Gap detection: Hindi and other non-Latin languages may have
                #    incomplete WordBoundary events (Edge TTS bug).  If a gap
                #    exceeds 10 s or total coverage is < 50 %, fall back to
                #    Whisper forced alignment for the full audio. ──────────────
                _sorted_we = sorted(word_entries, key=lambda _w: _w["start"])
                _max_gap = 0.0
                for _gi in range(1, len(_sorted_we)):
                    _gap = _sorted_we[_gi]["start"] - _sorted_we[_gi - 1]["end"]
                    _max_gap = max(_max_gap, _gap)
                _covered = sum(w["end"] - w["start"] for w in word_entries)
                _est_dur = len(audio_data) / 16000.0  # rough MP3 estimate

                if _max_gap > 10.0 or (_est_dur > 5 and _covered / _est_dur < 0.50):
                    print(f"    ⚠️  WordBoundary gaps detected (max_gap={_max_gap:.1f}s, "
                          f"coverage={_covered:.1f}s / ~{_est_dur:.1f}s). "
                          f"Falling back to Whisper forced alignment...")
                    import tempfile as _tmpmod
                    _tmp_audio = _tmpmod.NamedTemporaryFile(suffix=".mp3", delete=False)
                    _tmp_audio.write(audio_data)
                    _tmp_audio.close()
                    _whisper_ok = False
                    try:
                        _whisper_words = _whisper_align(Path(_tmp_audio.name), language)
                        if _whisper_words and len(_whisper_words) > len(word_entries):
                            word_entries = _whisper_words
                            _whisper_ok = True
                            print(f"    ✅ Replaced EdgeTTS words with {len(word_entries)} Whisper words")
                        else:
                            print(f"    ℹ️  Whisper returned {len(_whisper_words) if _whisper_words else 0} words "
                                  f"(EdgeTTS had {len(word_entries)})")
                    finally:
                        os.unlink(_tmp_audio.name)

                    # If Whisper failed or returned wrong language, use linear
                    # interpolation based on script text + estimated audio duration
                    if not _whisper_ok:
                        print(f"    🔄 Using linear interpolation on script text "
                              f"(~{_est_dur:.0f}s estimated audio)...")
                        import re as _lre
                        _words_list = _lre.findall(r'\S+', script_text)
                        if _words_list and _est_dur > 0:
                            # Distribute words evenly across the audio duration
                            _per_word = _est_dur / len(_words_list)
                            _lin_entries = []
                            for _wi, _wt in enumerate(_words_list):
                                _ws = _wi * _per_word
                                _we_t = _ws + _per_word * 0.85  # small gap between words
                                _lin_entries.append({
                                    "word": _wt,
                                    "start": round(_ws, 3),
                                    "end": round(_we_t, 3),
                                })
                            word_entries = _lin_entries
                            print(f"    ✅ Generated {len(word_entries)} linear word timestamps")

                for w in word_entries:
                    word_str = w["word"]
                    w_start  = w["start"]
                    w_end    = w["end"]
                    w_dur    = w_end - w_start
                    if not word_str:
                        continue
                    char_dur = w_dur / len(word_str)
                    for i, char in enumerate(word_str):
                        c_start = w_start + (i * char_dur)
                        c_end   = c_start + char_dur
                        chars.append(char)
                        starts.append(round(c_start, 3))
                        ends.append(round(c_end, 3))
                    chars.append(" ")
                    starts.append(round(w_end, 3))
                    ends.append(round(w_end, 3))

            else:
                # ── Fallback: SubMaker already fed — no re-run needed ──────────
                print("    ⚠️  No WordBoundary events — using SubMaker SRT (single-pass, no re-run).")
                vtt_content = ""
                if not stream_timed_out:
                    try:
                        print("    ℹ️  Generating SRT from SubMaker...")
                        with concurrent.futures.ThreadPoolExecutor() as _ex:
                            _fut = _ex.submit(tts_submaker.get_srt)
                            try:
                                vtt_content = _fut.result(timeout=30)
                                print(f"    ✅ SubMaker generated {len(vtt_content)} chars of SRT")
                            except concurrent.futures.TimeoutError:
                                print("    ⚠️  SubMaker.get_srt() timed out after 30s.")
                    except Exception as e:
                        print(f"    ⚠️  SubMaker.get_srt() failed: {e}")

                if vtt_content:
                    # Parse SRT into char-level timestamps
                    import re as _re
                    _time_pat = _re.compile(r"(\d{2}):(\d{2}):(\d{2})[,.](\d{3})")

                    def _parse_time(t_str):
                        m = _time_pat.match(t_str)
                        if not m:
                            return 0.0
                        h, mi, s, ms = map(int, m.groups())
                        return h * 3600 + mi * 60 + s + ms / 1000.0

                    srt_lines = vtt_content.splitlines()
                    for i, line in enumerate(srt_lines):
                        if "-->" not in line:
                            continue
                        parts = line.split("-->")
                        seg_start = _parse_time(parts[0].strip())
                        seg_end   = _parse_time(parts[1].strip())
                        text_acc  = ""
                        j = i + 1
                        while j < len(srt_lines) and srt_lines[j].strip():
                            text_acc += srt_lines[j].strip() + " "
                            j += 1
                        text_line = text_acc.strip()
                        if not text_line:
                            continue
                        seg_len  = seg_end - seg_start
                        char_len = len(text_line)
                        if char_len > 0:
                            per_char = seg_len / char_len
                            for k, char in enumerate(text_line):
                                c_s = seg_start + k * per_char
                                chars.append(char)
                                starts.append(round(c_s, 3))
                                ends.append(round(c_s + per_char, 3))
                            chars.append(" ")
                            starts.append(round(seg_end, 3))
                            ends.append(round(seg_end, 3))
                    if chars:
                        print(f"    ✅ Recovered {len(chars)} chars/timestamps via SRT.")

                if not chars:
                    # Last resort: linear interpolation (~16 chars/s)
                    print("    ⚠️  No timestamps available. Generating mock timestamps "
                          "(sync will be approximate).")
                    t    = 0.0
                    step = 0.06
                    for c in script_text:
                        chars.append(c)
                        starts.append(round(t, 3))
                        t += step
                        ends.append(round(t, 3))

            final_data = {
                "alignment": {
                    "characters":                    chars,
                    "character_start_times_seconds": starts,
                    "character_end_times_seconds":   ends,
                }
            }
            response_json.write_text(json.dumps(final_data))
            with open(audio_path, "wb") as f:
                f.write(audio_data)

        # Run async code in sync context
        try:
            asyncio.run(_run_tts())
        except Exception as e:
            print(f"⚠️  EdgeTTS failed: {e}")
            credentials_path = REPO_ROOT / "google_credentials.json"
            credentials_json = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON")
            
            if credentials_path.exists() or credentials_json:
                print("    🔄 Falling back to Google Cloud TTS...")
                try:
                    gc_client = None
                    if credentials_path.exists():
                         gc_client = GoogleCloudTTSClient(credentials_path=str(credentials_path))
                    else:
                         gc_client = GoogleCloudTTSClient(credentials_json=credentials_json)

                    # Determine fallback google voice
                    try:
                        fallback_voice = VOICE_MAPPING[lang_key]["google"][gender_key]
                    except KeyError:
                         fallback_voice = VOICE_MAPPING["english"]["google"][gender_key]
                         
                    lang_code_parts = fallback_voice.split("-")
                    lang_code = f"{lang_code_parts[0]}-{lang_code_parts[1]}"
                    
                    gc_client.synthesize(
                        text=script_text, 
                        output_path=audio_path, 
                        raw_json_path=response_json,
                        voice_name=fallback_voice,
                        language_code=lang_code
                    )
                except Exception as e2:
                    print(f"    ❌ Google TTS Fallback also failed: {e2}")
                    raise e  # Raise original EdgeTTS error if fallback fails
            else:
                print("    ❌ No google_credentials.json found or env var set for fallback.")
                raise e
        
        return {"response_json": response_json, "audio_path": audio_path, "tts_character_count": len(script_text)}

    # --- Sarvam AI TTS (premium, Indian languages) -------------------------
    def _synthesize_voice_sarvam(
        self,
        script_text: str,
        run_dir: Path,
        response_json: Path,
        audio_path: Path,
        language: str = "English (India)",
        voice_gender: str = "female",
        voice_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Synthesize narration using Sarvam AI bulbul:v3 TTS.

        Sarvam returns WAV audio (24 kHz). We convert to MP3 for pipeline
        compatibility, then run Whisper forced alignment for word timestamps.
        """
        import asyncio
        import httpx
        import base64

        lang_key = language.lower().strip()
        sarvam_lang = SARVAM_LANG_CODES.get(lang_key, "en-IN")

        # Pick voice: explicit voice_id > default for gender
        if voice_id and voice_id in SARVAM_VOICES.get(voice_gender, []):
            speaker = voice_id
        else:
            speaker = SARVAM_DEFAULT_VOICE.get(voice_gender, "shubh")

        print(f"    🗣️  Sarvam AI voice: {speaker} (lang={sarvam_lang})")

        sarvam_api_key = os.environ.get("SARVAM_API_KEY", "")
        if not sarvam_api_key:
            raise RuntimeError(
                "Sarvam AI TTS requested but SARVAM_API_KEY is not set. "
                "Set it in the environment or .env file."
            )

        # Split text into chunks of ≤500 chars (Sarvam API limit per input string)
        max_chunk = 500
        chunks = []
        remaining = script_text
        while remaining:
            if len(remaining) <= max_chunk:
                chunks.append(remaining)
                break
            # Find last sentence boundary within limit
            cut = remaining[:max_chunk].rfind(". ")
            if cut == -1 or cut < max_chunk // 2:
                cut = remaining[:max_chunk].rfind(" ")
            if cut == -1:
                cut = max_chunk
            else:
                cut += 1  # include the space/period
            chunks.append(remaining[:cut])
            remaining = remaining[cut:].lstrip()

        if len(chunks) > 1:
            print(f"    📄 Script split into {len(chunks)} chunks for Sarvam API")

        async def _call_sarvam():
            all_audio = bytearray()
            headers = {
                "api-subscription-key": sarvam_api_key,
                "Content-Type": "application/json",
            }
            async with httpx.AsyncClient(timeout=60) as client:
                for i, chunk in enumerate(chunks):
                    body = {
                        "inputs": [chunk],
                        "target_language_code": sarvam_lang,
                        "speaker": speaker,
                        "model": "bulbul:v3",
                        "speech_sample_rate": 24000,
                        "enable_preprocessing": True,
                        "output_audio_codec": "mp3",
                    }
                    resp = await client.post(
                        "https://api.sarvam.ai/text-to-speech",
                        headers=headers,
                        json=body,
                    )
                    if resp.status_code != 200:
                        error_body = resp.text[:500] if resp.text else "(empty)"
                        print(f"    ❌ Sarvam API error {resp.status_code}: {error_body}")
                        resp.raise_for_status()
                    data = resp.json()
                    audios = data.get("audios", [])
                    if audios:
                        all_audio.extend(base64.b64decode(audios[0]))
                    if len(chunks) > 1:
                        print(f"    ✅ Chunk {i+1}/{len(chunks)} synthesized")
            return bytes(all_audio)

        print(f"    ⏳ Calling Sarvam TTS API...")
        wav_bytes = asyncio.run(_call_sarvam())
        if not wav_bytes:
            raise RuntimeError("Sarvam TTS returned empty audio")

        print(f"    ✅ Sarvam TTS complete ({len(wav_bytes)} bytes MP3)")

        # Sarvam returns MP3 directly (output_audio_codec: "mp3"), write to file
        with open(audio_path, "wb") as f:
            f.write(wav_bytes)

        # Sarvam does not return word-level timestamps.
        # Use Whisper forced alignment to get word timings.
        whisper_lang = WHISPER_LANG_MAP.get(language.lower().strip(), "en")
        print(f"    🎯 Running Whisper alignment for Sarvam audio (lang={whisper_lang})...")
        word_entries = _whisper_align(audio_path, language)

        if not word_entries:
            # Fallback: linear interpolation
            print(f"    ⚠️  Whisper failed — using linear interpolation")
            import re as _lre
            from mutagen.mp3 import MP3
            try:
                mp3_info = MP3(str(audio_path))
                est_dur = mp3_info.info.length
            except Exception:
                est_dur = len(wav_bytes) / (24000 * 2)  # rough WAV estimate
            words_list = _lre.findall(r'\S+', script_text)
            if words_list and est_dur > 0:
                per_word = est_dur / len(words_list)
                word_entries = [
                    {"word": w, "start": round(i * per_word, 3),
                     "end": round(i * per_word + per_word * 0.85, 3)}
                    for i, w in enumerate(words_list)
                ]
                print(f"    ✅ Generated {len(word_entries)} linear word timestamps")

        # Build character-level alignment (same format as Edge TTS)
        chars, starts, ends = [], [], []
        for w in word_entries:
            word_str = w["word"]
            w_start, w_end = w["start"], w["end"]
            w_dur = w_end - w_start
            if not word_str:
                continue
            char_dur = w_dur / len(word_str)
            for i, char in enumerate(word_str):
                c_start = w_start + i * char_dur
                chars.append(char)
                starts.append(round(c_start, 3))
                ends.append(round(c_start + char_dur, 3))
            chars.append(" ")
            starts.append(round(w_end, 3))
            ends.append(round(w_end, 3))

        final_data = {
            "alignment": {
                "characters": chars,
                "character_start_times_seconds": starts,
                "character_end_times_seconds": ends,
            }
        }
        response_json.write_text(json.dumps(final_data))
        print(f"    ✅ Sarvam TTS pipeline complete (speaker={speaker}, {len(script_text)} chars)")

        return {
            "response_json": response_json,
            "audio_path": audio_path,
            "tts_character_count": len(script_text),
        }

    # --- Alignment + words -------------------------------------------------
    def _parse_timestamps(self, response_json: Path, run_dir: Path) -> Dict[str, Path]:
        words_json = run_dir / "narration.words.json"
        words_csv = run_dir / "narration.words.csv"
        alignment_json = run_dir / "alignment.json"
        python_exe = sys.executable
        cmd = [
            python_exe,
            str(PARSE_TIMESTAMPS_SCRIPT),
            str(response_json),
            str(words_json),
            str(words_csv),
            # Disabled --with-phones to avoid NLTK download blocking
            # Phonemes not needed for basic video playback
            # "--with-phones",
            # "--alignment-json",
            # str(alignment_json),
        ]
        env = os.environ.copy()
        pythonpath_parts = []
        if LOCAL_DEPS_DIR.exists():
            pythonpath_parts.append(str(LOCAL_DEPS_DIR))
        if env.get("PYTHONPATH"):
            pythonpath_parts.append(env["PYTHONPATH"])
        if pythonpath_parts:
            env["PYTHONPATH"] = os.pathsep.join(pythonpath_parts)
        subprocess.run(cmd, check=True, cwd=REPO_ROOT, env=env)
        # Note: alignment_json not generated since --with-phones disabled
        return {"words_json": words_json, "words_csv": words_csv}

    # --- Style Generation --------------------------------------------------
    def _generate_style_guide(self, script_text: str, run_dir: Path, background_type: str = "black", style_config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Generate a style guide based on background_type (white or black).
        Uses predefined presets to ensure proper color contrast.

        Priority chain (highest wins):
          1. style_config.background_type (explicit brand override)
          2. template.background_type     (template default)
          3. function parameter default   ("black")

        After building from preset:
          template.palette_override  →  merged on top of preset
          brand primary_color / fonts  →  applied last (always win)
        """
        # Resolve template (if layout_theme is a known template id)
        layout_theme_id = (style_config or {}).get("layout_theme", "")
        template = _get_template_by_id(layout_theme_id) if layout_theme_id else None

        # Determine background_type: explicit brand setting > template default > parameter default
        explicit_bg = (style_config or {}).get("background_type")
        if explicit_bg in ("white", "black"):
            background_type = explicit_bg
        elif template and template.get("background_type") in ("white", "black"):
            background_type = template["background_type"]
        # else: keep the parameter default (already "black")

        # Use predefined presets based on background_type
        preset = BACKGROUND_PRESETS.get(background_type, BACKGROUND_PRESETS["black"])

        style_guide = {
            "background_type": background_type,
            "palette": {
                "background": preset["background"],
                "text": preset["text"],
                "text_secondary": preset["text_secondary"],
                "primary": preset["primary"],
                "secondary": preset["secondary"],
                "accent": preset["accent"],
                "svg_stroke": preset["svg_stroke"],
                "svg_fill": preset["svg_fill"],
                "card_bg": preset["card_bg"],
                "card_border": preset["card_border"],
                "mermaid_node_fill": preset["mermaid_node_fill"],
                "mermaid_node_stroke": preset["mermaid_node_stroke"],
                "mermaid_text": preset["mermaid_text"],
                "annotation_color": preset["annotation_color"],
            },
            "fonts": {
                "primary": "Montserrat",
                "secondary": "Inter",
                "code": "Fira Code"
            },
            "borderRadius": "8px",  # Reduced - less app-like
            "glassmorphism": False,  # Never use glassmorphism for educational videos
            "mermaid_theme": preset["mermaid_theme"],
            "code_theme": preset["code_theme"],
            "notes": f"Clean {'dark' if background_type == 'black' else 'light'} educational style. No shadows. Use Rough Notation for annotations."
        }

        # Apply template palette_override (template colors on top of preset)
        if template:
            for k, v in template.get("palette_override", {}).items():
                if k in style_guide["palette"]:
                    style_guide["palette"][k] = v
                # keys like background_type, card_bg, card_border may not be in palette
                elif k not in ("background_type",):
                    style_guide["palette"][k] = v
            style_guide["layout_theme"] = layout_theme_id
            print(f"   🎨 Template applied: {template['name']} ({background_type} background)")

        # Apply institute brand overrides from style_config (always highest priority)
        if style_config:
            primary_color = style_config.get("primary_color")
            if primary_color:
                style_guide["palette"]["accent"] = primary_color
                style_guide["palette"]["primary"] = primary_color
                style_guide["palette"]["annotation_color"] = primary_color
                style_guide["palette"]["svg_stroke"] = primary_color
                style_guide["palette"]["mermaid_node_stroke"] = primary_color
                print(f"   🎨 Brand primary color applied: {primary_color}")

            heading_font = style_config.get("heading_font")
            body_font = style_config.get("body_font")
            if heading_font:
                style_guide["fonts"]["primary"] = heading_font
            if body_font:
                style_guide["fonts"]["secondary"] = body_font
            if heading_font or body_font:
                print(f"   🔤 Brand fonts applied: heading={heading_font or 'default'}, body={body_font or 'default'}")

            # layout_theme is already set from template lookup above; keep it consistent
            if layout_theme_id:
                style_guide["layout_theme"] = layout_theme_id

        # Save for inspection
        (run_dir / "style_guide.json").write_text(json.dumps(style_guide, indent=2))
        # Store resolved style_guide so _ensure_fonts can use brand-override'd palette
        self._current_style_guide = style_guide
        print(f"🎨 Using {background_type.upper()} background theme")
        print(f"   Text color: {preset['text']} | SVG stroke: {style_guide['palette']['svg_stroke']} | Annotation: {style_guide['palette']['annotation_color']}")
        return style_guide

    # --- Segmentation + HTML ----------------------------------------------
    @staticmethod
    def _load_words(words_path: Path) -> List[Dict[str, Any]]:
        return json.loads(words_path.read_text())

    @staticmethod
    def _segment_words(words: List[Dict[str, Any]], window: float = 40.0, audio_duration: float = 0.0) -> List[Dict[str, Any]]:
        if not words:
            return []
        # Use max of all word end-times (array may not be sorted) and
        # actual audio duration (words may not cover the full audio).
        total_duration = max(
            max(float(w["end"]) for w in words),
            audio_duration,
        )
        segments: List[Dict[str, Any]] = []
        idx = 0
        start_time = 0.0
        while start_time < total_duration - 1e-3:
            end_time = min(total_duration, start_time + window)
            chunk_words = [
                w for w in words if float(w["start"]) < end_time and float(w["end"]) > start_time
            ]
            if chunk_words:
                chunk_text = " ".join(str(w["word"]) for w in chunk_words).strip()
                if chunk_text:
                    segments.append(
                        {
                            "index": idx + 1,
                            "start": round(start_time, 3),
                            "end": round(end_time, 3),
                            "duration": round(end_time - start_time, 1),
                            "text": chunk_text,
                            "words": chunk_words,  # Include raw words for alignment
                        }
                    )
                    idx += 1
            start_time += window
        return segments

    @staticmethod
    def _find_phrase_start(
        words: List[Dict[str, Any]], phrase_tokens: List[str], after_time: float = 0.0
    ) -> Optional[float]:
        """Find the timestamp where a phrase starts in the word stream.

        Uses sliding window matching: if the majority of tokens match consecutively,
        it's a hit. Tolerates minor mismatches (TTS may slightly alter words).
        Returns the start time of the first matching word, or None.
        """
        if not phrase_tokens or not words:
            return None
        # Require majority match: allow up to 2 mismatches, but always need at least 1 match
        threshold = max(1, len(phrase_tokens) - 2)
        for i, w in enumerate(words):
            if float(w["start"]) <= after_time:
                continue
            matched = 0
            for j, token in enumerate(phrase_tokens):
                if i + j >= len(words):
                    break
                word_text = str(words[i + j].get("word", "")).lower().strip(".,!?;:'\"")
                if token.strip(".,!?;:'\"") == word_text:
                    matched += 1
            if matched >= threshold:
                return float(words[i]["start"])
        return None

    def _segment_words_by_beats(
        self, words: List[Dict[str, Any]], beat_outline: List[Dict[str, Any]],
        max_segments: int = 8, audio_duration: float = 0.0,
    ) -> List[Dict[str, Any]]:
        """
        Concept-aligned segmentation: uses the beat_outline to find natural
        topic transitions in the narration, then splits words at those boundaries.

        Matching strategy (in priority order):
          1. narration field — match first 6 words of each beat's narration text
          2. key_terms / summary keywords — legacy keyword search fallback

        Falls back to fixed-window if beat matching fails.
        max_segments caps total segments to control LLM cost.
        """
        if not words or not beat_outline:
            return self._segment_words(words, audio_duration=audio_duration)

        # Use max of all word end-times and actual audio duration
        total_duration = max(
            max(float(w["end"]) for w in words),
            audio_duration,
        )

        # --- Find beat boundaries in the word stream ---
        beat_boundaries: List[float] = [0.0]
        # Track which beat index maps to which boundary (for beat_index in segments)
        boundary_beat_indices: List[int] = [0]

        for beat_idx, beat in enumerate(beat_outline):
            best_time = None

            # Strategy A: Use per-beat narration text (most reliable)
            narration = beat.get("narration", "").strip()
            if narration:
                first_words = narration.lower().split()[:6]
                if len(first_words) >= 3:
                    best_time = self._find_phrase_start(
                        words, first_words, after_time=beat_boundaries[-1] + 3.0
                    )
                    if best_time:
                        print(f"      📍 Beat '{beat.get('label', beat_idx)}': narration match at {best_time:.1f}s")

            # Strategy B: Fall back to keyword search (backwards compat)
            if best_time is None:
                key_terms = beat.get("key_terms", [])
                summary_words = beat.get("summary", "").lower().split()[:3]
                search_terms = [t.lower() for t in key_terms] + summary_words

                for term in search_terms:
                    if not term or len(term) < 3:
                        continue
                    for w in words:
                        word_text = str(w.get("word", "")).lower().strip(".,!?;:")
                        if term in word_text and float(w["start"]) > beat_boundaries[-1] + 5.0:
                            best_time = float(w["start"])
                            break
                    if best_time:
                        break

            if best_time and best_time > beat_boundaries[-1] + 10.0:  # Min 10s per segment
                beat_boundaries.append(best_time)
                boundary_beat_indices.append(beat_idx)

        beat_boundaries.append(total_duration)
        boundary_beat_indices.append(len(beat_outline) - 1)  # Final boundary maps to last beat

        # Merge very short segments (< 15s) with neighbors
        merged = [beat_boundaries[0]]
        merged_beat_indices = [boundary_beat_indices[0]]
        for i, b in enumerate(beat_boundaries[1:], 1):
            if b - merged[-1] < 15.0 and len(merged) > 1:
                continue  # Skip, merge with next
            merged.append(b)
            merged_beat_indices.append(boundary_beat_indices[min(i, len(boundary_beat_indices) - 1)])
        if merged[-1] != total_duration:
            merged.append(total_duration)
            merged_beat_indices.append(boundary_beat_indices[-1])
        beat_boundaries = merged
        boundary_beat_indices = merged_beat_indices

        # Enforce max_segments cap by merging smallest adjacent pairs
        while len(beat_boundaries) - 1 > max_segments:
            min_gap = float("inf")
            min_idx = 1
            for i in range(1, len(beat_boundaries) - 1):
                gap = beat_boundaries[i] - beat_boundaries[i - 1]
                if gap < min_gap:
                    min_gap = gap
                    min_idx = i
            beat_boundaries.pop(min_idx)
            boundary_beat_indices.pop(min_idx)

        # If we only got start+end (no useful beat boundaries), fall back
        if len(beat_boundaries) <= 2:
            print("   ⚠️ Beat matching found no useful boundaries, using fixed-window fallback")
            return self._segment_words(words, audio_duration=audio_duration)

        # Build segments from boundaries
        segments: List[Dict[str, Any]] = []
        for idx in range(len(beat_boundaries) - 1):
            start_time = beat_boundaries[idx]
            end_time = beat_boundaries[idx + 1]
            chunk_words = [
                w for w in words if float(w["start"]) < end_time and float(w["end"]) > start_time
            ]
            if chunk_words:
                chunk_text = " ".join(str(w["word"]) for w in chunk_words).strip()
                if chunk_text:
                    beat_idx = boundary_beat_indices[idx] if idx < len(boundary_beat_indices) else min(idx, len(beat_outline) - 1)
                    beat_idx = min(beat_idx, len(beat_outline) - 1)

                    segments.append({
                        "index": idx + 1,
                        "start": round(start_time, 3),
                        "end": round(end_time, 3),
                        "duration": round(end_time - start_time, 1),
                        "text": chunk_text,
                        "words": chunk_words,
                        "needs_recap": beat_outline[beat_idx].get("needs_recap", False),
                        "beat_label": beat_outline[beat_idx].get("label", f"Section {idx + 1}"),
                        "key_terms": beat_outline[beat_idx].get("key_terms", []),
                        "complexity_level": beat_outline[beat_idx].get("complexity_level", "moderate"),
                        "beat_index": beat_idx,
                    })

        return segments

    def _process_interactive_content(self, script_plan: Dict[str, Any], content_type: str) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """
        Process interactive content (Quiz, etc.) which doesn't use audio alignment for segmentation.
        Instead, it extracts the pre-generated HTML directly from the script plan.
        """
        plan_data = script_plan.get("plan", {})
        segments = []
        usage = {"completion_tokens": 0, "total_tokens": 0, "prompt_tokens": 0}
        
        # Helper to create a segment
        def create_segment(html_content, index, entry_id=None, extra_meta=None):
            segment = {
                "index": index,
                "start": 0.0, # Will be ignored in user_driven mode
                "end": 0.0,   # Will be ignored in user_driven mode
                "text": "Interactive content",
                "html": html_content,
                "htmlStartX": 0, "htmlStartY": 0, "htmlEndX": self.video_width, "htmlEndY": self.video_height,
                "id": entry_id or f"segment-{index}"
            }
            if extra_meta:
                segment["entry_meta"] = extra_meta
            return segment

        print(f"🧩 Extracting segments for {content_type} from script plan...")
        
        if content_type == "QUIZ":
            questions = plan_data.get("questions", [])
            if not questions:
                print(f"    ⚠️  QUIZ: 'questions' key missing or empty. Available keys: {list(plan_data.keys())}")
            for i, q in enumerate(questions):
                html = q.get("question_html", f"<div>Question {i+1}</div>")
                segments.append(create_segment(html, i+1, q.get("id"), extra_meta=q))
            if not questions:
                html = plan_data.get("html", "<div>Quiz</div>")
                segments.append(create_segment(html, 1, "quiz-main", extra_meta=plan_data))

        elif content_type == "STORYBOOK":
            pages = plan_data.get("pages", [])
            if not pages:
                print(f"    ⚠️  STORYBOOK: 'pages' key missing or empty. Available keys: {list(plan_data.keys())}")
            for i, p in enumerate(pages):
                html = p.get("html", f"<div>Page {i+1}</div>")

                # Fallback: If LLM forgot the data-img-prompt in HTML but provided it in JSON, inject it
                if "illustration_prompt" in p and "data-img-prompt" not in html:
                    safe_prompt = p["illustration_prompt"].replace('"', '&quot;')
                    if "<img" in html:
                        html = html.replace("<img", f'<img data-img-prompt="{safe_prompt}"', 1)
                        print(f"    🔧 Auto-injected missing data-img-prompt for page {i+1}")
                    else:
                        html = html + f'<img data-img-prompt="{safe_prompt}" style="display:none" alt="illustration">'
                        print(f"    🔧 Appended hidden img placeholder with data-img-prompt for page {i+1}")

                segments.append(create_segment(html, i+1, f"page-{p.get('page_number', i+1)}", extra_meta=p))
            if not pages:
                html = plan_data.get("html", "<div>Storybook</div>")
                segments.append(create_segment(html, 1, "storybook-main", extra_meta=plan_data))

        elif content_type == "INTERACTIVE_GAME":
            # Games are usually a single self-contained entry
            html = plan_data.get("html", "<div>Game Container</div>")
            segments.append(create_segment(html, 1, "game-container", extra_meta=plan_data))

        elif content_type == "FLASHCARDS":
            cards = plan_data.get("cards", [])
            if not cards:
                print(f"    ⚠️  FLASHCARDS: 'cards' key missing or empty. Available keys: {list(plan_data.keys())}")
            for i, c in enumerate(cards):
                html = c.get("front_html", f"<div>Card {i+1}</div>")
                segments.append(create_segment(html, i+1, c.get("id", f"card-{i+1}"), extra_meta=c))
            if not cards:
                html = plan_data.get("html", "<div>Flashcard Deck</div>")
                segments.append(create_segment(html, 1, "flashcard-main", extra_meta=plan_data))
                
        elif content_type == "PUZZLE_BOOK":
            puzzles = plan_data.get("puzzles", [])
            if not puzzles:
                print(f"    ⚠️  PUZZLE_BOOK: 'puzzles' key missing or empty. Available keys: {list(plan_data.keys())}")
            for i, p in enumerate(puzzles):
                html = p.get("html", f"<div>Puzzle {i+1}</div>")
                segments.append(create_segment(html, i+1, p.get("id", f"puzzle-{i+1}"), extra_meta=p))
            if not puzzles:
                # Fallback: single entry using top-level html or a placeholder
                html = plan_data.get("html", f"<div>Puzzle Book</div>")
                segments.append(create_segment(html, 1, "puzzle-main", extra_meta=plan_data))
        
        elif content_type == "TIMELINE":
            events = plan_data.get("events", [])
            if not events:
                print(f"    ⚠️  TIMELINE: 'events' key missing or empty. Available keys: {list(plan_data.keys())}")
            for i, e in enumerate(events):
                html = e.get("html", f"<div>Event {i+1}</div>")
                segments.append(create_segment(html, i+1, e.get("id", f"event-{i+1}"), extra_meta=e))
            if not events:
                html = plan_data.get("html", "<div>Timeline</div>")
                segments.append(create_segment(html, 1, "timeline-main", extra_meta=plan_data))

        elif content_type == "MAP_EXPLORATION":
            # Each region is a separate user_driven entry
            regions = plan_data.get("regions", [])
            if not regions:
                print(f"    ⚠️  MAP_EXPLORATION: 'regions' key missing or empty. Available keys: {list(plan_data.keys())}")
            for i, r in enumerate(regions):
                html = r.get("html", f"<div>Region {i+1}</div>")
                segments.append(create_segment(html, i+1, r.get("id", f"region-{i+1}"), extra_meta=r))
            if not regions:
                html = plan_data.get("html", "<div>Map Exploration</div>")
                segments.append(create_segment(html, 1, "map-main", extra_meta=plan_data))

        elif content_type == "SIMULATION":
            # Simulations are self_contained — one single HTML entry with all interactivity
            html = plan_data.get("html", "<div>Simulation</div>")
            segments.append(create_segment(html, 1, "simulation-container", extra_meta=plan_data))

        elif content_type == "WORKSHEET":
            sections = plan_data.get("sections", [])
            for i, s in enumerate(sections):
                html = s.get("html", f"<div>Exercise {i+1}</div>")
                segments.append(create_segment(html, i+1, s.get("id", f"exercise-{i+1}"), extra_meta=s))
            if not sections:
                # Single-page worksheet fallback
                html = plan_data.get("html", "<div>Worksheet</div>")
                segments.append(create_segment(html, 1, "worksheet-main", extra_meta=plan_data))

        elif content_type == "CODE_PLAYGROUND":
            exercises = plan_data.get("exercises", [])
            for i, ex in enumerate(exercises):
                html = ex.get("html", f"<div>Exercise {i+1}</div>")
                segments.append(create_segment(html, i+1, ex.get("id", f"exercise-{i+1}"), extra_meta=ex))
            if not exercises:
                html = plan_data.get("html", "<div>Code Playground</div>")
                segments.append(create_segment(html, 1, "playground-main", extra_meta=plan_data))

        elif content_type == "CONVERSATION":
            exchanges = plan_data.get("exchanges", [])
            for i, ex in enumerate(exchanges):
                html = ex.get("html", f"<div>Exchange {i+1}</div>")
                segments.append(create_segment(html, i+1, ex.get("id", f"exchange-{i+1}"), extra_meta=ex))
            if not exchanges:
                html = plan_data.get("html", "<div>Conversation</div>")
                segments.append(create_segment(html, 1, "conversation-main", extra_meta=plan_data))

        elif content_type == "SLIDES":
            slides = plan_data.get("slides", [])
            if not slides:
                print(f"    ⚠️  SLIDES: 'slides' key missing or empty. Available keys: {list(plan_data.keys())}")
                print(f"    ⚠️  This usually means the model ran out of tokens or ignored the slides-array format.")
                print(f"    ⚠️  Tip: use a model with high output token limits (e.g. google/gemini-2.5-pro).")
            for i, slide in enumerate(slides):
                html = slide.get("html", f"<div>Slide {i+1}</div>")
                # If the slide has an image_prompt but no data-img-prompt in its HTML, inject it
                if slide.get("image_prompt") and "data-img-prompt" not in html:
                    safe_prompt = slide["image_prompt"].replace('"', '&quot;')
                    if "<img" in html:
                        html = html.replace("<img", f'<img data-img-prompt="{safe_prompt}"', 1)
                        print(f"    🔧 Auto-injected data-img-prompt for slide {i+1}")
                    else:
                        # Append a hidden placeholder so image generation is triggered
                        html = html + f'<img data-img-prompt="{safe_prompt}" src="placeholder.png" style="display:none" alt="">'
                        print(f"    🔧 Appended hidden img with data-img-prompt for slide {i+1}")
                meta = {k: v for k, v in slide.items() if k != "html"}
                segments.append(create_segment(html, i+1, slide.get("id", f"slide-{i+1}"), extra_meta=meta))
            if slides:
                print(f"    ✅ SLIDES: extracted {len(slides)} slide(s) from plan.")
            else:
                # Fallback: model returned monolithic HTML or empty slides array.
                # Wrap the whole thing in a single entry so the response is at least usable.
                html = plan_data.get("html", "<div>Presentation</div>")
                segments.append(create_segment(html, 1, "slides-main", extra_meta=plan_data))

        else:
            # Generic fallback: try common list keys, then single entry
            found_list = False
            for key in ["items", "sections", "exercises", "exchanges", "regions"]:
                if key in plan_data and isinstance(plan_data[key], list):
                    items = plan_data[key]
                    for i, item in enumerate(items):
                        html = item.get("html", f"<div>Item {i+1}</div>")
                        segments.append(create_segment(html, i+1, item.get("id", f"item-{i+1}"), extra_meta=item))
                    found_list = True
                    break

            if not found_list:
                html = plan_data.get("html", f"<div>Content for {content_type}</div>")
                segments.append(create_segment(html, 1, "main-content", extra_meta=plan_data))
                
        print(f"✅ Extracted {len(segments)} segments for {content_type}")
        return segments, usage

    # ------------------------------------------------------------------
    # Director Stage — produces shot-by-shot plan (premium/ultra tiers)
    # ------------------------------------------------------------------

    def _normalize_director_plan(
        self,
        parsed: Any,
        audio_duration: float,
    ) -> Dict[str, Any]:
        """Coerce a variety of LLM response shapes into the canonical
        `{"shots": [...], "continuity_notes": "..."}` envelope.

        Handles the following common LLM failure modes without losing data:

        1. Already correct → `{"shots": [...], ...}` — pass through unchanged
        2. Bare list → `[{shot}, {shot}]` — wrap in `{"shots": <list>}`
        3. Flat single shot → `{"shot_index": 0, "shot_type": "VIDEO_HERO", ...}`
           (LLM emitted a shot object directly, dropping the envelope) — wrap
           in `{"shots": [<parsed>]}` and extend `end_time` to `audio_duration`
           if it falls short so the shot covers the full video.
        4. Wrong envelope key → `{"shot": {...}}` / `{"plan": [...]}` /
           `{"shots_plan": [...]}` — unwrap and re-wrap with the correct key.

        If the shape is unrecognizable, returns `{"shots": []}` so the caller
        can trigger a corrective retry.
        """
        # Case 1: already correct
        if isinstance(parsed, dict) and isinstance(parsed.get("shots"), list):
            return parsed

        # Case 2: bare list of shots
        if isinstance(parsed, list):
            if parsed and isinstance(parsed[0], dict) and "shot_type" in parsed[0]:
                print("   🔧 Salvage: wrapping bare list of shots in envelope")
                return {"shots": parsed, "continuity_notes": ""}
            return {"shots": []}

        if not isinstance(parsed, dict):
            return {"shots": []}

        # Case 4a: wrong envelope key pointing at a list
        for alt_key in ("shot_list", "shots_plan", "plan", "shot_plan", "planned_shots"):
            if isinstance(parsed.get(alt_key), list):
                print(f"   🔧 Salvage: re-wrapping under '{alt_key}' → 'shots'")
                salvaged = {
                    "shots": parsed[alt_key],
                    "continuity_notes": parsed.get("continuity_notes", ""),
                }
                for meta_key in ("shot_density", "pacing_rationale", "overall_arc"):
                    if meta_key in parsed:
                        salvaged[meta_key] = parsed[meta_key]
                return salvaged

        # Case 4b: wrong envelope key pointing at a single shot dict
        for alt_key in ("shot", "single_shot"):
            inner = parsed.get(alt_key)
            if isinstance(inner, dict) and "shot_type" in inner:
                print(f"   🔧 Salvage: wrapping single shot under '{alt_key}'")
                inner.setdefault("start_time", 0.0)
                inner.setdefault("end_time", audio_duration)
                return {"shots": [inner], "continuity_notes": parsed.get("continuity_notes", "")}

        # Case 3: flat single shot (has shot-level keys at top level)
        shot_level_markers = {"shot_type", "shot_index", "narration_excerpt", "animation_strategy"}
        if shot_level_markers & set(parsed.keys()):
            # For videos longer than ~15s, a single-shot response is almost
            # certainly a broken LLM output (not a legitimate one-shot plan).
            # Accepting and stretching it produces a static video. Force a
            # corrective retry instead.
            end = float(parsed.get("end_time", 0.0) or 0.0)
            shot_duration_ok = end >= max(10.0, audio_duration * 0.6)
            if audio_duration > 15.0 and not shot_duration_ok:
                print(
                    f"   ⚠️ Single-shot response with end_time={end:.2f}s for "
                    f"{audio_duration:.1f}s audio — rejecting (will trigger retry)"
                )
                return {"shots": []}
            print("   🔧 Salvage: top-level object looks like a single shot — wrapping in envelope")
            if audio_duration > 0 and end < audio_duration - 0.5:
                print(f"       extending end_time {end:.2f}s → {audio_duration:.2f}s to cover full audio")
                parsed["end_time"] = audio_duration
            parsed.setdefault("shot_index", 0)
            parsed.setdefault("beat_index", 0)
            parsed.setdefault("start_time", 0.0)
            return {"shots": [parsed], "continuity_notes": ""}

        # Unrecognizable shape
        return {"shots": []}

    def _build_shot_pack(
        self,
        style_guide: Dict[str, Any],
        width: int,
        height: int,
    ) -> Dict[str, Any]:
        """Assemble a shared token pack that every shot prompt gets injected with.

        Eliminates cross-shot drift on colors, typography, spacing, and easing by
        handing the shot LLM a single source of truth instead of letting each
        shot re-derive layout decisions locally. Computed once per run.
        """
        palette = style_guide.get("palette", {}) or {}
        is_portrait = height > width
        # Font scale — portrait pushes display type larger relative to viewport
        # because reels hold attention on a single text block, not a layout grid.
        if is_portrait:
            font_scale = {
                "display": "9rem",
                "h1": "5.5rem",
                "h2": "3.25rem",
                "body": "1.9rem",
                "caption": "1.35rem",
                "micro": "1.05rem",
            }
        else:
            font_scale = {
                "display": "8rem",
                "h1": "4.5rem",
                "h2": "2.75rem",
                "body": "1.75rem",
                "caption": "1.2rem",
                "micro": "0.95rem",
            }
        safe_area = "4%" if is_portrait else "6%"
        return {
            "color_tokens": {
                "primary": "var(--brand-primary)",
                "accent": "var(--brand-accent)",
                "text": "var(--brand-text)",
                "text_secondary": "var(--brand-text-secondary)",
                "bg": palette.get("background", "var(--brand-bg)"),
                "svg_stroke": "var(--brand-svg-stroke)",
                "svg_fill": "var(--brand-svg-fill)",
                "annotation": "var(--brand-annotation)",
            },
            "font_family": {
                "display": "'Bebas Neue', 'Montserrat', sans-serif",
                "heading": style_guide.get("fonts", {}).get("primary", "Montserrat"),
                "body": style_guide.get("fonts", {}).get("secondary", "Inter"),
                "mono": "'Fira Code', monospace",
            },
            "font_scale": font_scale,
            "spacing": {
                "xs": "8px",
                "sm": "16px",
                "md": "24px",
                "lg": "40px",
                "xl": "64px",
                "2xl": "96px",
                "safe_area": safe_area,
            },
            "ease": {
                "entry": "power3.out",
                "exit": "power2.in",
                "emphasis": "back.out(1.6)",
                "bg_crossfade": "power2.inOut",
                "snappy": "expo.out",
                "settle": "power4.out",
            },
            "timing": {
                "entry_stagger": 0.12,
                "title_delay": 0.3,
                "subtitle_delay": 0.8,
                "bg_crossfade_sec": 1.2,
                "word_wipe_per_word": 0.15,
            },
            "layout": {
                "aspect": "9:16" if is_portrait else "16:9",
                "canvas_w": width,
                "canvas_h": height,
                "grid_columns": 6 if is_portrait else 12,
                "gutter": "24px",
            },
            "id_prefix": "s{shot_idx}_",  # Shot code replaces {shot_idx} at inject time
        }

    def _validate_shot_animation_density(
        self,
        html: str,
        shot: Dict[str, Any],
        start_time: float,
        end_time: float,
    ) -> List[str]:
        """Scan generated shot HTML for animation coverage.

        Checks:
        1. Minimum GSAP tween count against tier's `min_animated_elements`.
        2. Each Director-specified sync_point has a corresponding GSAP `delay:`
           within ±0.2s of the expected shot-relative time.

        Returns a list of human-readable issue strings. Empty list = OK.
        """
        issues: List[str] = []
        min_anim = int(self._tier_config.get("min_animated_elements", 4))

        # Count distinct GSAP tween/timeline calls. Matches .to/.from/.fromTo/.timeline
        # at both the `gsap.` top level and chained (`.to(`, `.from(`).
        tween_pattern = re.compile(
            r"(?:gsap\.(?:to|from|fromTo|timeline)|\.(?:to|from|fromTo|set)\s*\()",
        )
        tween_count = len(tween_pattern.findall(html))
        if tween_count < min_anim:
            issues.append(
                f"found {tween_count} GSAP tweens, need at least {min_anim} "
                f"independently animated elements"
            )

        # Validate sync_points — each one should translate to a shot-relative delay.
        sync_points = shot.get("sync_points") or []
        if sync_points:
            # Extract all numeric `delay:` values from the HTML
            delay_pattern = re.compile(r"delay\s*:\s*([0-9]*\.?[0-9]+)")
            delays = [float(m) for m in delay_pattern.findall(html)]
            unmatched: List[str] = []
            for sp in sync_points:
                try:
                    abs_t = float(sp.get("time", 0))
                except (TypeError, ValueError):
                    continue
                rel_t = max(0.0, abs_t - start_time)
                if rel_t > (end_time - start_time) + 0.3:
                    continue  # sync point outside the shot — ignore
                # super_ultra targets word-level sync at ~60fps; tighter tolerance.
                _sync_tol = 0.08 if self._quality_tier == "super_ultra" else 0.20
                if not any(abs(rel_t - d) <= _sync_tol for d in delays):
                    word = sp.get("word", "")
                    unmatched.append(f"{rel_t:.2f}s{f' ({word})' if word else ''}")
            if unmatched:
                issues.append(
                    f"sync points not honored ({len(unmatched)}/{len(sync_points)}): "
                    + ", ".join(unmatched[:5])
                )

        # Sanity: shot shouldn't be entirely static text. If zero animations at all,
        # flag it even if the min threshold is low.
        if tween_count == 0 and "animation" not in html.lower():
            issues.append("no GSAP animations or CSS @keyframes found at all")

        # ── Anti-pattern checks (Track C) ──
        # Cheap planner models (gemini-flash variants) occasionally ignore
        # the system-prompt forbid-list and emit vertical / heavily-rotated
        # typography. The rules in prompts.py are the primary defense; this
        # is the regex safety net. When a hit fires, we route through the
        # existing regen path (above) — same single-shot LLM regen as for
        # density misses, no new infrastructure.
        #
        # SAFE TO FLAG ANY MATCH because at validator time the HTML only
        # contains (a) skill composer output (clean — verified empty for
        # writing-mode in /skills and /shot_templates) and (b) LLM-generated
        # shot HTML. The pipeline's own legitimate vertical-text use (the
        # `overlay-left-ribbon` in `_emit_overlay_callout`) is appended
        # AFTER the validator runs, so it never appears in `html` here.
        if re.search(r"writing-mode\s*:\s*(?:vertical-rl|vertical-lr|sideways-rl|sideways-lr)", html, re.IGNORECASE):
            issues.append("vertical typography (writing-mode: vertical-*) — text must read horizontally")
        if re.search(r"text-orientation\s*:\s*(?:upright|sideways)", html, re.IGNORECASE):
            issues.append("vertical typography (text-orientation: upright/sideways) — text must read horizontally")
        # High-rotation transforms on text. We're conservative: flag rotations
        # in the 30°–330° band, which excludes subtle stylistic tilts (≤±15°
        # is explicitly allowed by the prompt rule) and any near-360° wraps.
        # We DON'T attempt selector parsing — instead, only flag when the
        # rotation appears in a CSS rule that targets a text-bearing element.
        # The pattern matches the rotate value, then sanity-checks that the
        # rule is text-related by looking at a 250-char window around it.
        for rot_match in re.finditer(
            r"transform\s*:\s*[^;{}]*\brotate\(\s*([+-]?\d+(?:\.\d+)?)\s*deg\s*\)",
            html,
            re.IGNORECASE,
        ):
            try:
                deg = abs(float(rot_match.group(1))) % 360.0
            except (TypeError, ValueError):
                continue
            # Normalize to [0, 180] — both 270deg and 90deg are equally extreme.
            if deg > 180.0:
                deg = 360.0 - deg
            if deg <= 30.0:
                continue  # subtle stylistic rotation — allowed
            # Look at the surrounding context to decide if this rotation is on text.
            ctx_start = max(0, rot_match.start() - 250)
            ctx_end   = min(len(html), rot_match.end() + 60)
            ctx       = html[ctx_start:ctx_end].lower()
            text_signals = (
                "h1", "h2", "h3", "h4",
                "<p", "<span",
                ".text", ".title", ".headline", ".heading", ".label",
                "letter-spacing", "text-transform", "font-size", "font-family",
                "writing-mode",
            )
            if any(sig in ctx for sig in text_signals):
                issues.append(
                    f"high-rotation transform on text element ({deg:.0f}° rotation) — text must read horizontally"
                )
                break  # one issue is enough; regen the shot

        return issues

    def _build_director_reference_image_block(self) -> List[Dict[str, Any]]:
        """Return OpenRouter-vision content parts for any user-uploaded reference images.

        Output format matches the multimodal OpenAI content schema:
        `[{"type": "image_url", "image_url": {"url": "..."}}, ...]`
        Returns [] when no reference context is attached to this run.
        """
        ref_ctx = getattr(self, "_reference_context", None)
        if not ref_ctx:
            return []
        ref_images = ref_ctx.get("embeddable_images", []) or []
        parts: List[Dict[str, Any]] = []
        for ri in ref_images[:6]:  # hard cap — don't flood the context
            url = ri.get("s3_url") or ri.get("url")
            if not url:
                continue
            parts.append({"type": "image_url", "image_url": {"url": url}})
        return parts

    def _run_act_planner(
        self,
        script_text: str,
        beat_outline: List[Dict[str, Any]],
        subject_domain: str,
        width: int,
        height: int,
        audio_duration: float,
        run_dir: Path,
        system_prompt: str,
        user_prompt: str,
    ) -> Tuple[Optional[Dict[str, Any]], Dict[str, Any]]:
        """Pass 1 of two-pass Director (super_ultra only).

        Produces a high-level 'act plan' that the downstream shot planner
        expands into shots. Returns None on failure — the shot planner then
        runs without an act plan (graceful degradation).
        """
        # Unused knobs kept for signature stability / future logging hooks.
        del script_text, beat_outline, subject_domain, width, height, audio_duration

        print("🎭 Running Act Planner (pass 1)...")
        ref_image_parts = self._build_director_reference_image_block()

        # Build user message (attach reference images if present)
        if ref_image_parts:
            user_content: Any = [{"type": "text", "text": user_prompt}] + ref_image_parts
        else:
            user_content = user_prompt

        messages: List[Dict[str, Any]] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]

        try:
            raw, _usage = self.html_client.chat(
                messages=messages,
                temperature=0.55,
                max_tokens=min(8000, self._tier_config.get("director_max_tokens", 20000)),
                response_format={"type": "json_object"},
            )
        except Exception as exc:
            print(f"   ⚠️ Act Planner failed: {exc} — shot planner will run without an act plan")
            return None, {}

        try:
            parsed = _extract_json_blob(raw)
        except Exception as exc:
            print(f"   ⚠️ Act Planner JSON parse failed: {exc}")
            return None, _usage or {}

        if not isinstance(parsed, dict) or not isinstance(parsed.get("acts"), list) or not parsed["acts"]:
            print("   ⚠️ Act Planner returned no acts — shot planner will run without an act plan")
            return None, _usage or {}

        # Save for debugging
        try:
            (run_dir / "act_plan.json").write_text(json.dumps(parsed, indent=2, ensure_ascii=False))
        except Exception:
            pass
        print(f"   ✅ Act Planner produced {len(parsed['acts'])} acts")
        return parsed, _usage or {}

    def _run_director(
        self,
        script_plan: Dict[str, Any],
        words: List[Dict[str, Any]],
        style_guide: Dict[str, Any],
        run_dir: Path,
        language: str = "English",
        audio_duration: float = 0.0,
        target_audience: str = "General/Adult",
    ) -> Tuple[Optional[Dict[str, Any]], Dict[str, Any]]:
        """Run the Director LLM call to produce a shot-by-shot plan.

        Returns the parsed director plan dict, or None if the call fails
        (the pipeline will fall back to the segment-based flow).
        """
        from director_prompts import (
            DIRECTOR_SYSTEM_PROMPT,
            SUPER_ULTRA_DIRECTOR_EXTENSION,
            MUSIC_PLAN_EXTENSION,
            STRICT_SOURCE_CLIP_DIRECTOR_EXTENSION,
            OVERLAY_INFOGRAPHIC_DIRECTOR_EXTENSION,
            HOST_DIRECTOR_EXTENSION,
            ACT_PLANNER_SYSTEM_PROMPT,
            build_director_user_prompt,
            build_act_planner_user_prompt,
            build_emphasis_map,
        )

        plan_data = script_plan.get("plan", script_plan)
        script_text = str(plan_data.get("script") or script_plan.get("script_text", "")).strip()
        beat_outline = plan_data.get("beat_outline", [])
        subject_domain = getattr(self, '_current_subject_domain', 'general')
        # Override domain for input video modes so Director gets SOURCE_CLIP
        if self._input_video_contexts:
            # Use first video's mode as primary domain; mixed modes are fine
            _iv_mode = self._input_video_contexts[0].get("mode", "podcast")
            subject_domain = f"input_video_{_iv_mode}"
            self._current_subject_domain = subject_domain
        _w = getattr(self, 'video_width', 1920)
        _h = getattr(self, 'video_height', 1080)

        # The Director's irreducible requirement is the script text — it can
        # plan shots from script + word timestamps even when `beat_outline` is
        # missing. Common cause for missing beats: an old `script_plan.json`
        # loaded on resume, or a script LLM that returned a script without a
        # structured beat outline. Synthesize a minimal beat outline so the
        # Director gets some anchor structure (the planning prompt iterates
        # `beat_outline` but tolerates an empty list — a single fallback beat
        # is much better than skipping the Director entirely and losing
        # templates / transition picker / image continuity).
        if not script_text:
            print("⚠️ Director: missing script — skipping (no narration text loaded)")
            return None, {}
        if not beat_outline:
            # Build one beat from the entire script. The Director then uses the
            # word timestamps for fine-grained shot boundaries.
            print(
                "ℹ️ Director: no beat_outline in script_plan — synthesizing a "
                "single-beat fallback so Director can still plan shots"
            )
            beat_outline = [{
                "label": "Main",
                "narration": script_text[:2000],
                "visual_type": "",
                "visual_idea": "",
                "emotion": "",
                "pacing": "normal",
                "complexity_level": "moderate",
                "key_terms": [],
            }]

        # ── Optional Pass 1: Act Planner (super_ultra only) ────────────────
        act_plan: Optional[Dict[str, Any]] = None
        total_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        if self._tier_config.get("director_two_pass"):
            act_plan, act_usage = self._run_act_planner(
                script_text=script_text,
                beat_outline=beat_outline,
                subject_domain=subject_domain,
                width=_w,
                height=_h,
                audio_duration=audio_duration,
                run_dir=run_dir,
                system_prompt=ACT_PLANNER_SYSTEM_PROMPT,
                user_prompt=build_act_planner_user_prompt(
                    script_text=script_text,
                    beat_outline=beat_outline,
                    subject_domain=subject_domain,
                    width=_w,
                    height=_h,
                    audio_duration=audio_duration,
                ),
            )
            if act_usage:
                total_usage["prompt_tokens"] += act_usage.get("prompt_tokens", 0)
                total_usage["completion_tokens"] += act_usage.get("completion_tokens", 0)
                total_usage["total_tokens"] += act_usage.get("total_tokens", 0)

        # ── Emphasis map (ultra / super_ultra) ─────────────────────────────
        emphasis_map = ""
        if self._tier_config.get("director_emphasis_map"):
            emphasis_map = build_emphasis_map(words)
        # Store so per-shot HTML generation can highlight narrator stress peaks
        self._emphasis_map = emphasis_map

        user_prompt = build_director_user_prompt(
            script_text=script_text,
            beat_outline=beat_outline,
            words=words,
            subject_domain=subject_domain,
            style_guide=style_guide,
            width=_w,
            height=_h,
            language=language,
            audio_duration=audio_duration,
            act_plan=act_plan,
            emphasis_map=emphasis_map,
            require_shot_density=bool(self._tier_config.get("director_shot_density")),
            max_shots=getattr(self, '_max_total_shots', None),
            target_shot_duration_s=getattr(self, '_target_shot_duration_s', None),
            quality_tier=self._quality_tier,
            target_audience=target_audience,
            include_music_plan=self._is_background_music_enabled(),
        )

        # ── Input video context for Director ──────────────────────────
        # Give the Director access to source video transcripts, scenes,
        # and emphasis so it can plan SOURCE_CLIP shots at the right moments.
        if self._input_video_contexts:
            _num_sources = len(self._input_video_contexts)
            _labels = "ABCDEFGHIJ"
            _lines_per_video = max(10, 40 // _num_sources)

            _video_sections = []
            for _vidx, _vctx in enumerate(self._input_video_contexts):
                _label = _labels[_vidx] if _vidx < len(_labels) else str(_vidx)
                _iv_ctx = _vctx.get("context", {})
                _iv_meta = _iv_ctx.get("meta", {})
                _iv_transcript = _iv_ctx.get("transcript", [])
                _iv_emphasis = _iv_ctx.get("emphasis", [])
                _iv_scenes = _iv_ctx.get("scenes", [])
                _iv_highlight = _iv_meta.get("highlight_window", {})
                _v_name = _vctx.get("name", f"Video {_label}")
                _v_mode = _vctx.get("mode", "unknown")
                _v_dur = _iv_meta.get("duration_s", _vctx.get("duration_seconds", 0))

                _transcript_lines = [
                    f"  [{s.get('start', 0):.1f}-{s.get('end', 0):.1f}s] \"{s.get('text', '')}\""
                    for s in _iv_transcript[:_lines_per_video]
                ]
                _emphasis_lines = [
                    f"  {e.get('t', 0):.1f}s \"{e.get('word', '')}\" ({e.get('reason', '')})"
                    for e in _iv_emphasis[:8]
                ]
                _scene_times = [f"{s.get('t', 0):.1f}s" for s in _iv_scenes[:10]]

                _resolution = _iv_meta.get("resolution", [0, 0])
                _src_w = _resolution[0] if len(_resolution) >= 2 else 0
                _src_h = _resolution[1] if len(_resolution) >= 2 else 0
                _is_portrait = _src_w > 0 and _src_h > 0 and _src_w < _src_h
                _orient = "PORTRAIT 9:16" if _is_portrait else "LANDSCAPE 16:9"

                _user_script_dir = getattr(self, '_user_had_script', False)
                # In user-script mode, label transcript as TIMING ONLY so Director
                # doesn't generate shot content based on the video's own narration.
                _transcript_label = (
                    "Transcript (TIMING REFERENCE ONLY — DO NOT use this as shot content):\n"
                    if _user_script_dir else "Transcript:\n"
                )
                _section = (
                    f"\n### Video {_label}: \"{_v_name}\" ({_v_mode}, {_v_dur:.0f}s, {_orient}, {_src_w}x{_src_h})\n"
                    f"source_video_index: {_vidx}\n"
                    f"Highlight window: {_iv_highlight.get('t_start', 0):.1f}-"
                    f"{_iv_highlight.get('t_end', 0):.1f}s "
                    f"({_iv_highlight.get('reason', '')})\n\n"
                    + _transcript_label + "\n".join(_transcript_lines) + "\n\n"
                    "Emphasis marks:\n" + "\n".join(_emphasis_lines) + "\n\n"
                    f"Scene cuts: {', '.join(_scene_times)}\n"
                )

                # Demo-specific context
                if _v_mode == "demo":
                    _iv_demo = _iv_ctx.get("demo_only", {})
                    _ui_elements = _iv_demo.get("ui_elements_seen", [])
                    _key_events = _iv_demo.get("key_onscreen_events", [])
                    # In user-script mode, suppress UI elements — they cause the Director
                    # to generate shot titles like "Header Navigation" instead of script beats.
                    if _ui_elements and not _user_script_dir:
                        _section += f"\nUI elements: {', '.join(_ui_elements[:15])}\n"
                    if _key_events:
                        _ev = [f"  {e.get('t', 0):.1f}s: {e.get('kind', '?')} near \"{e.get('near_text', '')}\""
                               for e in _key_events[:10]]
                        _ev_label = (
                            "\nKey interaction timestamps (use for SOURCE_CLIP start/end — NOT for shot naming):\n"
                            if _user_script_dir else "\nKey events:\n"
                        )
                        _section += _ev_label + "\n".join(_ev) + "\n"
                    if _user_script_dir:
                        _section += (
                            "\n⚠️ USER SCRIPT MODE: Shot titles and content MUST come from the "
                            "user's script (sections like OPENING, PROBLEM, BRAND REVEAL, etc.). "
                            "The transcript/events above are for timestamp alignment ONLY. "
                            "NEVER name a shot after a UI element or the video's own narration.\n"
                        )
                    else:
                        _section += (
                            "\nCaption guidance: title MUST describe what's on screen at that timestamp. "
                            "BAD: 'No More Tool Jumping'. GOOD: 'Exploring Course Library'.\n"
                        )

                _video_sections.append(_section)

            _user_script_mode = getattr(self, '_user_had_script', False)
            if _user_script_mode:
                # Extract section labels from the user's script (e.g. [OPENING], [PROBLEM])
                import re as _re_dir_secs
                _raw_prompt = getattr(self, '_base_prompt', '') or ''
                _sec_matches = _re_dir_secs.findall(
                    r'\[([A-Z][A-Z\s/&\-]+?)(?:\s*[—–-]\s*[\d:]+[^]]*?)?\]',
                    _raw_prompt
                )
                _sec_labels = list(dict.fromkeys(s.strip() for s in _sec_matches if len(s.strip()) >= 3))
                _sec_label_str = (
                    " → ".join(_sec_labels) if _sec_labels
                    else "OPENING → PROBLEM → BRAND REVEAL → HOW IT WORKS → CTA"
                )
                _source_clip_rules = (
                    "**SOURCE_CLIP RULES (USER SCRIPT MODE)**:\n"
                    "- SOURCE_CLIP should be used for 50-65% of shots.\n"
                    f"- NARRATIVE-FIRST: the user's script has these sections: {_sec_label_str}.\n"
                    "  Organize SOURCE_CLIP shots to ILLUSTRATE these narrative beats in order.\n"
                    "  Do NOT walk chronologically through the demo footage.\n"
                    "- Shot titles MUST echo the script section labels above,\n"
                    "  NEVER describe UI elements like 'Header Navigation' or 'Selection Step'.\n"
                    "- Pick source_start/source_end timestamps that best ILLUSTRATE the current\n"
                    "  narrative beat — not necessarily the next sequential moment in the video.\n"
                    "- Each SOURCE_CLIP shot MUST include:\n"
                    "  - `source_video_index`: integer (0 = Video A, 1 = Video B, ...)\n"
                    "  - `source_start`: timestamp (seconds) in THAT video\n"
                    "  - `source_end`: timestamp (seconds) in THAT video\n"
                    "- Match source_start/source_end to the transcript timestamps of the CORRECT video.\n"
                )
            else:
                _source_clip_rules = (
                    "**SOURCE_CLIP RULES**:\n"
                    "- SOURCE_CLIP should be the PRIMARY shot type — use it for 60-70% of shots.\n"
                    "  The source video IS the content. Use other types (KINETIC_TITLE, TEXT_DIAGRAM)\n"
                    "  only for intro/outro titles and brief concept summaries between clips.\n"
                    "- Structure as a GUIDED WALKTHROUGH: SOURCE_CLIP shows the demo footage,\n"
                    "  interleaved with brief AI graphics that explain what was just shown.\n"
                    "- Each SOURCE_CLIP shot MUST include:\n"
                    "  - `source_video_index`: integer (0 = Video A, 1 = Video B, ...)\n"
                    "  - `source_start`: timestamp (seconds) in THAT video\n"
                    "  - `source_end`: timestamp (seconds) in THAT video\n"
                    "- Cover the source video chronologically — walk through the demo from start\n"
                    "  to finish, don't skip large sections or jump around randomly.\n"
                    "- Match source_start/source_end to the transcript timestamps of the CORRECT video.\n"
                )
            _source_video_block = (
                "\n\n## SOURCE VIDEO CONTEXTS\n"
                f"You have {_num_sources} source video(s) available.\n"
                + "".join(_video_sections) + "\n"
                + _source_clip_rules
            )
            user_prompt = user_prompt + _source_video_block

        # Super Ultra: bias the Director toward motion-graphics shot types
        director_system = DIRECTOR_SYSTEM_PROMPT
        # Shot template catalog (premium / ultra / super_ultra).
        # Surfaces the available `template_id` values + their required
        # `template_params` schemas so the Director can opt into deterministic
        # compositions when content cleanly fits one.
        if self._tier_config.get("shot_templates_enabled"):
            try:
                from shot_template_registry import build_catalog_for_director  # type: ignore
                _canvas = "portrait" if _h > _w else "landscape"
                _tmpl_catalog = build_catalog_for_director(self._quality_tier, _canvas)
                if _tmpl_catalog:
                    director_system = director_system + "\n\n" + _tmpl_catalog
            except Exception as _e:
                print(f"   ⚠️ shot_template_registry unavailable for Director ({_e})")
        if self._tier_config.get("director_few_shot"):
            director_system = director_system + SUPER_ULTRA_DIRECTOR_EXTENSION
        if self._is_background_music_enabled():
            director_system = director_system + MUSIC_PLAN_EXTENSION
        # Routing-plan-driven extensions:
        #   • source_clip_priority=high  → strict 60% SOURCE_CLIP rule
        #   • infographic_mode=overlay  → overlay_slots[] shot-spec
        if (
            self._routing_config.get("source_clip_priority") == "high"
            and self._input_video_contexts
        ):
            director_system = director_system + STRICT_SOURCE_CLIP_DIRECTOR_EXTENSION
            print("🎯 Director: STRICT_SOURCE_CLIP mode active (source_clip_priority=high)")
        if (
            self._routing_config.get("infographic_mode") == "overlay"
            and self._input_video_contexts
        ):
            director_system = director_system + OVERLAY_INFOGRAPHIC_DIRECTOR_EXTENSION
            print("🪟 Director: OVERLAY infographic mode active")

        # Host extension — only when host=avatar. (host=raw uses SOURCE_CLIP path,
        # which already covers shot selection; raw-host generation is plumbing-only
        # this round and short-circuits later in the HTML stage.)
        if self._host_enabled and self._host_type == "avatar" and self._host_pct > 0:
            _is_portrait_h = _h > _w
            # Average shot duration must agree with the pacing style downstream
            # consumers use (PACING_PROFILES["seconds_per_shot"]). Otherwise
            # the host_target count we tell the Director will mismatch the
            # total-shot count the Director actually plans — Director will
            # under-allocate host shots and we'll burn fewer fal.ai calls
            # than the user paid for.
            _ps = getattr(self, "_pacing_style", "education")
            _profile = self.PACING_PROFILES.get(_ps) or self.PACING_PROFILES["education"]
            _avg_shot_dur = float(_profile.get("seconds_per_shot", 5.0))
            # Portrait nudge: portrait videos always feel faster. Pull the
            # average down a notch to match cheap-model bias toward shorter
            # vertical shots.
            if _is_portrait_h and _avg_shot_dur > 4.0:
                _avg_shot_dur = 3.0
            _est_total_shots = max(4, int(round(audio_duration / _avg_shot_dur)))
            _host_target = max(1, int(round(_est_total_shots * self._host_pct / 100.0)))
            # Orientation-aware host_layout vocabulary. Portrait videos can't
            # use side-by-side splits (free_left/free_right) — there isn't
            # enough horizontal real estate for a half-frame talking head and
            # a half-frame overlay to both stay legible at 1080×1920. Allow
            # only vertical splits + centered.
            if _is_portrait_h:
                _layout_vocab = '"free_top" | "free_bottom" | "centered"'
                _orientation_label = "9:16 PORTRAIT — horizontal splits forbidden"
            else:
                _layout_vocab = '"free_left" | "free_right" | "free_top" | "free_bottom" | "centered"'
                _orientation_label = "16:9 LANDSCAPE — all five layouts allowed"
            director_system = director_system + HOST_DIRECTOR_EXTENSION.format(
                host_pct=self._host_pct,
                host_target=_host_target,
                host_target_plus_one=_host_target + 1,
                host_total=_est_total_shots,
                orientation_label=_orientation_label,
                layout_vocabulary=_layout_vocab,
            )
            print(
                f"🎙️ Director: HOST mode active — target ~{_host_target}/{_est_total_shots} "
                f"shots host_present (={self._host_pct}%, "
                f"layouts={'portrait-vertical' if _is_portrait_h else 'all-five'})"
            )
        if self._tier_config.get("director_motion_bias"):
            _is_portrait = _h > _w
            # Cadence is content-aware: portrait OR short audio (<90s) is reel-pace;
            # landscape long-form (≥90s) is educational-explainer cadence — same
            # animation density requirement, but longer shots are appropriate
            # because the content is doing the work, not rapid cutting.
            _is_long_form = (audio_duration >= 90.0) and (not _is_portrait)
            if _is_long_form:
                _target_shot_dur = "4-7 seconds"
                _shots_divisor   = 5  # avg ~5s/shot
                _cadence_label   = "EDUCATIONAL EXPLAINER CADENCE"
                _format_para     = (
                    "This is long-form educational content (≥90s landscape). Shots should breathe — "
                    "every idea gets 4-7 seconds, complex internal animations (counters, draw-ins, "
                    "diagrams building) can run up to 8s when the motion fills the time. This is NOT "
                    "a TikTok reel. But it is also NOT a slow lecture — every shot still needs visible "
                    "motion throughout, no static screens for >0.8s."
                )
            else:
                _target_shot_dur = "2-3.5 seconds" if _is_portrait else "2-4 seconds"
                _shots_divisor   = 3  # avg ~3s/shot
                _cadence_label   = "REEL PACE + MOTION BIAS"
                _format_para     = (
                    "This is short-form social video (Reels/TikTok/Shorts) — shots must feel snappy, "
                    "not like a classroom explainer. Longer shots (max 5s) are only allowed for "
                    "PROCESS_STEPS / EQUATION_BUILD / DATA_STORY where the shot itself has heavy motion."
                )
            _min_shots_hint = (
                f"For a {int(audio_duration)}s audio, target ~{max(1, int(audio_duration / _shots_divisor))} shots "
                f"(roughly one per {_target_shot_dur} of narration)."
            ) if audio_duration > 0 else ""
            director_system = director_system + (
                f"\n\n**⚡ {_cadence_label}** (overrides rules 2, 4, 11):\n"
                f"- TARGET: every shot should be {_target_shot_dur} long. "
                f"{_min_shots_hint} "
                f"{_format_para}\n"
                "- At least 50% of shots MUST be motion-graphics types: "
                "TEXT_DIAGRAM, PROCESS_STEPS, EQUATION_BUILD, DATA_STORY, ANIMATED_ASSET, KINETIC_TEXT.\n"
                "- Never schedule 2+ consecutive IMAGE_HERO / VIDEO_HERO shots — "
                "always break them up with a motion-graphics shot.\n"
                "- KINETIC_TEXT is permitted up to 2 times per video (still never back-to-back). "
                "Include at least 1 KINETIC_TEXT shot when the video has ≥5 shots — ideal for the hook "
                "or a high-impact conclusion beat.\n"
                "- Each shot's `animation_strategy` field MUST describe at least 3 concrete animation "
                "steps with shot-relative seconds. Example: 'At 0.0s SVG heart draws on (path stroke), "
                "0.4s label fades in + slides up, 1.1s number counter runs 0→75bpm, 2.0s pulse ring "
                "expands.' Never write vague strategies like 'fade in text'. All step timings must "
                "fit inside the shot duration.\n"
                "- Each shot's `sync_points` array MUST contain at least 2 entries tied to specific "
                "narration words from the script.\n"
                "- Prefer shots that have visible continuous motion throughout — the screen should "
                "NEVER be fully static for more than 0.8s.\n"
                "- First shot may still be VIDEO_HERO / IMAGE_HERO (cinematic hook); for short-form keep "
                "it ≤3s with an animated text overlay appearing by 0.3s, for long-form up to 5s is fine.\n"
            )

        print("🎬 Running Director stage (shot planning)...")
        # Attach any user-uploaded reference images to the Director's user message
        # so it can plan shots that actually feature those assets (multimodal call).
        _ref_image_parts = self._build_director_reference_image_block()
        if _ref_image_parts:
            print(f"   🖼️  Attaching {len(_ref_image_parts)} reference image(s) to Director call")

        def _build_user_content(text: str) -> Any:
            if _ref_image_parts:
                return [{"type": "text", "text": text}] + _ref_image_parts
            return text

        max_attempts = 3
        last_error = None
        director_plan: Dict[str, Any] = {}
        raw: str = ""
        correction_message: Optional[str] = None
        # Token budget grows on truncation-detected retries. Caps at 1.5× the
        # tier's configured limit so a runaway model can't blow up the budget.
        _base_director_tokens = self._tier_config.get("director_max_tokens", 20000)
        _director_token_cap = int(_base_director_tokens * 1.5)
        _next_attempt_tokens = _base_director_tokens
        for attempt in range(max_attempts):
            try:
                # On retry after a malformed response, prepend a corrective message
                # that shows the LLM what it returned and what the correct shape is.
                messages: List[Dict[str, Any]] = [
                    {"role": "system", "content": director_system},
                    {"role": "user", "content": _build_user_content(user_prompt)},
                ]
                if correction_message and raw:
                    messages.append({"role": "assistant", "content": raw[:2000]})
                    messages.append({"role": "user", "content": correction_message})

                raw, attempt_usage = self.html_client.chat(
                    messages=messages,
                    temperature=0.5 if attempt == 0 else 0.3,  # lower temp on retries
                    max_tokens=_next_attempt_tokens,
                    response_format={"type": "json_object"},
                )
                if attempt_usage:
                    total_usage["prompt_tokens"] += attempt_usage.get("prompt_tokens", 0)
                    total_usage["completion_tokens"] += attempt_usage.get("completion_tokens", 0)
                    total_usage["total_tokens"] += attempt_usage.get("total_tokens", 0)
                print(f"   ℹ️  Director raw response length: {len(raw)} chars (budget {_next_attempt_tokens})")
                parsed = _extract_json_blob(raw)
                print(f"   ℹ️  Director parsed type: {type(parsed).__name__}; keys: {list(parsed.keys()) if isinstance(parsed, dict) else 'N/A'}")

                # Normalize the response into the canonical {"shots": [...]} envelope.
                # Handles several common LLM failure modes:
                #   1. Already correct: {"shots": [...]}
                #   2. Flat single shot: {"shot_index": 0, "shot_type": ...}  → wrap
                #   3. Bare list: [{...}, {...}]                               → wrap
                #   4. Wrong key: {"shot": {...}} or {"plan": [...]}           → unwrap+wrap
                director_plan = self._normalize_director_plan(parsed, audio_duration)

                if director_plan.get("shots"):
                    break

                # Empty shots after normalization — set up corrective retry
                correction_message = (
                    "Your previous response was not in the correct shape. "
                    "The response MUST be a single JSON object with a top-level `shots` array, "
                    "where each item in the array is a shot object. "
                    "Example of CORRECT shape:\n"
                    '{"shots": [ {"shot_index": 0, "shot_type": "VIDEO_HERO", "start_time": 0.0, ...}, '
                    '{"shot_index": 1, ...} ], "continuity_notes": "..."}\n\n'
                    f"Re-emit your plan covering the full {audio_duration:.1f}s audio, "
                    "wrapped in the `shots` array. Return JSON only."
                )
                print(f"   ⚠️ Director attempt {attempt + 1} returned no shots after normalization — retrying with correction")

            except (ValueError, Exception) as e:
                last_error = e
                print(f"   ⚠️ Director attempt {attempt + 1}/{max_attempts} failed: {e}")
                # Log first 500 chars of raw response if available for debugging
                if raw:
                    print(f"   ℹ️  Raw response preview: {raw[:500]}...")

                # Detect truncation — a non-empty response that doesn't close
                # its outer JSON structure means the model ran out of tokens
                # mid-output. Retrying at the same budget will fail the same
                # way; bump by 50% (capped at 1.5× the tier limit). If `raw`
                # is empty, this isn't a truncation signal — leave the budget.
                _stripped = raw.strip() if raw else ""
                _looks_truncated = bool(_stripped) and not (
                    _stripped.endswith("}") or _stripped.endswith("]")
                )
                if _looks_truncated and _next_attempt_tokens < _director_token_cap:
                    _bumped = min(int(_next_attempt_tokens * 1.5), _director_token_cap)
                    print(
                        f"   📈 Director output looks truncated "
                        f"(no closing `}}`/`]`) — bumping max_tokens "
                        f"{_next_attempt_tokens} → {_bumped} for next attempt"
                    )
                    _next_attempt_tokens = _bumped

                # On parse error, send a simpler corrective retry asking for valid JSON
                correction_message = (
                    "Your previous response could not be parsed as JSON. "
                    "Return ONLY a JSON object with a top-level `shots` array. "
                    "No markdown fences, no commentary, no prose. "
                    "First character must be `{`, last must be `}`."
                )
                time.sleep(2)
        else:
            print(f"   ❌ Director failed after {max_attempts} attempts — falling back to segment flow")
            if last_error:
                print(f"   ❌ Last error: {last_error}")
            # Save for debugging
            try:
                (run_dir / "director_debug.json").write_text(
                    json.dumps({"raw": raw, "last_error": str(last_error)}, indent=2)
                )
            except Exception:
                pass
            return None, total_usage

        # Validate the director plan (post-normalization guarantees `shots` key exists)
        shots = director_plan.get("shots", [])
        if not shots:
            print(f"   ⚠️ Director returned empty shots list after retries — falling back")
            print(f"   ℹ️  Director plan contents: {json.dumps(director_plan, indent=2)[:1000]}")
            # Save for debugging
            try:
                (run_dir / "director_debug.json").write_text(json.dumps({"raw": raw, "parsed": director_plan}, indent=2))
                print(f"   ℹ️  Debug saved to {run_dir / 'director_debug.json'}")
            except Exception:
                pass
            return None, total_usage

        # Sanity check: one shot covering a long video almost always means
        # the LLM produced a broken/truncated plan. Falling back to the
        # segment-based flow gives a varied video instead of a static one.
        non_overlay_count = sum(1 for s in shots if not s.get("overlay"))
        if non_overlay_count <= 1 and audio_duration > 15.0:
            print(
                f"   ⚠️ Director produced only {non_overlay_count} primary shot(s) "
                f"for {audio_duration:.1f}s audio — falling back to segment flow"
            )
            try:
                (run_dir / "director_debug.json").write_text(
                    json.dumps({"raw": raw, "parsed": director_plan, "reason": "too_few_shots"}, indent=2)
                )
            except Exception:
                pass
            return None, total_usage

        # Validate shot types
        valid_types = {
            "IMAGE_HERO", "VIDEO_HERO", "IMAGE_SPLIT", "TEXT_DIAGRAM",
            "LOWER_THIRD", "ANNOTATION_MAP", "DATA_STORY", "PROCESS_STEPS",
            "EQUATION_BUILD", "ANIMATED_ASSET", "KINETIC_TEXT",
            "INFOGRAPHIC_SVG", "KINETIC_TITLE", "PRODUCT_HERO",
            "SOURCE_CLIP",
        }
        for i, shot in enumerate(shots):
            if shot.get("shot_type") not in valid_types:
                print(f"   ⚠️ Director shot {i} has invalid type '{shot.get('shot_type')}' — defaulting to TEXT_DIAGRAM")
                shot["shot_type"] = "TEXT_DIAGRAM"
            # Ensure required fields have defaults
            shot.setdefault("start_time", 0.0)
            shot.setdefault("end_time", audio_duration)
            shot.setdefault("narration_excerpt", "")
            shot.setdefault("visual_description", "")
            shot.setdefault("text_elements", [])
            shot.setdefault("animation_strategy", "")
            shot.setdefault("sync_points", [])
            shot.setdefault("complexity_level", "moderate")
            shot.setdefault("overlay", False)
            shot.setdefault("start_word", "")

        # Validate timeline coverage: shots should be sequential and cover full duration
        non_overlay = [s for s in shots if not s.get("overlay")]
        if non_overlay:
            non_overlay.sort(key=lambda s: float(s.get("start_time", 0)))
            # Fill gaps: if shot N end != shot N+1 start, extend shot N
            for i in range(len(non_overlay) - 1):
                gap = float(non_overlay[i + 1]["start_time"]) - float(non_overlay[i]["end_time"])
                if gap > 0.5:
                    non_overlay[i]["end_time"] = non_overlay[i + 1]["start_time"]

        # ── Transition picker (premium / ultra / super_ultra) ──
        # Replace the Director's blind `transition_in` choices with deterministic
        # content-aware picks based on (prev_shot, shot, act_boundary). Also
        # honors the Act Planner's `transition_out` field — previously dropped.
        # Pure function; never raises; falls back to `fade` for unknown values.
        if self._tier_config.get("transition_picker_enabled"):
            try:
                from transition_picker import apply_to_plan as _apply_transitions  # type: ignore
                changes = _apply_transitions(director_plan, act_plan=act_plan)
                if changes:
                    for shot_idx, old, new, reason in changes[:6]:
                        print(f"   🎬 Shot {shot_idx + 1} transition: {old} → {new} ({reason})")
                    if len(changes) > 6:
                        print(f"      ... {len(changes) - 6} more transition changes")
                else:
                    print("   🎬 Transition picker: no changes (Director picks were optimal)")
            except Exception as _tp_err:
                print(f"   ⚠️ Transition picker failed ({_tp_err}) — keeping Director picks")

        # ── Subject extractor (ultra / super_ultra) ──
        # Identifies recurring subjects (a specific character, product, location)
        # across the shot plan. The mapping `{shot_index: subject_id}` is stashed
        # on `self._subject_id_for_shot` and used by `_process_generated_images`
        # to thread image-to-image references through Seedream so the same
        # subject looks consistent across shots. One Gemini Flash call per video.
        # Initialize per-run state regardless of tier so concurrent access is safe.
        import threading as _threading_subj
        self._subject_id_for_shot = {}
        self._subject_refs = {}
        self._subject_ready_events = {}
        self._subject_first_claimed = set()
        self._subject_meta_lock = _threading_subj.Lock()
        if self._tier_config.get("image_continuity_enabled"):
            try:
                from subject_extractor import extract_subjects as _extract_subjects  # type: ignore
                mapping, subjects = _extract_subjects(shots, self.html_client.chat)
                self._subject_id_for_shot = mapping
                if subjects:
                    print(
                        f"   🎯 Subject extraction: {len(subjects)} recurring "
                        f"subject(s) across {len(mapping)} shots"
                    )
                    for sub in subjects[:6]:
                        print(
                            f"      • '{sub['id']}' ({sub.get('label', '')}) "
                            f"→ shots {sub['shot_indices']}"
                        )
                else:
                    print("   🎯 Subject extraction: no recurring subjects found")
            except Exception as _se_err:
                print(f"   ⚠️ Subject extraction failed ({_se_err}) — falling back to text-only image gen")

        # Save for debugging
        director_path = run_dir / "director_plan.json"
        director_path.write_text(json.dumps(director_plan, indent=2, ensure_ascii=False))
        print(f"   ✅ Director planned {len(shots)} shots ({len(non_overlay)} primary + {len(shots) - len(non_overlay)} overlays)")

        # Coverage warning — when routing_plan asks for ≥N% of source-video duration
        # to be covered by SOURCE_CLIPs but the Director planned less. Soft warning
        # for now (logs only); upgrade to hard-fail later once we have data.
        try:
            _cov_min_pct = int((self._routing_config or {}).get("coverage_min_pct", 0) or 0)
            if _cov_min_pct > 0 and self._input_video_contexts:
                _total_src_dur = 0.0
                for _ivc in self._input_video_contexts:
                    _ivc_meta = (_ivc.get("context") or {}).get("meta") or {}
                    _total_src_dur += float(_ivc_meta.get("duration_s", 0) or 0)
                if _total_src_dur > 0:
                    _src_clip_dur = 0.0
                    for _s in shots:
                        if _s.get("shot_type") == "SOURCE_CLIP":
                            _ss = float(_s.get("source_start", 0) or 0)
                            _se = float(_s.get("source_end", 0) or 0)
                            if _se > _ss:
                                _src_clip_dur += (_se - _ss)
                    _cov_pct = (_src_clip_dur / _total_src_dur) * 100.0
                    if _cov_pct < _cov_min_pct:
                        print(
                            f"   [ROUTER] coverage {_cov_pct:.0f}% < threshold {_cov_min_pct}% — "
                            f"SOURCE_CLIP shots cover {_src_clip_dur:.0f}s of {_total_src_dur:.0f}s "
                            f"available source video"
                        )
                    else:
                        print(
                            f"   [ROUTER] coverage {_cov_pct:.0f}% (≥ {_cov_min_pct}% threshold) ✓"
                        )
        except Exception as _cov_err:
            print(f"   [ROUTER] coverage check skipped: {_cov_err}")

        # Log / sanity-check Director's self-reported density (super_ultra only)
        density = director_plan.get("shot_density")
        rationale = director_plan.get("pacing_rationale")
        if density:
            avg_shot = audio_duration / max(1, len(non_overlay)) if non_overlay else 0.0
            expected_bucket = (
                "fast" if avg_shot <= 2.5 else
                "slow" if avg_shot >= 4.0 else
                "medium"
            )
            mismatch = "" if density == expected_bucket else f" ⚠️ MISMATCH — actual bucket is '{expected_bucket}'"
            print(f"   🎯 Density: self-reported='{density}' | actual avg={avg_shot:.2f}s/shot → '{expected_bucket}'{mismatch}")
            if rationale:
                print(f"   📝 Rationale: {rationale}")

        return director_plan, total_usage

    # ------------------------------------------------------------------
    # Sub-shot decomposition (experimental) — split dense shots in 2
    # ------------------------------------------------------------------

    def _decompose_shot(
        self,
        shot: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """Optionally split one shot into 2 focused sub-shots.

        Uses a heuristic gate first to skip cheap shots, then a small LLM
        call (script_client) to make the decision. Returns the original
        shot unchanged if decomposition isn't warranted or any validation
        fails (graceful fallback).
        """
        try:
            duration = float(shot.get("end_time", 0)) - float(shot.get("start_time", 0))
        except (TypeError, ValueError):
            return [shot]

        shot_type = shot.get("shot_type", "")
        # Never split typography-only shots — they are already a single beat.
        if shot_type in ("KINETIC_TEXT", "KINETIC_TITLE", "SOURCE_CLIP"):
            return [shot]

        complexity = shot.get("complexity_level", "moderate")
        text_elements = shot.get("text_elements", []) or []
        anim = (shot.get("animation_strategy", "") or "").lower()
        needs_check = (
            (duration > 6.0 and complexity == "dense")
            or len(text_elements) > 5
            or (" then " in anim or "phase" in anim)
        )
        if not needs_check:
            return [shot]

        sys_prompt = (
            "You are a video shot decomposer. Decide if a shot should split into exactly "
            "2 focused sub-shots.\n"
            "Split ONLY when animation_strategy has two clearly distinct visual phases, OR "
            "text_elements has 6+ items in 2 logical groups.\n"
            "Do NOT split progressive builds (growing chart, equation reveal, step-by-step).\n"
            "Return JSON only: {\"should_split\": false}\n"
            "OR {\"should_split\": true, \"sub_shots\": [<shot_a>, <shot_b>]}\n"
            "Sub-shots: contiguous (a.start==parent.start, b.end==parent.end, "
            "a.end==b.start), same shot_type, focused visual_description / "
            "animation_strategy / text_elements, narration_excerpt split at a natural "
            "sentence break, sync_points split by time range."
        )
        user_prompt = (
            f"Parent shot:\n{json.dumps(shot, ensure_ascii=False)}\n\n"
            "Decide and return JSON only."
        )

        try:
            raw, _usage = self.script_client.chat(
                messages=[
                    {"role": "system", "content": sys_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.3,
                max_tokens=1200,
            )
            data = _extract_json_blob(raw)
        except Exception as exc:
            print(f"   ⚠️  Decomposer call failed for shot {shot.get('shot_index', '?')}: {exc}")
            return [shot]

        if not isinstance(data, dict) or not data.get("should_split"):
            return [shot]

        sub_shots = data.get("sub_shots") or []
        if len(sub_shots) != 2:
            return [shot]

        try:
            a, b = sub_shots[0], sub_shots[1]
            a_start = float(a.get("start_time"))
            a_end = float(a.get("end_time"))
            b_start = float(b.get("start_time"))
            b_end = float(b.get("end_time"))
            p_start = float(shot.get("start_time"))
            p_end = float(shot.get("end_time"))
        except (TypeError, ValueError, KeyError):
            return [shot]

        if not (
            abs(a_start - p_start) < 0.01
            and abs(b_end - p_end) < 0.01
            and abs(a_end - b_start) < 0.01
        ):
            return [shot]

        # Field inheritance — copy parent context the decomposer didn't set
        _inherit_keys = ("image_prompt", "video_query", "notes", "overlay", "beat_index")
        for _ss in (a, b):
            for _k in _inherit_keys:
                if _k not in _ss and _k in shot:
                    _ss[_k] = shot[_k]
            _ss.setdefault("shot_type", shot_type)

        # transition_in: first sub-shot inherits parent's; second uses 'cut' (interior)
        a["transition_in"] = shot.get("transition_in") or "fade"
        b["transition_in"] = "cut"

        return [a, b]

    # ------------------------------------------------------------------
    # Avatar Batch — per-shot host-avatar generation (runs INSIDE HTML stage)
    # ------------------------------------------------------------------
    # When host_plan is enabled, this runs after the Director plan is ready
    # but BEFORE per-shot HTML generation, so each host_present shot already
    # carries its avatar_video_url when the per-shot LLM prompt is built.
    #
    # Pipeline (per host_present=true shot):
    #   1. Build avatar image prompt (host details + scene/layout from Director)
    #   2. Seedream image-to-image conditioned on user-supplied face_image_url
    #      → upload PNG to S3
    #   3. Slice master TTS MP3 at [start_time, end_time] using ffmpeg
    #      → upload MP3 slice to S3
    #   4. fal.ai talking-head: (image, audio) → MP4 → S3
    #   5. Mutate shot["avatar_video_url"], shot["host_image_url"], shot["audio_slice_url"]
    #
    # All per-shot operations run with bounded concurrency. Per-shot failures
    # (any stage) flip that shot's host_present back to False so per-shot HTML
    # gen falls through to the regular non-host path. The full batch never
    # aborts on a single failure.

    def _run_avatar_batch_sync(
        self,
        director_plan: Dict[str, Any],
        run_dir: "Path",
    ) -> Dict[str, Any]:
        """Generate per-shot avatar videos for every host_present shot.

        MUTATES `director_plan["shots"]` in place — host shots get
        `avatar_video_url`, `host_image_url`, `audio_slice_url` populated;
        failed shots get `host_present` flipped to False.

        Returns a summary dict suitable for persistence into
        extra_metadata.host.outputs.
        """
        from pathlib import Path as _Path
        import json as _json
        import subprocess as _sp
        import asyncio as _asyncio

        if not (self._host_enabled and self._host_type == "avatar"):
            return {"skipped": True, "reason": "host not avatar-enabled"}

        avatar_cfg = self._host_plan.get("avatar") or {}
        host_model = avatar_cfg.get("avatar_model") or "fal-ai/kling-video/ai-avatar/v2/standard"
        host_quality = avatar_cfg.get("quality") or "480p"
        face_image_url = avatar_cfg.get("face_image_url") or ""
        details_prompt = avatar_cfg.get("details_prompt") or ""

        if not face_image_url:
            print("[AvatarBatch] ⚠️  No face_image_url — disabling host for this run")
            for s in director_plan.get("shots", []):
                if s.get("host_present"):
                    s["host_present"] = False
            return {"skipped": True, "reason": "missing face_image_url"}

        shots = director_plan.get("shots") or []
        host_shots = [
            (idx, s) for idx, s in enumerate(shots) if s.get("host_present")
        ]
        if not host_shots:
            print("[AvatarBatch] No host_present shots — nothing to render")
            return {"skipped": True, "reason": "no host_present shots"}

        print(f"[AvatarBatch] Rendering {len(host_shots)} host shot(s) "
              f"(model={host_model}, quality={host_quality})")
        self._emit_progress({
            "type": "sub_stage",
            "sub_stage": "avatar_batch_start",
            "stage": "html",
            "message": f"Rendering {len(host_shots)} host avatar shot(s)...",
            "host_shot_count": len(host_shots),
        })

        # --- 0. Master audio path (master TTS MP3 already on disk in run_dir) ---
        # Canonical location is run_dir/narration.mp3 (TTS stage writes it
        # there + the resume path downloads it from S3 to the same name).
        # Probe a couple of legacy fallbacks defensively.
        master_audio = None
        for cand_name in ("narration.mp3", "audio/narration.mp3", "audio.mp3", "tts.mp3"):
            cand = _Path(run_dir) / cand_name
            if cand.exists():
                master_audio = cand
                break
        if master_audio is None:
            print(f"[AvatarBatch] ❌ master TTS MP3 not found in {run_dir} — disabling host")
            for _, s in host_shots:
                s["host_present"] = False
            return {"skipped": True, "reason": "master audio missing"}

        # --- 1. Per-shot image gen + audio slice (sequential — fast, in-process) ---
        # We do these synchronously because Seedream and ffmpeg are quick (<5s
        # each) and serialising avoids overlapping S3 multipart uploads.
        per_shot_inputs: List[Dict[str, Any]] = []
        per_shot_artifacts: List[Dict[str, Any]] = []
        errors: List[Dict[str, Any]] = []

        host_assets_dir = _Path(run_dir) / "host_assets"
        host_assets_dir.mkdir(parents=True, exist_ok=True)

        # The pipeline class doesn't carry an s3_service attribute — it
        # instantiates one locally where needed (mirrors the existing pattern
        # at automation_pipeline.py:10420 for the legacy avatar upload).
        # Without this, AvatarBatch crashes with AttributeError on the very
        # first shot (witnessed in ai_pipe.txt run @ 06:31).
        try:
            import sys as _sys_s3
            from pathlib import Path as _Path_s3
            _app_dir = _Path_s3(__file__).parent.parent
            if str(_app_dir.parent) not in _sys_s3.path:
                _sys_s3.path.insert(0, str(_app_dir.parent))
            from app.services.s3_service import S3Service
            s3_service = S3Service()
        except Exception as _s3_err:
            print(f"[AvatarBatch] ❌ Could not instantiate S3Service: {_s3_err} — disabling host")
            for _, s in host_shots:
                s["host_present"] = False
            return {"skipped": True, "reason": f"s3_service unavailable: {_s3_err}"}

        # Resume idempotency: load any prior host_outputs.json so we skip
        # already-completed shots (Seedream + fal.ai are the expensive parts;
        # re-running them on resume would double-bill the user). Indexed by
        # shot_index. Failed shots are NOT carried over — we retry those.
        _prior_artifacts: Dict[int, Dict[str, Any]] = {}
        _prior_outputs_file = _Path(run_dir) / "host_outputs.json"
        if _prior_outputs_file.exists():
            try:
                import json as _json_resume
                _prior = _json_resume.loads(_prior_outputs_file.read_text(encoding="utf-8"))
                for art in (_prior.get("shot_artifacts") or []):
                    if (
                        art.get("status") == "completed"
                        and art.get("avatar_video_url")
                        and isinstance(art.get("shot_index"), int)
                    ):
                        _prior_artifacts[int(art["shot_index"])] = art
                if _prior_artifacts:
                    print(
                        f"[AvatarBatch] ♻️  Resume: {len(_prior_artifacts)} shots already "
                        f"completed in prior run — will skip + reuse their avatars"
                    )
            except Exception as _re_err:
                print(f"[AvatarBatch] ⚠️  Could not load prior host_outputs.json on resume: {_re_err}")

        for shot_idx, shot in host_shots:
            # Resume short-circuit: already-completed shot — reuse the URL,
            # skip Seedream + ffmpeg + fal.ai.
            if shot_idx in _prior_artifacts:
                _cached = _prior_artifacts[shot_idx]
                shot["avatar_video_url"] = _cached["avatar_video_url"]
                if _cached.get("host_image_url"):
                    shot["host_image_url"] = _cached["host_image_url"]
                if _cached.get("audio_slice_url"):
                    shot["audio_slice_url"] = _cached["audio_slice_url"]
                # Strip background-visual fields (same logic as success path)
                shot.pop("image_prompt", None)
                shot.pop("video_query", None)
                per_shot_artifacts.append(_cached)
                continue

            artifact: Dict[str, Any] = {
                "shot_index": shot_idx,
                "model": host_model,
                "quality": host_quality,
                "status": "pending",
            }
            try:
                # 1a. Image gen
                # Compose the Seedream prompt from three sources, in order of
                # precedence:
                #   1. STRUCTURAL framing instruction (derived from host_layout)
                #      — non-negotiable, dictates which half/quadrant of canvas
                #      stays empty so the per-shot HTML overlay zone has space.
                #   2. DIRECTOR'S scene hint (host_image_prompt) — Director-LLM
                #      output describing the scene/background tailored to this
                #      shot's narration. We treat this as flavour, NOT framing,
                #      so we strip layout-style language from it.
                #   3. PERSONA/CLOTHING from the user's host_details_prompt —
                #      kept consistent across shots.
                layout = shot.get("host_layout") or "centered"
                _layout_framing = {
                    "free_left":   "Subject framed on the RIGHT half of the canvas; LEFT half intentionally empty (clean background, no objects) — reserved for graphics overlay.",
                    "free_right":  "Subject framed on the LEFT half of the canvas; RIGHT half intentionally empty (clean background) — reserved for graphics overlay.",
                    "free_top":    "Subject framed in the BOTTOM 60% of the canvas; TOP 40% intentionally empty — reserved for headline/banner overlay.",
                    "free_bottom": "Subject framed in the TOP 60%; BOTTOM 40% empty — reserved for lower-third overlay.",
                    "centered":    "Subject centered in the frame, looking just past camera. Pure to-camera shot, no overlay zones reserved.",
                }.get(layout, "")
                # Defensive coercion: portrait videos can't use side splits.
                # If Director ignored our HOST_DIRECTOR_EXTENSION restriction
                # and emitted free_left/free_right on a portrait shot, force
                # `centered` (safest fallback) and stamp the original choice
                # into the artifact so we can spot Director non-compliance.
                _is_portrait_render = self.video_height > self.video_width
                if _is_portrait_render and layout in ("free_left", "free_right"):
                    print(f"[AvatarBatch] ⚠️  shot={shot_idx} layout={layout} invalid for portrait — coercing to 'centered'")
                    artifact["host_layout_original"] = layout
                    layout = "centered"
                    shot["host_layout"] = "centered"

                # Director's per-shot scene hint — keep it short and sanitise
                # any layout-style instructions (we own the framing, not the LLM).
                _director_hint = (shot.get("host_image_prompt") or "").strip()
                if len(_director_hint) > 300:
                    _director_hint = _director_hint[:300].rsplit(" ", 1)[0] + "…"
                _img_prompt_parts = [
                    "Cinematic medium-shot portrait of a person speaking to camera.",
                    f"Persona / clothing: {details_prompt}." if details_prompt else "",
                    f"Scene context: {_director_hint}" if _director_hint else "",
                    _layout_framing,
                    "Photo-real, soft natural lighting, shallow depth of field.",
                    "DO NOT render any text, logos, captions, lower-thirds, charts, or graphic overlays — those are added downstream by the renderer.",
                ]
                avatar_img_prompt = " ".join(p for p in _img_prompt_parts if p).strip()
                artifact["host_image_prompt"] = avatar_img_prompt
                artifact["director_scene_hint"] = _director_hint

                _img_w = self.video_width
                _img_h = self.video_height
                img_bytes, _img_usage = self._call_image_generation_llm(
                    avatar_img_prompt,
                    width=_img_w,
                    height=_img_h,
                    reference_image_url=face_image_url,
                )
                if not img_bytes:
                    raise RuntimeError("Seedream returned no bytes for host image")
                local_img = host_assets_dir / f"host_shot_{shot_idx:03d}.png"
                local_img.write_bytes(img_bytes)
                # Upload to S3
                _img_s3_key = f"ai-videos/host-assets/{getattr(self, '_run_name', 'run')}/host_shot_{shot_idx:03d}.png"
                img_s3_url = s3_service.upload_file(
                    local_img, s3_key=_img_s3_key, content_type="image/png"
                )
                if not img_s3_url:
                    raise RuntimeError("S3 upload failed for host image")
                shot["host_image_url"] = img_s3_url
                artifact["host_image_url"] = img_s3_url

                # 1b. Audio slice via ffmpeg.
                # Always re-encode (libmp3lame). Stream-copy slicing on VBR MP3
                # produces frame-misaligned output that fal.ai sometimes
                # rejects, and the timing offset causes lipsync drift. Use
                # PRE-`-i` -ss for fast seek, then re-encode at q=4 (~165kbps).
                # Cost: ~30-100ms per shot — negligible vs fal.ai's 10-30s.
                start_time = float(shot.get("start_time", 0))
                end_time = float(shot.get("end_time", start_time + 6))
                duration_s = max(0.5, end_time - start_time)
                local_audio = host_assets_dir / f"host_audio_{shot_idx:03d}.mp3"
                _ff_cmd = [
                    "ffmpeg", "-y", "-loglevel", "error",
                    "-ss", f"{start_time:.3f}",         # fast pre-seek
                    "-i", str(master_audio),
                    "-t", f"{duration_s:.3f}",
                    "-vn",
                    "-acodec", "libmp3lame", "-q:a", "4",
                    "-ac", "2", "-ar", "44100",
                    str(local_audio),
                ]
                _r = _sp.run(_ff_cmd, capture_output=True, text=True)
                if _r.returncode != 0 or not local_audio.exists():
                    raise RuntimeError(f"ffmpeg slice failed: {_r.stderr or '<no stderr>'}")
                _aud_s3_key = f"ai-videos/host-assets/{getattr(self, '_run_name', 'run')}/host_audio_{shot_idx:03d}.mp3"
                aud_s3_url = s3_service.upload_file(
                    local_audio, s3_key=_aud_s3_key, content_type="audio/mpeg"
                )
                if not aud_s3_url:
                    raise RuntimeError("S3 upload failed for host audio slice")
                shot["audio_slice_url"] = aud_s3_url
                artifact["audio_slice_url"] = aud_s3_url
                artifact["duration_s"] = duration_s

                per_shot_inputs.append({
                    "shot_index": shot_idx,
                    "image_url": img_s3_url,
                    "audio_url": aud_s3_url,
                })
                self._emit_progress({
                    "type": "sub_stage",
                    "sub_stage": "avatar_image_audio_ready",
                    "stage": "html",
                    "message": (
                        f"Host shot {len(per_shot_inputs)}/{len(host_shots)} prepared "
                        f"(image + audio slice ready)"
                    ),
                    "shot_index": shot_idx,
                    "host_shot_completed": len(per_shot_inputs),
                    "host_shot_count": len(host_shots),
                })
            except Exception as e:
                print(f"[AvatarBatch] ❌ shot={shot_idx} pre-render failed: {e}")
                errors.append({"shot_index": shot_idx, "stage": "pre_render", "error": str(e)})
                shot["host_present"] = False  # fall back to non-host
                artifact["status"] = "failed"
                artifact["error"] = str(e)
                artifact["error_stage"] = "pre_render"
            finally:
                per_shot_artifacts.append(artifact)

        if not per_shot_inputs:
            print("[AvatarBatch] No shots survived pre-render — disabling all host shots")
            return {
                "host_shot_count": 0,
                "shot_artifacts": per_shot_artifacts,
                "errors": errors,
                "total_host_seconds": 0.0,
            }

        # --- 2. fal.ai render in parallel with bounded concurrency ---
        try:
            from app.config import get_settings as _get_settings_p
        except Exception:
            from ..config import get_settings as _get_settings_p  # type: ignore[no-redef]
        try:
            _settings_p = _get_settings_p()
            fal_key = getattr(_settings_p, "fal_api_key", None) or ""
        except Exception:
            fal_key = ""
        if not fal_key:
            print("[AvatarBatch] ❌ FAL_API_KEY not set — disabling host shots")
            for inp in per_shot_inputs:
                idx = inp["shot_index"]
                shots[idx]["host_present"] = False
                for art in per_shot_artifacts:
                    if art.get("shot_index") == idx:
                        art["status"] = "failed"
                        art["error"] = "FAL_API_KEY not set"
                        art["error_stage"] = "fal_submit"
            return {
                "host_shot_count": 0,
                "shot_artifacts": per_shot_artifacts,
                "errors": errors + [{"stage": "fal_submit", "error": "FAL_API_KEY not set"}],
                "total_host_seconds": 0.0,
            }

        try:
            from app.services.fal_avatar_client import FalAvatarClient
        except Exception:
            # When automation_pipeline runs out of the ai-video-gen-main dir,
            # the absolute import path may not resolve — try the relative path
            # from sys.path's app root.
            import importlib
            FalAvatarClient = importlib.import_module("app.services.fal_avatar_client").FalAvatarClient

        client = FalAvatarClient(api_key=fal_key, concurrency=4)
        try:
            fal_results = _asyncio.run(
                client.render_batch(
                    per_shot_inputs,
                    model=host_model,
                    quality=host_quality,
                    details_prompt=details_prompt,
                )
            )
        except Exception as e:
            print(f"[AvatarBatch] ❌ fal.ai batch failed catastrophically: {e}")
            for inp in per_shot_inputs:
                idx = inp["shot_index"]
                shots[idx]["host_present"] = False
            for art in per_shot_artifacts:
                if art.get("status") == "pending":
                    art["status"] = "failed"
                    art["error"] = str(e)
                    art["error_stage"] = "fal_batch"
            errors.append({"stage": "fal_batch", "error": str(e)})
            return {
                "host_shot_count": 0,
                "shot_artifacts": per_shot_artifacts,
                "errors": errors,
                "total_host_seconds": 0.0,
            }

        # --- 3. Apply fal results to shots + artifacts ---
        # Seed with resumed-and-already-completed shots so the run summary
        # reflects the union of prior + new work. Without this, total_host_seconds
        # would be wrong on a resume that re-renders only the failed subset.
        total_host_seconds = 0.0
        ok_shots: List[int] = []
        for _seed in per_shot_artifacts:
            if _seed.get("status") == "completed":
                _sd = float(_seed.get("duration_s_actual") or _seed.get("duration_s") or 0.0)
                total_host_seconds += _sd
                _idx_seed = _seed.get("shot_index")
                if isinstance(_idx_seed, int):
                    ok_shots.append(_idx_seed)
        for r in fal_results:
            idx = r.shot_index
            target_artifact = next(
                (a for a in per_shot_artifacts if a.get("shot_index") == idx),
                None,
            )
            if r.error:
                if idx < len(shots):
                    shots[idx]["host_present"] = False
                if target_artifact:
                    target_artifact["status"] = "failed"
                    target_artifact["error"] = r.error
                    target_artifact["error_stage"] = r.error_stage
                    target_artifact["fal_request_id"] = r.fal_request_id
                errors.append({
                    "shot_index": idx,
                    "stage": r.error_stage or "fal",
                    "error": r.error,
                })
                self._emit_progress({
                    "type": "sub_stage",
                    "sub_stage": "avatar_failed",
                    "stage": "html",
                    "message": f"Host shot #{idx} failed — falling back to non-host: {r.error}",
                    "shot_index": idx,
                    "error": r.error,
                })
                continue
            # Success
            if idx < len(shots):
                shots[idx]["avatar_video_url"] = r.video_url
                # Strip background-visual fields from a successful host shot —
                # the host video IS the background, and the per-shot HTML LLM
                # would otherwise dutifully also emit a data-img-prompt or
                # data-video-query, layering a stock/AI image UNDER the host.
                # Removing the fields makes the per-shot HOST instruction
                # block (which says "no full-canvas background") unambiguous.
                _host_shot_dict = shots[idx]
                _host_shot_dict.pop("image_prompt", None)
                _host_shot_dict.pop("video_query", None)
            if target_artifact:
                target_artifact["status"] = "completed"
                target_artifact["avatar_video_url"] = r.video_url
                target_artifact["fal_request_id"] = r.fal_request_id
                if r.duration_s:
                    target_artifact["duration_s_actual"] = r.duration_s
            # Use the actual avatar duration if reported, else the audio slice length.
            _dur = r.duration_s
            if _dur is None and target_artifact:
                _dur = target_artifact.get("duration_s")
            total_host_seconds += float(_dur or 0.0)
            ok_shots.append(idx)
            self._emit_progress({
                "type": "sub_stage",
                "sub_stage": "avatar_render_done",
                "stage": "html",
                "message": f"Host shot {len(ok_shots)}/{len(host_shots)} rendered",
                "shot_index": idx,
                "host_shot_completed": len(ok_shots),
                "host_shot_count": len(host_shots),
            })

        # --- 4. Persist host_outputs.json beside director_plan.json ---
        outputs = {
            "host_shot_indices": ok_shots,
            "host_shot_count": len(ok_shots),
            "total_host_seconds": round(total_host_seconds, 2),
            "shot_artifacts": per_shot_artifacts,
            "errors": errors,
        }
        try:
            (_Path(run_dir) / "host_outputs.json").write_text(
                _json.dumps(outputs, indent=2), encoding="utf-8"
            )
        except Exception as e:
            print(f"[AvatarBatch] ⚠️  Could not persist host_outputs.json: {e}")

        print(
            f"[AvatarBatch] Done: {len(ok_shots)}/{len(host_shots)} shots OK, "
            f"{len(errors)} errors, ~{total_host_seconds:.1f}s of avatar video"
        )
        self._emit_progress({
            "type": "sub_stage",
            "sub_stage": "avatar_batch_done",
            "stage": "html",
            "message": (
                f"Avatar batch done: {len(ok_shots)}/{len(host_shots)} OK, "
                f"{len(errors)} failed, {total_host_seconds:.0f}s"
            ),
            "host_shot_count": len(ok_shots),
        })
        return outputs

    # ------------------------------------------------------------------
    # Per-Shot HTML generation — uses Director plan + focused prompts
    # ------------------------------------------------------------------

    def _generate_html_per_shot(
        self,
        director_plan: Dict[str, Any],
        style_guide: Dict[str, Any],
        words: List[Dict[str, Any]],
        run_dir: Path,
        language: str = "English",
        on_segment_done: Optional[Any] = None,
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """Generate HTML for each shot independently using the Director's plan.

        Each shot gets a focused system prompt containing only the relevant
        shot type card, plus the Director's visual instructions.

        Returns (entries, usage) in the same format as _generate_html_segments.
        """
        from shot_type_cards import build_per_shot_system_prompt
        from prompts import PER_SHOT_USER_PROMPT_TEMPLATE, get_html_generation_safe_area, TRANSITION_CSS_BLOCKS

        # Skill library (ultra/super_ultra) — resolved lazily below per-shot
        _skill_enabled = bool(self._tier_config.get("skill_library_enabled"))
        _skill_catalog_fn = None
        _skill_compose_fn = None
        if _skill_enabled:
            try:
                from skill_registry import build_catalog_for_shot as _skill_catalog_fn  # type: ignore
                from skill_composer import compose as _skill_compose_fn  # type: ignore
            except Exception as _e:
                print(f"   ⚠️ Skill library failed to import ({_e}) — continuing without skills")
                _skill_enabled = False

        # Shot templates (premium / ultra / super_ultra) — deterministic full-shot
        # compositions invoked by the Director via `template_id` on a shot. When a
        # template renders successfully, the per-shot LLM call is SKIPPED entirely.
        _template_enabled = bool(self._tier_config.get("shot_templates_enabled"))
        _template_compose_fn = None
        if _template_enabled:
            try:
                from shot_template_composer import compose as _template_compose_fn  # type: ignore
            except Exception as _e:
                print(f"   ⚠️ Shot templates failed to import ({_e}) — continuing without templates")
                _template_enabled = False

        _w = getattr(self, 'video_width', 1920)
        _h = getattr(self, 'video_height', 1080)
        _safe_area = get_html_generation_safe_area(_w, _h)

        palette = style_guide.get("palette", {})
        background_type = style_guide.get("background_type", "black")

        shots = director_plan.get("shots", [])
        total_shots = len(shots)
        continuity_notes = director_plan.get("continuity_notes", "")

        # Per-shot checkpoint cache: saves completed shot HTML to disk so a resume
        # can skip already-generated shots without re-paying their token cost.
        _shot_cache_dir = run_dir / "shot_cache"
        _shot_cache_dir.mkdir(exist_ok=True)

        total_usage = {
            "prompt_tokens": 0, "completion_tokens": 0,
            "total_tokens": 0, "image_count": 0,
        }

        # Build a condensed style context string (reused across all shots)
        style_context = (
            f"Background: {background_type}\n"
            f"Text: {palette.get('text', '#ffffff')}\n"
            f"Primary: {palette.get('primary', '#3b82f6')}\n"
            f"Accent: {palette.get('accent', '#38bdf8')}\n"
            f"Fonts: Montserrat (headings), Inter (body), Fira Code (code)\n"
        )

        # ── Shared Shot Pack (premium/ultra/super_ultra) ──
        # Computed once for the whole run and injected into every shot prompt so
        # every shot draws from the same color/typography/spacing/easing tokens.
        # Kills cross-shot drift (shot 1's #0f172a vs shot 2's #1e293b, etc.).
        _shot_pack: Optional[Dict[str, Any]] = None
        _shot_pack_block = ""
        if self._tier_config.get("shot_pack_enabled"):
            _shot_pack = self._build_shot_pack(style_guide, _w, _h)
            self._current_shot_pack = _shot_pack
            _shot_pack_block = (
                "\n\n**🎨 SHARED SHOT PACK — single source of truth for this run**:\n"
                "Use these tokens verbatim. Do not invent new colors, font sizes, spacings, or eases — "
                "every shot in this video must feel like it was authored by the same designer.\n"
                "```json\n"
                + json.dumps(_shot_pack, indent=2)
                + "\n```\n"
                "Rules:\n"
                "- COLORS: use only CSS vars from `color_tokens` (var(--brand-primary) etc.). Never hardcode hex.\n"
                "- TYPOGRAPHY: use `font_scale` values (e.g. `font-size: 9rem` for display). Never pick your own size.\n"
                "- SPACING: use `spacing` tokens for padding/margin/gap. Use `safe_area` for outer padding.\n"
                "- EASES: use `ease` tokens in GSAP tweens (ease: 'power3.out' → use `ease_tokens.entry`).\n"
                "- IDs: prefix every element id with `s{shot_idx}_` (replace {shot_idx} with this shot's index) "
                "so IDs never collide between shots.\n"
            )

        # Overall speech rate — used to dynamically scale word-timing window per shot
        _total_audio_dur = director_plan.get("audio_duration") or (
            shots[-1].get("end_time", 0) if shots else 0
        )
        _words_per_second = len(words) / max(1.0, float(_total_audio_dur))

        def _shot_task(shot_idx: int, shot: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
            """Generate HTML for a single shot."""
            # Sub-shot identity (set by the dispatch block below). When a parent
            # shot is split, both sub-shots run with the parent's `shot_idx` so
            # neighbour lookups (shots[shot_idx ± 1]) and progress totals stay
            # correct; uniqueness is encoded into the cache path and entry id
            # via `_sub_suffix` instead.
            _sub_idx_val: Optional[int] = shot.get("_sub_idx") if shot.get("_is_sub_shot") else None
            _sub_suffix = f"_sub{_sub_idx_val}" if _sub_idx_val is not None else ""
            _entry_id = f"shot-{shot_idx}" + (f"-sub{_sub_idx_val}" if _sub_idx_val is not None else "")
            _log_label = f"Shot {shot_idx + 1}" + (f".{_sub_idx_val + 1}" if _sub_idx_val is not None else "")

            # Resume: load from cache if this shot was already generated in a prior run
            _cache_path = _shot_cache_dir / f"shot_{shot_idx:03d}{_sub_suffix}.json"
            if _cache_path.exists():
                try:
                    _cached = json.loads(_cache_path.read_text())
                    if _cached.get("entries"):
                        print(f"   ♻️  {_log_label} loaded from cache — skipping LLM call")
                        # Return zero usage so we don't double-count already-paid tokens
                        return _cached["entries"], {}
                except Exception:
                    pass  # corrupt cache — regenerate

            # Sub-shot decomposition (experimental flag) — split dense shots
            # into 2 focused sub-shots before HTML generation. Both sub-shots
            # recurse with the parent's `shot_idx` so neighbour context and
            # progress totals stay sane; per-sub-shot uniqueness comes from
            # `_sub_idx` (used for cache path + entry id only).
            if getattr(self, "_sub_shots_enabled", False) and not shot.get("_is_sub_shot"):
                _sub_shots = self._decompose_shot(shot)
                if len(_sub_shots) > 1:
                    print(f"   ✂️  Shot {shot_idx + 1} → {len(_sub_shots)} sub-shots")
                    _all_entries: List[Dict[str, Any]] = []
                    _agg_usage: Dict[str, Any] = {}
                    for _i, _ss in enumerate(_sub_shots):
                        _ss["_is_sub_shot"] = True
                        _ss["_sub_idx"] = _i
                        _e, _u = _shot_task(shot_idx, _ss)
                        _all_entries.extend(_e)
                        for _k in ("prompt_tokens", "completion_tokens", "total_tokens"):
                            if _k in _u:
                                _agg_usage[_k] = _agg_usage.get(_k, 0) + _u[_k]
                    return _all_entries, _agg_usage

            shot_type = shot.get("shot_type", "TEXT_DIAGRAM")
            start_time = float(shot.get("start_time", 0))
            end_time = float(shot.get("end_time", start_time + 8))
            duration = max(1.0, end_time - start_time)

            # ── Shot template bypass (premium / ultra / super_ultra) ──
            # When the Director sets `template_id` on a shot AND the template
            # renders successfully, we skip the LLM call entirely and use the
            # deterministic template HTML. Falls through to the LLM path on any
            # template error or when no template_id is set.
            if _template_enabled and _template_compose_fn is not None and shot.get("template_id"):
                _t_transition_in = shot.get("transition_in") or "fade"
                _t_transition_block = TRANSITION_CSS_BLOCKS.get(_t_transition_in, "")
                _t_ctx = {
                    "shot_index": shot_idx,
                    "canvas_w": _w,
                    "canvas_h": _h,
                    "tier": self._quality_tier,
                    "shot_type": shot_type,
                    "shot_pack": getattr(self, "_current_shot_pack", None) or {},
                    "transition_in": _t_transition_in,
                    "transition_css_block": _t_transition_block,
                }
                try:
                    _t_result = _template_compose_fn(shot, _t_ctx)
                except Exception as _t_err:
                    _t_result = {"skipped": True, "reason": f"compose threw: {_t_err}", "template_id": shot.get("template_id")}

                if not _t_result.get("skipped"):
                    _t_html = self._ensure_fonts(_t_result["html"])
                    _t_entry = {
                        "start": start_time,
                        "end": end_time,
                        "htmlStartX": 0, "htmlStartY": 0,
                        "htmlEndX": _w, "htmlEndY": _h,
                        "html": _t_html,
                        "id": _entry_id,
                        "index": shot_idx,
                        "z": shot.get("z", 10),
                        # Same stash fields as the LLM path so downstream
                        # (stock video ranker, sound planner) sees consistent shape.
                        "_shot_type": shot_type,
                        "_narration_excerpt": shot.get("narration_excerpt", ""),
                        "_visual_description": shot.get("visual_description", ""),
                        "_skill_audio_events": _t_result.get("audio_events", []),
                        "_template_id": _t_result.get("template_id", ""),
                    }
                    print(
                        f"   📐 {_log_label} template: {_t_result.get('template_id')} "
                        f"v{_t_result.get('version', '?')} rendered (no LLM)"
                    )
                    if on_segment_done:
                        try:
                            on_segment_done([_t_entry])
                        except Exception:
                            pass
                    # Cache so a resume can skip; usage = empty since we skipped the LLM.
                    try:
                        _cache_path.write_text(
                            json.dumps({"entries": [_t_entry], "usage": {}}, default=str)
                        )
                    except Exception:
                        pass
                    return [_t_entry], {}
                else:
                    # Template said skip — log and fall through to the LLM path.
                    print(
                        f"   ⚠️ {_log_label} template '{_t_result.get('template_id')}' "
                        f"skipped: {_t_result.get('reason')} — falling back to LLM"
                    )
            # ── end shot template bypass ──

            # Build per-shot system prompt (only the relevant shot type card)
            system_prompt = build_per_shot_system_prompt(shot_type, _w, _h)

            # Inject the filtered skill catalog (ultra / super_ultra).
            # The LLM sees a compact list of skills that match this shot type + tier
            # and can optionally drop <skill> tags into its HTML. The composer
            # resolves those tags after generation.
            if _skill_enabled and _skill_catalog_fn is not None:
                _canvas = "portrait" if _h > _w else "landscape"
                _skill_catalog = _skill_catalog_fn(
                    shot_type=shot_type,
                    tier=self._quality_tier,
                    canvas=_canvas,
                )
                if _skill_catalog:
                    system_prompt = system_prompt + "\n\n" + _skill_catalog

            # Filter word timings to this shot's time range
            shot_words = [w for w in words if start_time <= float(w.get("start", 0)) < end_time]
            # Dynamic word limit: scale with shot duration so a 10s shot gets ~55 words,
            # a 3s shot gets ~20 — captures full context without token waste on short shots.
            _word_limit = max(20, min(60, round(duration * _words_per_second * 1.5)))
            word_lines = ["Rel(s)  | Abs(s)  | Word", "--------|---------|--------"]
            for w in shot_words[:_word_limit]:
                abs_t = float(w["start"])
                rel_t = round(abs_t - start_time, 3)
                word_lines.append(f"{rel_t:>6.2f}  | {abs_t:>7.2f}  | {w.get('word', '')}")
            word_timings = "\n".join(word_lines)

            # Emphasis markers: inject narrator stress peaks for this shot's time window
            # so the LLM knows which words to animate with extra impact treatment.
            _em = getattr(self, '_emphasis_map', '')
            if _em:
                import re as _re_em
                # Extract time-stamped entries that fall within this shot's range
                _em_lines = []
                for _line in _em.splitlines():
                    _m = _re_em.search(r'(\d+\.?\d*)\s*s', _line)
                    if _m:
                        _t = float(_m.group(1))
                        if start_time <= _t < end_time:
                            _rel = round(_t - start_time, 2)
                            _em_lines.append(f"  t={_rel:.2f}s: {_line.strip()}")
                if _em_lines:
                    word_timings += (
                        "\n\n** NARRATOR STRESS PEAKS in this shot "
                        "(give these words IMPACT treatment — scale pulse, highlight box, "
                        "color flash, or underline wipe):\n"
                        + "\n".join(_em_lines)
                    )

            # Sync points from Director — formatted as ready-to-copy GSAP scaffold
            sync_lines = []
            for sp in shot.get("sync_points", []):
                abs_time = float(sp.get("time", 0))
                rel_delay = round(max(0.0, abs_time - start_time), 3)
                action = sp.get("action", "")
                word = sp.get("word", "")
                word_label = f'"{word}" @ ' if word else ""
                sync_lines.append(
                    f"// {word_label}abs={abs_time:.2f}s → gsap delay={rel_delay:.2f}s\n"
                    f"gsap.to('#YOUR_ELEMENT', {{opacity:1, duration:0.4, delay:{rel_delay:.2f}, "
                    f"ease:\"power2.out\"}});  // {action}"
                )
            sync_points_str = (
                "SYNC POINTS — copy these delays (shot-relative seconds). Replace #YOUR_ELEMENT with real IDs:\n"
                + "\n".join(sync_lines)
            ) if sync_lines else "(none specified)"

            # Continuity context
            prev_desc = ""
            next_desc = ""
            if shot_idx > 0:
                prev = shots[shot_idx - 1]
                prev_desc = f"Previous: {prev.get('shot_type', '?')} — {prev.get('visual_description', '')[:80]}"
            if shot_idx < total_shots - 1:
                nxt = shots[shot_idx + 1]
                next_desc = f"Next: {nxt.get('shot_type', '?')} — {nxt.get('visual_description', '')[:80]}"
            continuity_context = f"{prev_desc}\n{next_desc}\n{continuity_notes}".strip()

            # Optional fields
            image_prompt_line = f"- Image prompt: {shot['image_prompt']}" if shot.get("image_prompt") else ""
            video_query_line = f"- Video query: {shot['video_query']}" if shot.get("video_query") else ""
            director_notes = f"- Notes: {shot['notes']}" if shot.get("notes") else ""

            text_elements_str = ", ".join(shot.get("text_elements", [])) or "(Director will specify)"

            transition_in = shot.get("transition_in") or "fade"
            transition_css_block = TRANSITION_CSS_BLOCKS.get(transition_in, "")

            user_prompt = PER_SHOT_USER_PROMPT_TEMPLATE.format(
                shot_index=shot_idx + 1,
                total_shots=total_shots,
                shot_type=shot_type,
                start_time=start_time,
                end_time=end_time,
                duration=duration,
                visual_description=shot.get("visual_description", ""),
                text_elements=text_elements_str,
                animation_strategy=shot.get("animation_strategy", ""),
                complexity_level=shot.get("complexity_level", "moderate"),
                transition_in=transition_in,
                transition_css_block=transition_css_block,
                image_prompt_line=image_prompt_line,
                video_query_line=video_query_line,
                director_notes=director_notes,
                narration_excerpt=shot.get("narration_excerpt", ""),
                word_timings=word_timings,
                sync_points=sync_points_str,
                style_context=style_context,
                background_type=background_type,
                text_color=palette.get("text", "#ffffff"),
                svg_stroke=palette.get("svg_stroke", "#ffffff"),
                svg_fill=palette.get("svg_fill", "#3b82f6"),
                annotation_color=palette.get("annotation_color", "#dc2626"),
                continuity_context=continuity_context,
                safe_area=_safe_area,
                start_word=shot.get("start_word", ""),
                width=_w,
                height=_h,
            )

            # Inject stock media preference instruction based on tier config.
            _stock_pref = self._tier_config.get("stock_preference", "mixed")
            _stock_instruction = {
                "stock_only": (
                    "\n\n**MEDIA RULE — STOCK ONLY**: Do NOT write `data-img-prompt` attributes. "
                    "AI image generation is disabled for this tier. "
                    "For any background or illustration: use `<video data-video-query='...'>` "
                    "or `<img data-img-source='stock' data-img-prompt='...'>` (stock photo). "
                    "For abstract content with no stock equivalent, use a CSS gradient background instead."
                ),
                "stock_first": (
                    "\n\n**MEDIA RULE — STOCK FIRST**: For all backgrounds, B-roll, and real-world scenes "
                    "(people, places, objects, nature, technology), use `<video data-video-query='...'>` "
                    "or `<img data-img-source='stock' data-img-prompt='...'>` (stock photo). "
                    "Only use `data-img-prompt` (AI generation) for truly abstract or conceptual visuals "
                    "that have no real-world equivalent (e.g. mathematical structures, fictional concepts, "
                    "stylised diagrams). Default to stock unless AI is genuinely necessary."
                ),
            }.get(_stock_pref, "")
            if _stock_instruction:
                user_prompt = user_prompt + _stock_instruction

            # ── Host-shot injection ──
            # When AvatarBatch produced an avatar video for this shot, tell the
            # LLM to embed it as a full-frame <video> layer with overlays in the
            # free region per shot.host_layout. The avatar plays muted (the
            # global TTS narration is the audio source) and is always autoplay.
            if shot.get("host_present") and shot.get("avatar_video_url"):
                _host_layout = shot.get("host_layout") or "centered"
                _host_url = shot["avatar_video_url"]
                _host_block = (
                    "\n\n## 🎙️ HOST SHOT — FULL-FRAME AVATAR + OVERLAYS\n"
                    f"This shot features the on-screen host. Lay out as follows:\n\n"
                    "**Layer 0 (BOTTOM — host video, full canvas):**\n"
                    "```html\n"
                    f"<video class=\"host-avatar host-{_host_layout}\" "
                    f"src=\"{_host_url}\" "
                    "autoplay muted playsinline "
                    "style=\"position:absolute; inset:0; width:100%; height:100%; "
                    "object-fit:cover; z-index:0;\"></video>\n"
                    "```\n\n"
                    "**Layer 1+ (overlays — text, callouts, animated graphics):**\n"
                    "Place ALL your overlays inside this wrapper, sized to the FREE region:\n"
                    "```html\n"
                    "<div class=\"host-overlay-zone\" style=\"position:absolute; z-index:10; "
                )
                if _host_layout == "free_left":
                    _host_block += "left:0; right:50%; top:0; bottom:0; padding:4%;\">\n"
                elif _host_layout == "free_right":
                    _host_block += "left:50%; right:0; top:0; bottom:0; padding:4%;\">\n"
                elif _host_layout == "free_top":
                    _host_block += "left:0; right:0; top:0; bottom:60%; padding:4%;\">\n"
                elif _host_layout == "free_bottom":
                    _host_block += "left:0; right:0; top:60%; bottom:0; padding:4%;\">\n"
                else:  # centered — minimal overlay (lower-third only or skip)
                    _host_block += "left:0; right:0; bottom:0; height:30%; padding:4%; pointer-events:none;\">\n"
                _host_block += (
                    "  <!-- Your text, KaTeX, SVG, GSAP-animated callouts go here -->\n"
                    "</div>\n"
                    "```\n\n"
                    "**Rules:**\n"
                    "- The host <video> tag MUST be present and unmodified (do not re-encode the URL).\n"
                    "- Do NOT add any background/full-canvas image, gradient, or solid color — the host fills the canvas.\n"
                    "- Animations + text content go INSIDE the .host-overlay-zone wrapper only.\n"
                    "- Do not occlude the host's face/body region; respect the chosen layout.\n"
                    f"- Layout chosen for this shot: **{_host_layout}** "
                    f"(host occupies the {('right' if _host_layout == 'free_left' else 'left' if _host_layout == 'free_right' else 'bottom' if _host_layout == 'free_top' else 'top' if _host_layout == 'free_bottom' else 'whole canvas')} side).\n\n"
                    "**HARD DO-NOT (this shot only):**\n"
                    "- ❌ Do NOT emit `data-img-prompt` (would generate an AI image and composite it under the host).\n"
                    "- ❌ Do NOT emit `data-video-query` or `data-img-source='stock'` (would composite stock media under the host).\n"
                    "- ❌ Do NOT add a `<video>` tag other than the host one above.\n"
                    "- ❌ Do NOT use `position:fixed` / negative z-index — host is z=0, overlays are z≥10.\n"
                    "- ❌ Do NOT set `body` or full-canvas backgrounds — leave them transparent so the host video shows through.\n"
                )
                user_prompt = user_prompt + _host_block

            # Inject the shared shot pack (premium/ultra/super_ultra only).
            # Rewrite the id_prefix placeholder with this shot's concrete index.
            if _shot_pack_block:
                user_prompt = user_prompt + _shot_pack_block.replace(
                    '"s{shot_idx}_"', f'"s{shot_idx}_"'
                ).replace(
                    "s{shot_idx}_", f"s{shot_idx}_"
                )

            # Append motion-density + cadence + brand-palette requirement
            # (skipped for KINETIC_TEXT since it's bypassed anyway)
            if (
                self._tier_config.get("motion_density_enforcement")
                and shot_type != "KINETIC_TEXT"
            ):
                _min_anim = self._tier_config.get("min_animated_elements", 6)
                _is_portrait = _h > _w
                _shot_duration_s = end_time - start_time
                # Per-shot framing: shots ≥ 5s on landscape are explainer-cadence;
                # everything else is reel-pace. The animation rules (snappy entrances,
                # active backgrounds, text-must-animate) apply identically — only the
                # shot-duration target and headline framing change.
                _is_explainer = (_shot_duration_s >= 5.0) and (not _is_portrait)
                if _is_explainer:
                    _format_label   = "16:9 landscape educational"
                    _cadence_header = "MOTION DENSITY + EXPLAINER CADENCE + BRAND PALETTE"
                    _format_para    = (
                        f"This is a long shot ({_shot_duration_s:.1f}s) in landscape educational content. "
                        "Internal motion (counters, draw-ins, sequential reveals, diagram building) MUST "
                        "carry the time — never let the screen sit static. Animations should still feel "
                        "deliberate and snappy at the element level; what's NOT 'reel-pace' is the cutting, "
                        "not the entrances."
                    )
                else:
                    _format_label   = "9:16 portrait reel / Shorts / TikTok" if _is_portrait else "16:9 short-form"
                    _cadence_header = "REEL PACE + MOTION DENSITY + BRAND PALETTE"
                    _format_para    = (
                        f"This is short-form social video ({_shot_duration_s:.1f}s shot). Animations must "
                        "feel punchy and snappy."
                    )
                user_prompt = user_prompt + (
                    f"\n\n**⚡ {_cadence_header}** (non-negotiable):\n"
                    f"\n🎞️ FORMAT: {_format_label}. {_format_para}\n"
                    "\n⚡ ANIMATION TIMING (snappy at the element level regardless of cadence):\n"
                    "- Default entrance duration: 0.25–0.4s (NOT 0.8–1.2s). Slow fades feel amateur.\n"
                    "- Stagger entrance delays: 0.08–0.25s apart (tight), NOT 0.4–0.8s (loose).\n"
                    "- Exit animations (when needed): 0.15–0.25s.\n"
                    "- First meaningful element must appear by 0.2s — no dead-air opens.\n"
                    "- Use `ease:'power3.out'`, `back.out(1.6)`, `expo.out`. Linear = amateur.\n"
                    f"\n💥 MOTION DENSITY: This shot MUST contain AT LEAST {_min_anim} independently "
                    "animated elements (count every GSAP tween targeting a distinct DOM node).\n"
                    "- At least ONE showcase animation: SVG path draw-on (strokeDasharray → 0), "
                    "number counter (`gsap.to({innerText: N, snap:{innerText:1}})`), scale+rotate "
                    "entry, splitReveal, or morph.\n"
                    "- Background must NOT be fully static — subtle floating particles, slow "
                    "translateX/scale on a background shape, gradient-shift keyframes, or a "
                    "looping SVG pulse. Screen should never be still for >0.8s.\n"
                    "- Include at least 2 micro-interactions tied to narration: underline wipes on "
                    "key terms, icon scale bounces, annotation arrows drawing in.\n"
                    "- Tie at least 2 animations to specific words from WORD TIMINGS using the "
                    "Rel(s) column as GSAP `delay:`. Cite the word in a JS comment.\n"
                    "- Use `gsap.timeline()` or `gsap.delayedCall()` for sequencing — NEVER setTimeout.\n"
                    "\n📝 TEXT ANIMATION (no plain text allowed — 'caming plane' rule):\n"
                    "- EVERY text block MUST animate in. Acceptable entrances: splitReveal "
                    "(word-by-word or letter-by-letter), fadeIn+y:30 with stagger, typewriter "
                    "(innerText growth), clip-path wipe, or mask reveal.\n"
                    "- NEVER render text with `opacity:1` static — always animate from opacity:0 "
                    "with a GSAP tween.\n"
                    "- WORD-BREAK RULE (CRITICAL): When hand-writing per-character spans "
                    "(e.g. `<span class='char'>R</span><span class='char'>E</span>...`), you MUST "
                    "wrap all chars of the same word in a `<span style='display:inline-block;"
                    "white-space:nowrap'>` parent so the browser cannot break a line mid-word. "
                    "Never place naked per-char inline-block spans directly inside a block container "
                    "— they will split across lines. Prefer `splitReveal()` which handles this "
                    "automatically.\n"
                    "- Key terms (the ones the narrator emphasises) must have an IMPACT treatment: "
                    "scale pulse, highlight box drawing in behind them, underline wipe, or color "
                    "flash. Use at least 1 key-term treatment per shot.\n"
                    "- For multi-line text, reveal lines sequentially (stagger 0.12–0.2s) — "
                    "never dump a whole paragraph at once.\n"
                    "\n🎨 BRAND PALETTE (MANDATORY — institute AI settings must show through):\n"
                    "- Use CSS variables `var(--brand-primary)`, `var(--brand-accent)`, "
                    "`var(--brand-text)`, `var(--brand-text-secondary)`, `var(--brand-svg-stroke)`, "
                    "`var(--brand-svg-fill)`, `var(--brand-annotation)` for ALL colors. These are "
                    "injected automatically at render time from the institute's style settings.\n"
                    "- NEVER hardcode hex values for primary/accent/text. You MAY hardcode neutrals "
                    "(#000, #fff, rgba() overlays) and content-specific colors (red for 'wrong', "
                    "green for 'correct').\n"
                    "- Backgrounds, borders, SVG strokes/fills, step numbers, label tags, dividers, "
                    "and highlight underlines MUST use the brand variables.\n"
                    "- If a palette value isn't available, fall back inside the var(): "
                    "`var(--brand-primary, #3b82f6)`.\n"
                )

            # ── PRODUCT_HERO shots: layered-stage composition constraints ──
            if shot_type == "PRODUCT_HERO":
                user_prompt = user_prompt + (
                    "\n\n**🎬 PRODUCT HERO SHOT — NON-NEGOTIABLE CONSTRAINTS**:\n"
                    "- Root element: `<div class='product-stage'>` — full-screen relative container.\n"
                    "- Subject image: `position:absolute`, `data-cutout='true'`, centered, bottom 22%, width 70–80%, z-index:10.\n"
                    "- Background layers: 3 separate `position:absolute` divs at z-index 0/1/2. "
                    "They crossfade via GSAP opacity tweens — subject NEVER moves.\n"
                    "- Use `.halftone` or `.halftone-light` on bg layer 1 for texture act.\n"
                    "- Badge: `<div class='flat-badge'>` — zero border-radius, flat color, Bebas Neue.\n"
                    "- Bottom tagline: `<div class='slam-wrapper'><div class='slam-text'>` with `gsap.to('#slam', {y:'0%', ease:'expo.out'})`.\n"
                    "- Small word labels: `<div class='tracking-label'>`.\n"
                    "- Subject gets slow continuous scale: `gsap.to('#subject', {scale:1.05, duration:10, ease:'none'})`.\n"
                    "- For the text/badge group (not the subject), wrap them in `<div class='stage-drift'>` and run the hold-drift tween: "
                    "`gsap.fromTo('.stage-drift', {x:0,y:0}, {x:15,y:-8, duration:12, ease:'none'});` "
                    "This gives the text a subtle parallax while the subject stays anchored.\n"
                    "- Easing: `expo.out` for snappy reveals, `power3.out` for smooth entrances, `power2.inOut` for bg crossfades.\n"
                    "- DO NOT hard-cut backgrounds — always crossfade via GSAP opacity.\n"
                )

            # ── INFOGRAPHIC_SVG / KINETIC_TITLE shots: pure-SVG constraints ──
            elif shot_type in ("INFOGRAPHIC_SVG", "KINETIC_TITLE"):
                user_prompt = user_prompt + (
                    "\n\n**🎨 PURE-SVG SHOT — NON-NEGOTIABLE CONSTRAINTS**:\n"
                    "- NO `<img>` tags, NO `<video>` tags, NO `data-img-prompt`, NO `data-video-query`.\n"
                    "- NO `background-image` referencing external URLs in any style attribute.\n"
                    "- ALL visuals must be INLINE SVG. No external assets of any kind.\n"
                    "- Root MUST be `<div class='svg-canvas paper-texture'><div class='stage-drift'>...</div></div>` — "
                    "the outer svg-canvas gives cream #f5f0e8 + grid + parchment grain, the inner stage-drift gets the mandatory hold-drift tween.\n"
                    "- Content palette is STRICTLY `var(--brand-primary)` and `var(--brand-accent)`. "
                    "RED `.tech-annotation` is allowed (and encouraged) for dimension lines, crosshairs, measurement arrows — "
                    "it reads as 'engineering markup' and doesn't count against the 2-color content rule.\n"
                    "- **HAND-DRAWN LOOK**: Wrap all primary line-art in `<g filter='url(#roughen)'>` for architect-sketch wobble. "
                    "This is what separates top-tier illustrated explainers (MacBook Neo blueprint style) from generic flat SVG.\n"
                    "- Draw-on pattern: `pathLength='1' stroke-dasharray='1' stroke-dashoffset='1'` → `gsap.to(el, {strokeDashoffset:0, ...})`. "
                    "Works perfectly with filter='url(#roughen)' — the wobble is applied after the draw animation.\n"
                    "- **TECHNICAL DIMENSION LINES**: For diagrams with measurements, add `<line class='tech-annotation' pathLength='1' stroke-dashoffset='1'>` "
                    "with matching `<text class='tech-annotation-label'>16-INCH</text>` labels. Makes diagrams look authored.\n"
                    "- **FIG CAPTIONS**: Add a `<div class='tech-annotation-caption'>Fig. 1 — description</div>` "
                    "below complex diagrams for documentary/textbook feel.\n"
                    "- For multi-node diagrams (pipelines, agent graphs, flow charts): use the BLUEPRINT DRAFT two-phase pattern — "
                    "`<g class='draft-guide'>` (dashed guides draw in first) then `<g class='solid-overlay'>` (solid ink lands on top), "
                    "then node badges slam in from left with `expo.out`. See INFOGRAPHIC_SVG card for exact code.\n"
                    "- MANDATORY hold-drift for the composition: "
                    "`gsap.fromTo('.stage-drift', {x:0,y:0,scale:1}, {x:20,y:-10,scale:1.04, duration:12, ease:'none'});` "
                    "This runs the whole 12s loop regardless of shot length — it's what makes the video feel alive during holds.\n"
                    "- **SCENE TRANSITIONS** (when shot is NOT the last in the video): At shot end, add EITHER "
                    "(a) ZOOM-THROUGH: `gsap.to('#focus-target', {scale:25, duration:0.8, delay:<end-0.8>, ease:'power3.in'});` "
                    "where `#focus-target` is a small element (dot/badge corner) the next scene will emerge from; OR "
                    "(b) VIGNETTE EXIT: add `<div class='vignette-overlay'></div>` + "
                    "`gsap.to('.vignette-overlay', {opacity:1, duration:0.6, delay:<end-0.6>, ease:'power2.in'});`. "
                    "Never end a shot with a static frame — there must be an exit motion.\n"
                    "- For motionPath shots: guard with `if(window.MotionPathPlugin) gsap.registerPlugin(MotionPathPlugin);`.\n"
                )

            # ── SOURCE_CLIP shots: overlay-only constraints ──
            elif shot_type == "SOURCE_CLIP":
                # Look up mode for the specific source video this shot references
                _sv_idx = shot.get("source_video_index", 0)
                _iv_mode = ""
                if self._input_video_contexts and _sv_idx < len(self._input_video_contexts):
                    _iv_mode = self._input_video_contexts[_sv_idx].get("mode", "")
                elif self._input_video_context:
                    _iv_mode = self._input_video_context.get("mode", "")

                if _iv_mode == "demo":
                    # Detect source video orientation for layout
                    _clip_ctx = None
                    if self._input_video_contexts and _sv_idx < len(self._input_video_contexts):
                        _clip_ctx = self._input_video_contexts[_sv_idx]
                    elif self._input_video_context:
                        _clip_ctx = self._input_video_context
                    _src_res = (_clip_ctx or {}).get("context", {}).get("meta", {}).get("resolution", [0, 0])
                    _src_is_portrait = len(_src_res) >= 2 and _src_res[0] < _src_res[1]
                    _out_is_landscape = getattr(self, 'video_width', 1920) >= getattr(self, 'video_height', 1080)

                    if _src_is_portrait and _out_is_landscape:
                        # Portrait source in landscape output → SIDE-BY-SIDE layout
                        user_prompt = user_prompt + (
                            "\n\n**🎬 SOURCE_CLIP SHOT — PORTRAIT VIDEO SIDE-BY-SIDE LAYOUT**:\n"
                            "The source video is PORTRAIT (9:16) but the output is LANDSCAPE.\n"
                            "Use a SIDE-BY-SIDE layout: video on the left, annotations on the right.\n\n"
                            "**EXACT STRUCTURE REQUIRED:**\n"
                            "```html\n"
                            "<div style='width:100%;height:100%;background:#111827;display:flex;"
                            "align-items:center;padding:3%;gap:3%;'>\n"
                            "  <!-- Video container (portrait) — MUST be pure #000000 -->\n"
                            "  <div style='width:32%;aspect-ratio:9/16;max-height:90%;"
                            "background:#000000;border-radius:12px;overflow:hidden;flex-shrink:0;"
                            "box-shadow:0 8px 32px rgba(0,0,0,0.6);'></div>\n"
                            "  <!-- Annotation panel -->\n"
                            "  <div style='flex:1;display:flex;flex-direction:column;"
                            "justify-content:center;gap:1rem;'>\n"
                            "    <h2 style='font-size:1.8rem;font-weight:700;color:#fff;'>"
                            "STEP TITLE</h2>\n"
                            "    <p style='font-size:1.1rem;color:rgba(255,255,255,0.7);"
                            "line-height:1.5;'>Description of what's happening in the demo</p>\n"
                            "  </div>\n"
                            "</div>\n"
                            "```\n\n"
                        )
                    else:
                        # Landscape source or portrait output → video above, caption below
                        _aspect = "9/16" if _src_is_portrait else "16/9"
                        _max_h = "80%" if _src_is_portrait else "60%"
                        user_prompt = user_prompt + (
                            "\n\n**🎬 SOURCE_CLIP SHOT — DEMO VIDEO CARD LAYOUT**:\n"
                            "The source video will be composited into the black (#000000) region.\n\n"
                            "**EXACT STRUCTURE REQUIRED:**\n"
                            "```html\n"
                            "<div style='width:100%;height:100%;background:#111827;display:flex;"
                            "flex-direction:column;align-items:center;justify-content:center;padding:3%;'>\n"
                            "  <div style='text-align:center;margin-bottom:2%;'>\n"
                            "    <h2 style='font-size:1.6rem;font-weight:700;color:#fff;'>"
                            "STEP TITLE</h2>\n"
                            "  </div>\n"
                            f"  <div style='width:88%;aspect-ratio:{_aspect};max-height:{_max_h};"
                            "background:#000000;border-radius:12px;overflow:hidden;"
                            "box-shadow:0 8px 32px rgba(0,0,0,0.6);'></div>\n"
                            "  <div style='margin-top:2%;text-align:center;"
                            "color:rgba(255,255,255,0.65);font-size:1rem;max-width:80%;'>"
                            "Description here</div>\n"
                            "</div>\n"
                            "```\n\n"
                        )

                    # Common rules for all demo layouts
                    user_prompt = user_prompt + (
                        "**STRICT RULES:**\n"
                        "- Outer background MUST be #111827 (dark blue-gray, NOT black).\n"
                        "- Video container MUST be pure #000000 — source video composited here.\n"
                        "- Title: describe what the demo ACTUALLY SHOWS at this timestamp.\n"
                        "- DO NOT create SVGs, diagrams, icons, step lists, or UI mockups.\n"
                        "- DO NOT use <img> or data-img-prompt.\n"
                        "- Simple gsap fadeIn animation only (0.3s).\n"
                        "- ENTIRE HTML under 25 lines.\n"
                    )
                else:
                    # Podcast/other mode: full-screen video with minimal caption overlay
                    user_prompt = user_prompt + (
                        "\n\n**🎬 SOURCE_CLIP SHOT — OVERLAY-ONLY CONSTRAINTS**:\n"
                        "The source video footage plays BEHIND your HTML. Your HTML is composited "
                        "on top — black pixels (#000000) become transparent. The viewer already sees "
                        "the original video content (speaker, interview), so your overlay must NOT "
                        "duplicate what's visible in the video.\n\n"
                        "**STRICT RULES:**\n"
                        "- Background MUST be solid #000000 (pure black). NO gradients, NO images.\n"
                        "- ONLY generate a small lower-third caption in the BOTTOM 15% of screen.\n"
                        "- Use `position:absolute; bottom:5%; left:5%; right:5%` for the caption.\n"
                        "- Caption box: `background:rgba(0,0,0,0.75); padding:1rem 1.5rem; "
                        "border-radius:0.5rem`.\n"
                        "- Text: white, 1.4-1.8rem, Inter font, max 2 lines.\n"
                        "- DO NOT create SVGs, diagrams, icons, step lists, UI mockups.\n"
                        "- DO NOT use <img> or data-img-prompt.\n"
                        "- DO NOT place elements in the top 70% of the screen.\n"
                        "- Animations: simple fadeIn (0.3s) on the caption. Nothing else.\n"
                        "- The ENTIRE HTML should be under 25 lines.\n"
                    )

            # ── KINETIC_TEXT bypass — skip LLM, build exact word-sync HTML directly ──
            if shot_type == "KINETIC_TEXT" and self._tier_config.get("kinetic_text_shots", False):
                kinetic_html = self._build_kinetic_text_html(
                    words_in_shot=shot_words,
                    start_time=start_time,
                    palette=palette,
                    bg_type=background_type,
                )
                kinetic_html = self._ensure_fonts(kinetic_html)
                entry = {
                    "start": start_time,
                    "end": end_time,
                    "htmlStartX": 0, "htmlStartY": 0,
                    "htmlEndX": _w, "htmlEndY": _h,
                    "html": kinetic_html,
                    "id": _entry_id,
                    "index": shot_idx,
                    "z": shot.get("z", 10),
                    # Tag with shot_type so the Sound Planner's family logic
                    # treats back-to-back KINETIC_TITLE/KINETIC_TEXT as same
                    # family (no transition whoosh between them).
                    "_shot_type": shot_type,
                    "_narration_excerpt": shot.get("narration_excerpt", ""),
                    "_visual_description": shot.get("visual_description", ""),
                    "_skill_audio_events": [],
                }
                print(f"   ✅ Shot {shot_idx + 1} KINETIC_TEXT built ({len(shot_words)} words, no LLM)")
                if on_segment_done:
                    try:
                        on_segment_done([entry])
                    except Exception:
                        pass
                return [entry], {}
            # ── end KINETIC_TEXT bypass ──

            # ── Overlay-mode SOURCE_CLIP bypass — full-frame video + floating infographic cards ──
            # Fired when routing_plan.config.infographic_mode == "overlay" and the
            # Director attached overlay_slots[] to the shot. Deterministic HTML
            # (no LLM call) so layout/positions are predictable.
            if (
                shot_type == "SOURCE_CLIP"
                and self._routing_config.get("infographic_mode") == "overlay"
            ):
                _ov_slots = shot.get("overlay_slots") or []
                _ov_src_start = float(shot.get("source_start", 0))
                _ov_src_end = float(shot.get("source_end", end_time - start_time))
                _ov_sv_idx = int(shot.get("source_video_index", 0))
                _ov_src_url = ""
                if _clip_ctx:
                    _iv_assets_ov = _clip_ctx.get("assets_urls", {})
                    _ov_src_url = (
                        _iv_assets_ov.get("source_video", "")
                        or _clip_ctx.get("source_public_url", "")
                        or _clip_ctx.get("source_url", "")
                    )
                _accent_ov = (palette or {}).get("accent", "#7dd3fc")
                _ov_html = self._build_overlay_source_clip_html(
                    overlay_slots=_ov_slots,
                    accent_color=_accent_ov,
                    source_video_url=_ov_src_url,
                    source_start=_ov_src_start,
                    source_end=_ov_src_end,
                )
                _ov_entry = {
                    "start": start_time, "end": end_time,
                    "htmlStartX": 0, "htmlStartY": 0, "htmlEndX": _w, "htmlEndY": _h,
                    "html": _ov_html,
                    "id": _entry_id, "index": shot_idx,
                    "z": shot.get("z", 10),
                    "_shot_type": shot_type,
                    "_narration_excerpt": shot.get("narration_excerpt", ""),
                    "_visual_description": shot.get("visual_description", ""),
                    "_skill_audio_events": [],
                    "source_start": _ov_src_start,
                    "source_end": _ov_src_end,
                    "source_video_index": _ov_sv_idx,
                    "_overlay_slots": _ov_slots,
                }
                print(
                    f"   ✅ Shot {shot_idx + 1} SOURCE_CLIP overlay layout "
                    f"({len(_ov_slots)} slot(s), no LLM)"
                )
                if on_segment_done:
                    try:
                        on_segment_done([_ov_entry])
                    except Exception:
                        pass
                return [_ov_entry], {}
            # ── end overlay SOURCE_CLIP bypass ──

            # ── Portrait demo SOURCE_CLIP bypass — deterministic side-by-side HTML ──
            # When a portrait (9:16) source video is used in a landscape (16:9) output,
            # the LLM fights the SOURCE_CLIP system-prompt ("background MUST be #000000")
            # and produces pillarbox instead of side-by-side. Build it deterministically.
            if shot_type == "SOURCE_CLIP" and _iv_mode == "demo":
                _res_chk = (_clip_ctx or {}).get("context", {}).get("meta", {}).get("resolution", [0, 0])
                _is_src_portrait = len(_res_chk) >= 2 and _res_chk[0] < _res_chk[1]
                _is_out_landscape = getattr(self, 'video_width', 1920) >= getattr(self, 'video_height', 1080)
                if _is_src_portrait and _is_out_landscape:
                    # Compute source video timing (normally done post-LLM)
                    _sbs_src_start = float(shot.get("source_start", 0))
                    _sbs_src_end = float(shot.get("source_end", end_time - start_time))
                    _sbs_sv_idx = int(shot.get("source_video_index", 0))
                    _sbs_src_url = ""
                    if _clip_ctx:
                        _iv_assets_sbs = _clip_ctx.get("assets_urls", {})
                        _sbs_src_url = (
                            _iv_assets_sbs.get("source_video", "")
                            or _clip_ctx.get("source_public_url", "")
                            or _clip_ctx.get("source_url", "")
                        )

                    _sbs_title = (shot.get("title", "") or shot.get("visual_description", "Demo Step"))[:80]
                    _sbs_desc = (shot.get("narration_excerpt", "") or "")[:220]
                    _accent = (palette or {}).get("accent", "#6366f1")
                    _sbs_html = (
                        "<!DOCTYPE html><html><head>"
                        "<style>*{margin:0;padding:0;box-sizing:border-box}</style>"
                        "</head><body style='width:100%;height:100%;background:transparent;overflow:hidden;'>"
                        "<div style='width:100%;height:100%;background:#111827;display:flex;"
                        "align-items:center;padding:3% 4%;gap:5%;'>"
                        "<div id='vid-panel' style='width:30%;aspect-ratio:9/16;max-height:88%;"
                        "background:#000000;border-radius:14px;overflow:hidden;"
                        "flex-shrink:0;box-shadow:0 12px 40px rgba(0,0,0,0.65);'></div>"
                        "<div style='flex:1;display:flex;flex-direction:column;"
                        "justify-content:center;gap:1.4rem;opacity:0;transform:translateX(20px);' id='anno'>"
                        f"<div style='width:3rem;height:4px;background:{_accent};border-radius:2px;'></div>"
                        f"<h2 style='font-family:Inter,sans-serif;font-size:2rem;font-weight:700;"
                        f"color:#fff;line-height:1.25;'>{_sbs_title}</h2>"
                        f"<p style='font-family:Inter,sans-serif;font-size:1.15rem;"
                        f"color:rgba(255,255,255,0.72);line-height:1.6;'>{_sbs_desc}</p>"
                        "</div></div>"
                        "<script>window.addEventListener('load',function(){"
                        "if(typeof gsap!=='undefined'){"
                        "gsap.to('#anno',{opacity:1,x:0,duration:0.55,ease:'power2.out',delay:0.15});"
                        "gsap.from('#vid-panel',{opacity:0,scale:0.96,duration:0.45,ease:'power2.out'});"
                        "}})</script></body></html>"
                    )
                    _sbs_html = self._ensure_fonts(_sbs_html)
                    if _sbs_src_url:
                        _sbs_vid = (
                            f'<video data-source-clip="true" data-source-start="{_sbs_src_start}" '
                            f'src="{_sbs_src_url}#t={_sbs_src_start},{_sbs_src_end}" '
                            f'autoplay muted playsinline '
                            f'style="width:100%;height:100%;object-fit:cover;pointer-events:none;"></video>'
                        )
                        _sbs_html = _sbs_html.replace(
                            "background:#000000;border-radius:14px;overflow:hidden;"
                            "flex-shrink:0;box-shadow:0 12px 40px rgba(0,0,0,0.65);'></div>",
                            "background:#000000;border-radius:14px;overflow:hidden;"
                            f"flex-shrink:0;box-shadow:0 12px 40px rgba(0,0,0,0.65);'>{_sbs_vid}</div>",
                        )
                    _sbs_entry = {
                        "start": start_time, "end": end_time,
                        "htmlStartX": 0, "htmlStartY": 0, "htmlEndX": _w, "htmlEndY": _h,
                        "html": _sbs_html,
                        "id": _entry_id, "index": shot_idx,
                        "z": shot.get("z", 10),
                        "_shot_type": shot_type,
                        "_narration_excerpt": shot.get("narration_excerpt", ""),
                        "_visual_description": shot.get("visual_description", ""),
                        "_skill_audio_events": [],
                        "source_start": _sbs_src_start,
                        "source_end": _sbs_src_end,
                        "source_video_index": _sbs_sv_idx,
                    }
                    print(f"   ✅ Shot {shot_idx + 1} SOURCE_CLIP portrait side-by-side (no LLM)")
                    if on_segment_done:
                        try:
                            on_segment_done([_sbs_entry])
                        except Exception:
                            pass
                    return [_sbs_entry], {}
            # ── end portrait SOURCE_CLIP bypass ──

            # LLM call with retry — usage accumulates across ALL attempts so
            # retry token burns are included in the reported cost (not silently lost).
            _SIMPLIFY_RETRY_NOTE = (
                "\n\n⚠️ RETRY — your previous response was truncated or unparseable. "
                "GENERATE COMPACT HTML ONLY. Hard limits for this retry:\n"
                "- Entire HTML must be under 5000 tokens. Completeness > quality.\n"
                "- No complex SVG filters, no long <path d=...> data, no multi-keyframe @keyframes.\n"
                "- Use only GSAP opacity/transform tweens — nothing fancier.\n"
                "- The outer JSON MUST close properly with `}`. If content is too long, cut elements.\n"
                "- Return ONLY the raw JSON object. No markdown fences."
            )
            max_attempts = 3
            # Cumulative usage across all attempts — tracks retry token burns
            usage: Dict[str, Any] = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
            _base_user_prompt = user_prompt
            for attempt in range(max_attempts):
                _current_prompt = (
                    _base_user_prompt + _SIMPLIFY_RETRY_NOTE if attempt > 0 else _base_user_prompt
                )
                _attempt_usage: Dict[str, Any] = {}
                try:
                    raw, _attempt_usage = self.html_client.chat(
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": _current_prompt},
                        ],
                        temperature=self._tier_config.get("html_temperature", 0.7),
                        max_tokens=(
                            8000 if attempt > 0
                            else self._tier_config.get("per_shot_max_tokens", 16000)
                        ),
                    )
                    # Add this attempt's tokens before JSON parsing so parse failures
                    # are still counted in the cost.
                    for _k in ("prompt_tokens", "completion_tokens", "total_tokens"):
                        usage[_k] = usage.get(_k, 0) + _attempt_usage.get(_k, 0)
                    data = _extract_json_blob(raw)
                    break
                except (ValueError, Exception) as e:
                    # For network errors html_client.chat() raises before returning
                    # _attempt_usage — add whatever partial usage we got.
                    for _k in ("prompt_tokens", "completion_tokens", "total_tokens"):
                        usage[_k] = usage.get(_k, 0) + _attempt_usage.get(_k, 0)
                    if attempt == max_attempts - 1:
                        print(f"   ❌ Shot {shot_idx + 1} failed after {max_attempts} attempts: {e}")
                        self._emit_progress({
                            "type": "shot_error",
                            "shot_index": shot_idx,
                            "total_shots": total_shots,
                            "shot_type": shot_type,
                            "error": str(e)[:200],
                            "retrying": False,
                            "attempt": max_attempts,
                            "max_attempts": max_attempts,
                            "message": f"Shot {shot_idx + 1} failed: {str(e)[:120]}",
                        })
                        # Build minimal fallback instead of leaving a gap in the timeline
                        _fb_accent = (palette or {}).get("accent", "#6366f1")
                        _fb_text = (
                            (shot.get("visual_description") or shot.get("narration_excerpt") or "")
                            .strip()[:200]
                        )
                        _fb_html = (
                            "<div id='shot-root' style='position:relative;width:100%;height:100%;"
                            f"overflow:hidden;background:#0f172a;display:flex;align-items:center;"
                            "justify-content:center;'>"
                            f"<div style='max-width:80%;text-align:center;font-family:Inter,sans-serif;"
                            f"font-size:2.4rem;font-weight:600;color:#f1f5f9;line-height:1.4;opacity:0;' id='fb_t'>"
                            f"{_fb_text}</div>"
                            f"<div style='position:absolute;bottom:10%;width:6rem;height:4px;"
                            f"background:{_fb_accent};border-radius:2px;opacity:0;' id='fb_b'></div>"
                            "<script>window.addEventListener('load',function(){"
                            "if(typeof gsap!=='undefined'){"
                            "gsap.to('#fb_t',{opacity:1,y:-10,duration:0.5,delay:0.1,ease:'power2.out'});"
                            "gsap.to('#fb_b',{opacity:1,duration:0.4,delay:0.4});"
                            "}})</script></div>"
                        )
                        _fb_html = self._ensure_fonts(_fb_html)
                        _fb_entry = {
                            "start": start_time, "end": end_time,
                            "htmlStartX": 0, "htmlStartY": 0, "htmlEndX": _w, "htmlEndY": _h,
                            "html": _fb_html,
                            "id": _entry_id, "index": shot_idx,
                            "z": shot.get("z", 10),
                            "_shot_type": "FALLBACK",
                            "_narration_excerpt": shot.get("narration_excerpt", ""),
                            "_visual_description": shot.get("visual_description", ""),
                            "_skill_audio_events": [],
                        }
                        print(f"   🔄 Shot {shot_idx + 1} → minimal fallback card")
                        if on_segment_done:
                            try:
                                on_segment_done([_fb_entry])
                            except Exception:
                                pass
                        return [_fb_entry], usage
                    self._emit_progress({
                        "type": "shot_error",
                        "shot_index": shot_idx,
                        "total_shots": total_shots,
                        "shot_type": shot_type,
                        "error": str(e)[:200],
                        "retrying": True,
                        "attempt": attempt + 1,
                        "max_attempts": max_attempts,
                        "message": f"Shot {shot_idx + 1} retry {attempt + 1}/{max_attempts - 1}: {str(e)[:80]}",
                    })
                    time.sleep(1.5 * (1.6 ** attempt))

            # Build the entry in the same format as _expand_shots
            html = data.get("html", "")
            if not html:
                print(f"   ⚠️ Shot {shot_idx + 1} returned empty HTML")
                return [], usage

            html = self._sanitize_html_content(html)

            # ── Skill composer (ultra / super_ultra) ──
            # Scan for <skill data-skill-id=... data-params=...> tags the LLM may
            # have dropped in. Resolve each via the registry, validate params,
            # render the skill's HTML/CSS/JS, and substitute into the shot. Also
            # injects any needed GSAP plugin scripts. Shots that don't use any
            # skills pass through unchanged.
            _shot_skill_audio_events: List[Dict[str, Any]] = []
            if _skill_enabled and _skill_compose_fn is not None:
                try:
                    compose_result = _skill_compose_fn(
                        html,
                        ctx={
                            "shot_index": shot_idx,
                            "canvas_w": _w,
                            "canvas_h": _h,
                            "tier": self._quality_tier,
                            "shot_type": shot_type,
                        },
                    )
                    invocations = compose_result.get("invocations", []) or []
                    # Always collect skill audio events (even when the composer
                    # matched zero tags the list is empty — safe to assign).
                    _shot_skill_audio_events = compose_result.get("audio_events", []) or []
                    if invocations:
                        html = compose_result.get("html", html)
                        succeeded = compose_result.get("succeeded", 0)
                        failed = compose_result.get("failed", 0)
                        plugins = compose_result.get("plugins", []) or []
                        skill_ids_used = sorted({
                            i["skill_id"] for i in invocations if i.get("valid")
                        })
                        tag = f"[{','.join(skill_ids_used)}]" if skill_ids_used else ""
                        print(
                            f"   🧩 Shot {shot_idx + 1} skills: "
                            f"{succeeded} rendered, {failed} failed {tag}"
                        )
                        if failed:
                            for inv in invocations:
                                if not inv.get("valid"):
                                    issues_str = "; ".join(inv.get("issues", []))
                                    print(
                                        f"      ✗ {inv.get('skill_id', '?')}: {issues_str}"
                                    )
                        # Ensure any required plugin CDNs are loaded.
                        # `gsap` is already global via generate_video.py's boilerplate,
                        # but other plugins may need <script> injection in the future.
                        if "gsap-motionpath" in plugins and "MotionPathPlugin" not in html:
                            html = html.replace(
                                "</head>",
                                '<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/MotionPathPlugin.min.js"></script>\n</head>',
                                1,
                            )
                except Exception as _sc_err:
                    print(f"   ⚠️ Skill composer error on shot {shot_idx + 1}: {_sc_err}")

            # ── Animation density validator + targeted regen (super_ultra only) ──
            # Scans the generated HTML for GSAP tweens and sync-point delays. If the
            # count is below the tier threshold OR the sync points weren't honored,
            # fire ONE corrective regeneration call. Doesn't loop forever.
            _shot_duration_s = end_time - start_time
            # Telemetry record visible at entry-build time below. Stays None
            # when the validator doesn't run.
            _validator_record_for_entry: Optional[Dict[str, Any]] = None
            if (
                self._tier_config.get("shot_animation_validator")
                and shot_type not in ("KINETIC_TEXT", "KINETIC_TITLE")
                and _shot_duration_s >= 3.0
            ):
                issues = self._validate_shot_animation_density(
                    html=html,
                    shot=shot,
                    start_time=start_time,
                    end_time=end_time,
                )
                # Track the regen lifecycle so we can stash a small record on
                # the entry for telemetry (which html_version actually shipped).
                _validator_record: Dict[str, Any] = {
                    "pre_issues": list(issues) if issues else [],
                    "shipped": "original",  # default — overwritten on regen success
                }
                if issues:
                    print(f"   ⚠️ Shot {shot_idx + 1} failed validator: {'; '.join(issues)}")
                    # Tailor the corrective message: anti-pattern issues
                    # (vertical text / high-rotation text) get a specific
                    # callout so the cheap planner doesn't just bump tween
                    # count while leaving the typography offense in place.
                    _has_anti_pattern = any(
                        ("vertical typography" in i) or ("high-rotation transform" in i)
                        for i in issues
                    )
                    corrective_parts = [
                        "Your previous output did not meet the requirements for this shot.",
                        "Problems:",
                        *[f"- {i}" for i in issues],
                        "",
                        "Regenerate the shot HTML. The animation_strategy and sync_points from "
                        "the Director are non-negotiable this time — every sync_point delay must appear "
                        "as a GSAP `delay:` value within ±0.2s, and the total number of independently "
                        "animated DOM elements must meet the min_animated_elements target.",
                    ]
                    if _has_anti_pattern:
                        corrective_parts.append(
                            "TYPOGRAPHY: text MUST read horizontally. DO NOT use "
                            "`writing-mode: vertical-rl/vertical-lr/sideways-*`, "
                            "`text-orientation: upright/sideways`, or "
                            "`transform: rotate(...)` greater than ±15° on any element "
                            "containing text. Stage labels, badges, headlines, callouts — "
                            "all horizontal."
                        )
                    corrective_parts.append("Keep the same shot pack tokens. Return only the JSON shot object.")
                    corrective = "\n".join(corrective_parts)
                    # Snapshot the pre-regen HTML so we can revert if regen
                    # produces a worse result. The validator can be wrong —
                    # if regen ALSO fails, the original is more likely closer
                    # to the Director's intent than a desperate second attempt.
                    _html_before_regen = html
                    try:
                        raw2, usage2 = self.html_client.chat(
                            messages=[
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": user_prompt},
                                {"role": "assistant", "content": raw[:4000]},
                                {"role": "user", "content": corrective},
                            ],
                            temperature=0.4,  # lower for more faithful regen
                            max_tokens=self._tier_config.get("per_shot_max_tokens", 16000),
                        )
                        data2 = _extract_json_blob(raw2)
                        html2 = data2.get("html", "")
                        if html2:
                            _candidate = self._sanitize_html_content(html2)
                            if usage2:
                                usage["prompt_tokens"] = usage.get("prompt_tokens", 0) + usage2.get("prompt_tokens", 0)
                                usage["completion_tokens"] = usage.get("completion_tokens", 0) + usage2.get("completion_tokens", 0)
                                usage["total_tokens"] = usage.get("total_tokens", 0) + usage2.get("total_tokens", 0)

                            # Re-validate the regen candidate. Three outcomes:
                            #   A. Regen passes → ship regen.
                            #   B. Regen fails strictly more than original → ship original.
                            #   C. Regen fails but is no worse → ship regen as best-attempt.
                            post_issues = self._validate_shot_animation_density(
                                html=_candidate, shot=shot,
                                start_time=start_time, end_time=end_time,
                            )
                            _validator_record["post_issues"] = list(post_issues) if post_issues else []
                            if not post_issues:
                                html = _candidate
                                _validator_record["shipped"] = "regen"
                                print(f"   ✅ Shot {shot_idx + 1} regen passed animation density check")
                            elif len(post_issues) > len(issues):
                                # Strict regression — ship the original. The
                                # original at least matched the Director's
                                # narrative intent; the regen is worse on the
                                # rubric AND lost continuity with the prompt.
                                _validator_record["shipped"] = "original"
                                _validator_record["reason"] = "regen had more issues than original"
                                html = _html_before_regen
                                print(
                                    f"   ⏪ Shot {shot_idx + 1} regen REGRESSED "
                                    f"({len(issues)} → {len(post_issues)} issues) — "
                                    f"reverting to original"
                                )
                            else:
                                # No worse — keep the regen as best attempt
                                html = _candidate
                                _validator_record["shipped"] = "regen"
                                _validator_record["reason"] = "regen no worse — best attempt shipped"
                                print(
                                    f"   ⚠️ Shot {shot_idx + 1} regen still has "
                                    f"{len(post_issues)} issue(s) — shipping best attempt: "
                                    f"{'; '.join(post_issues)}"
                                )
                        else:
                            _validator_record["reason"] = "regen returned empty html — shipping original"
                            print(f"   ⚠️ Shot {shot_idx + 1} regen returned empty — shipping original")
                    except Exception as e:
                        _validator_record["reason"] = f"regen exception ({e}) — shipping original"
                        print(f"   ⚠️ Shot {shot_idx + 1} regen failed ({e}) — shipping original")
                # Capture for telemetry on the entry (stripped before timeline
                # serialization via _process_stock_videos's strip helper).
                if issues:
                    _validator_record_for_entry = _validator_record

            html = self._ensure_fonts(html)

            entry = {
                "start": start_time,
                "end": end_time,
                "htmlStartX": 0,
                "htmlStartY": 0,
                "htmlEndX": _w,
                "htmlEndY": _h,
                "html": html,
                "id": _entry_id,
                "index": shot_idx,
                # Stashed for downstream stock-video ranking — not rendered.
                "_shot_type": shot_type,
                "_narration_excerpt": shot.get("narration_excerpt", ""),
                "_visual_description": shot.get("visual_description", ""),
                # Stashed for the Sound Planner — stripped before serialization.
                "_skill_audio_events": _shot_skill_audio_events,
            }
            # Animation-validator telemetry: pre/post issues + which version
            # shipped (regen vs original revert). Stripped before the timeline
            # is serialized to S3 — same strip path as other underscore fields.
            if _validator_record_for_entry is not None:
                entry["_validator_record"] = _validator_record_for_entry
            # SOURCE_CLIP: propagate source video time range + inject <video> into
            # the HTML so the FE player (iframe preview) shows the actual footage
            # instead of a black rectangle. The render worker will composite
            # properly later, but this gives a meaningful preview.
            if shot_type == "SOURCE_CLIP":
                _src_start = float(shot.get("source_start", 0))
                _src_end = float(shot.get("source_end", end_time - start_time))
                _sv_idx = int(shot.get("source_video_index", 0))
                entry["source_start"] = _src_start
                entry["source_end"] = _src_end
                entry["source_video_index"] = _sv_idx

                # Inject background <video> into the shot HTML.
                # Look up the correct source video context by index.
                _source_url = ""
                _iv_mode_clip = ""
                _clip_ctx = None
                if self._input_video_contexts and _sv_idx < len(self._input_video_contexts):
                    _clip_ctx = self._input_video_contexts[_sv_idx]
                elif self._input_video_context:
                    _clip_ctx = self._input_video_context
                if _clip_ctx:
                    _assets_urls = _clip_ctx.get("assets_urls", {})
                    _source_url = (_assets_urls.get("source_video", "")
                                   or _clip_ctx.get("source_public_url", "")
                                   or _clip_ctx.get("source_url", ""))
                    _iv_mode_clip = _clip_ctx.get("mode", "")
                if _source_url and html:

                    if _iv_mode_clip == "demo":
                        # Demo mode: inject <video> inside the black card container.
                        # The HTML has a div with background:#000000 — that's the
                        # video container. We inject the <video> tag inside it.
                        _video_tag = (
                            f'<video data-source-clip="true" '
                            f'data-source-start="{_src_start}" '
                            f'src="{_source_url}#t={_src_start},{_src_end}" '
                            f'autoplay muted playsinline '
                            f'style="width:100%;height:100%;object-fit:contain;'
                            f'pointer-events:none;"></video>'
                        )
                        # Find the black container div and inject video inside it.
                        # The LLM generates: background:#000000 or background: #000000
                        import re as _re
                        _black_bg_pattern = _re.compile(
                            r"(background\s*:\s*#000000\s*;[^>]*>)",
                            _re.IGNORECASE,
                        )
                        _match = _black_bg_pattern.search(html)
                        if _match:
                            _insert_pos = _match.end()
                            html = html[:_insert_pos] + _video_tag + html[_insert_pos:]
                        else:
                            # Fallback: wrap the whole thing (old behavior)
                            html = (
                                f'<div style="position:relative;width:100%;height:100%;overflow:hidden;background:#000;">'
                                f'<video data-source-clip="true" data-source-start="{_src_start}" '
                                f'src="{_source_url}#t={_src_start},{_src_end}" autoplay muted playsinline '
                                f'style="position:absolute;top:0;left:0;width:100%;height:100%;'
                                f'object-fit:cover;z-index:0;pointer-events:none;"></video>'
                                f'<div style="position:relative;z-index:1;width:100%;height:100%;">'
                                f'{html}</div></div>'
                            )
                    else:
                        # Podcast/other: full-screen video behind overlay
                        # Use 'contain' if source is portrait in landscape output (avoid cropping)
                        _src_res_p = (_clip_ctx or {}).get("context", {}).get("meta", {}).get("resolution", [0, 0])
                        _src_portrait_p = len(_src_res_p) >= 2 and _src_res_p[0] < _src_res_p[1]
                        _out_landscape_p = getattr(self, 'video_width', 1920) >= getattr(self, 'video_height', 1080)
                        _obj_fit = "contain" if (_src_portrait_p and _out_landscape_p) else "cover"
                        _video_bg = (
                            f'<video data-source-clip="true" '
                            f'data-source-start="{_src_start}" '
                            f'src="{_source_url}#t={_src_start},{_src_end}" '
                            f'autoplay muted playsinline '
                            f'style="position:absolute;top:0;left:0;width:100%;height:100%;'
                            f'object-fit:{_obj_fit};z-index:0;pointer-events:none;"></video>'
                        )
                        html = (
                            f'<div style="position:relative;width:100%;height:100%;overflow:hidden;background:#000;">'
                            f'{_video_bg}'
                            f'<div style="position:relative;z-index:1;width:100%;height:100%;">'
                            f'{html}'
                            f'</div></div>'
                        )
                    entry["html"] = html
            if "z" in data:
                try:
                    entry["z"] = int(data["z"])
                except (TypeError, ValueError):
                    pass

            entries = [entry]

            # Notify image pipeline if callback provided
            if on_segment_done:
                try:
                    on_segment_done(entries)
                except Exception:
                    pass

            # Emit per-shot progress event to SSE bridge
            _pt = usage.get("prompt_tokens", 0)
            _ct = usage.get("completion_tokens", 0)
            # Thread-safe cumulative token update
            with self._token_lock:
                self._cumulative_tokens["prompt_tokens"] += _pt
                self._cumulative_tokens["completion_tokens"] += _ct
                self._cumulative_tokens["total_tokens"] += _pt + _ct
                _cum_snap = dict(self._cumulative_tokens)
            # Estimate USD cost for this shot (best-effort; None if model pricing unknown)
            _model_id = getattr(self.html_client, 'current_model',
                                getattr(self.html_client, 'default_model', ''))
            _shot_cost_usd: float | None = None
            try:
                from constants.models import get_model_pricing as _gmp  # type: ignore
                _pricing = _gmp(_model_id) or {}
                _inp = _pricing.get("input_token_price") or 0.0
                _outp = _pricing.get("output_token_price") or 0.0
                _shot_cost_usd = round(_pt * _inp + _ct * _outp, 6)
                _cum_snap["estimated_cost_usd"] = round(
                    _cum_snap["prompt_tokens"] * _inp
                    + _cum_snap["completion_tokens"] * _outp,
                    4,
                )
            except Exception:
                pass
            self._emit_progress({
                "type": "shot_done",
                "shot_index": shot_idx,
                "total_shots": total_shots,
                "shot_type": shot_type,
                "duration_s": round(end_time - start_time, 2),
                "start_time": start_time,
                "end_time": end_time,
                "message": f"Shot {shot_idx + 1}/{total_shots} ready ({shot_type})",
                "model": _model_id,
                "token_delta": {
                    "prompt_tokens": _pt,
                    "completion_tokens": _ct,
                    "estimated_cost_usd": _shot_cost_usd,
                },
                "cumulative_tokens": _cum_snap,
            })

            # Save checkpoint so a retry can skip this shot
            try:
                _cache_path.write_text(json.dumps({"entries": entries, "usage": usage}, default=str))
            except Exception:
                pass  # cache write failure is non-fatal

            return entries, usage

        # Run all shots in parallel using ThreadPoolExecutor
        all_entries: List[Dict[str, Any]] = []
        max_workers = min(8, max(1, total_shots))

        print(f"   🎬 Generating HTML for {total_shots} shots (parallel, max {max_workers} workers)...")

        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_map = {
                executor.submit(_shot_task, i, shot): i
                for i, shot in enumerate(shots)
            }
            for future in concurrent.futures.as_completed(future_map):
                shot_idx = future_map[future]
                try:
                    entries, usage = future.result()
                    all_entries.extend(entries)
                    if usage:
                        total_usage["prompt_tokens"] += usage.get("prompt_tokens", 0)
                        total_usage["completion_tokens"] += usage.get("completion_tokens", 0)
                        total_usage["total_tokens"] += usage.get("total_tokens", 0)
                except Exception as e:
                    print(f"   ❌ Shot {shot_idx + 1} exception: {e}")

        # Sort by start time
        all_entries.sort(key=lambda x: float(x.get("start", 0)))

        # Enforce no-overlap for non-overlay shots
        for i in range(len(all_entries) - 1):
            if all_entries[i]["end"] > all_entries[i + 1]["start"]:
                all_entries[i]["end"] = all_entries[i + 1]["start"]

        # ── Sound Planner (tier-gated + request kill switch) ──
        # Deterministic rule-based cue placement. Reads shot types, sync
        # points, skill audio events, and the emphasis map; mutates entries
        # in place by setting `sound_cues: [...]`. Runs after skills compose
        # so it has everything it needs in one pass.
        _sound_tier_on = bool(self._tier_config.get("sound_enabled"))
        _sound_user_on = bool(getattr(self, "_sound_effects_enabled", True))
        if _sound_tier_on and _sound_user_on:
            try:
                from sound_planner import plan_sounds
                video_id = getattr(self, "_current_video_id", "") or str(run_dir.name)
                _script_text = getattr(self, "_current_script_text", "") or ""
                plan_sounds(
                    entries=all_entries,
                    shots=shots,
                    words=words,
                    tier_config=self._tier_config,
                    video_id=video_id,
                    script_text=_script_text,
                )
                total_cues = sum(len(e.get("sound_cues") or []) for e in all_entries)
                shots_with_cues = sum(1 for e in all_entries if e.get("sound_cues"))
                print(
                    f"   🔊 Sound Planner placed {total_cues} cues across "
                    f"{shots_with_cues}/{len(all_entries)} shots"
                )
            except Exception as _sp_err:
                print(f"   ⚠️ Sound Planner error ({_sp_err}) — shipping without sound cues")
                for e in all_entries:
                    e.setdefault("sound_cues", [])
        else:
            # Ensure every entry has an empty sound_cues list for a stable
            # payload shape (player can always read it).
            for e in all_entries:
                e.setdefault("sound_cues", [])
            if not _sound_user_on and _sound_tier_on:
                print("   🔇 Sound effects disabled by request flag")

        print(f"   ✅ Per-shot generation complete: {len(all_entries)} entries")
        return all_entries, total_usage

    def _generate_html_segments(
        self,
        segments: List[Dict[str, Any]],
        style_guide: Dict[str, Any],
        script_plan: Optional[Dict[str, Any]],
        run_dir: Path,
        language: str = "English",
        on_segment_done: Optional[Any] = None,
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """
        on_segment_done: optional callable(entries: List[Dict]) invoked as soon as
        each segment's HTML is ready.  Used by run() to start image generation in
        parallel while remaining HTML segments are still being generated.
        """
        # Resolve template once (shared across all segment tasks)
        _layout_theme_id = style_guide.get("layout_theme", "")
        _template = _get_template_by_id(_layout_theme_id) if _layout_theme_id else None

        # Pre-compute segment context for continuity (Standard+ tiers)
        _seg_summaries: list[str] = []
        if self._tier_config.get("segment_context"):
            for s in segments:
                text = str(s.get("text", ""))
                _seg_summaries.append(text[:120].rsplit(" ", 1)[0] if len(text) > 120 else text)

        # Pre-compute beat visual type assignments for diversity enforcement
        _beat_visual_types: list[str] = []
        if self._tier_config.get("shot_diversity_enforcement") and script_plan:
            for beat in (script_plan.get("beat_outline") or []):
                _beat_visual_types.append(beat.get("visual_type", ""))

        def task(seg: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
            # Flatten style guide for prompt
            palette = style_guide.get("palette", {})
            background_type = style_guide.get("background_type", "black")
            fonts = style_guide.get("fonts", {})
            layout_theme = style_guide.get("layout_theme", "")
            mermaid_theme = style_guide.get("mermaid_theme", "dark")

            # Get mermaid classDef based on background type
            mermaid_classdef = f"classDef default fill:{palette.get('mermaid_node_fill', '#1e293b')},stroke:{palette.get('mermaid_node_stroke', '#3b82f6')},stroke-width:2px,color:{palette.get('mermaid_text', '#fff')},rx:8px,ry:8px;"

            # Build explicit color instructions based on background
            if background_type == "white":
                color_warning = (
                    "⚠️ **WHITE BACKGROUND DETECTED** - USE DARK COLORS ONLY!\n"
                    "- ALL text MUST be DARK (black/navy): {text}\n"
                    "- ALL SVG strokes MUST be DARK: {svg_stroke}\n"
                    "- NEVER use white, light gray, or light colors for text/strokes!\n"
                    "- Annotations should be RED for visibility: {annotation}\n"
                ).format(
                    text=palette.get('text'),
                    svg_stroke=palette.get('svg_stroke'),
                    annotation=palette.get('annotation_color')
                )
            else:
                color_warning = (
                    "⚠️ **BLACK BACKGROUND DETECTED** - USE LIGHT COLORS ONLY!\n"
                    "- ALL text MUST be WHITE/LIGHT: {text}\n"
                    "- ALL SVG strokes MUST be LIGHT: {svg_stroke}\n"
                    "- NEVER use black or dark colors for text/strokes!\n"
                ).format(
                    text=palette.get('text'),
                    svg_stroke=palette.get('svg_stroke')
                )

            # ── Build style_context ──────────────────────────────────────────
            # Order: template (holistic visual direction) → colors → mermaid → typography
            # Template comes FIRST so the LLM reads the overall aesthetic before
            # the specific color values that refine it.
            style_context = (
                # 1. Template visual direction (if selected) — defines the overall aesthetic
                (
                    f"**🎨 VISUAL TEMPLATE: {_template['name'].upper()}** — {_template['description']}\n"
                    f"{_template['style_injection']}\n"
                    f"↑ These CSS rules and HTML patterns define your visual identity for this video. "
                    f"The exact color values below OVERRIDE template defaults where they differ.\n\n"
                    if _template else (
                        f"**LAYOUT DIRECTION — {layout_theme.upper().replace('_', ' ')}**: "
                        f"Let this visual style guide spacing, card shape, and overall tone.\n\n"
                        if layout_theme else ""
                    )
                )
                # 2. Color rules — precise hex values that the template (or brand) set
                + f"🎨 **COLOR RULES (CRITICAL - FOLLOW EXACTLY)**:\n"
                f"{color_warning}\n"
                f"**EXACT COLORS TO USE**:\n"
                f"- Text color: {palette.get('text')}\n"
                f"- Secondary text: {palette.get('text_secondary')}\n"
                f"- SVG stroke color: {palette.get('svg_stroke')}\n"
                f"- SVG fill color: {palette.get('svg_fill')}\n"
                f"- Accent/highlight: {palette.get('accent')}\n"
                f"- Annotation color: {palette.get('annotation_color')}\n"
                f"\n**FOR SVG ELEMENTS**:\n"
                f"```html\n"
                f"<text fill=\"{palette.get('text')}\">Your text</text>\n"
                f"<path stroke=\"{palette.get('svg_stroke')}\" fill=\"none\"/>\n"
                f"<rect fill=\"{palette.get('svg_fill')}\"/>\n"
                f"```\n"
                # 3. Mermaid — theme + classDef
                + f"\n**MERMAID DIAGRAMS** (theme: {mermaid_theme}):\n"
                f"- Add `%%{{init: {{'theme': '{mermaid_theme}'}}}}%%` as the FIRST LINE inside every `<div class='mermaid'>` block.\n"
                f"```\n"
                f"%%{{init: {{'theme': '{mermaid_theme}'}}}}%%\n"
                f"{mermaid_classdef}\n"
                f"```\n"
                # 4. Rough Notation
                + f"\n**ROUGH NOTATION** (for annotations):\n"
                f"```javascript\n"
                f"annotate('#element-id', {{type: 'underline', color: '{palette.get('annotation_color')}'}});\n"
                f"```\n"
                # 5. Typography
                + f"\n**TYPOGRAPHY (use these exact font families throughout)**:\n"
                f"- Headings / titles / h1–h3: font-family: '{fonts.get('primary', 'Montserrat')}', sans-serif\n"
                f"- Body text / paragraphs / labels: font-family: '{fonts.get('secondary', 'Inter')}', sans-serif\n"
                f"- Code / monospace elements: font-family: '{fonts.get('code', 'Fira Code')}', monospace\n"
                f"Import these via Google Fonts if not already loaded in the slide.\n"
            )

            # Extract relevant visual ideas — filtered to this segment's beat + neighbors
            beat_context = ""
            if script_plan and "beat_outline" in script_plan:
                beats = script_plan["beat_outline"]
                seg_beat_idx = seg.get("beat_index", 0)
                # Show this segment's beat + 1 neighbor on each side for transition context
                relevant_range = range(
                    max(0, seg_beat_idx - 1),
                    min(len(beats), seg_beat_idx + 2)
                )
                relevant_beats = [beats[i] for i in relevant_range if i < len(beats)]

                if relevant_beats:
                    beat_context = "\n**VISUAL IDEAS FOR THIS SEGMENT**:\n"
                    for beat in relevant_beats:
                        is_primary = beat.get("label") == seg.get("beat_label")
                        marker = "→ " if is_primary else "  "
                        if beat.get("visual_idea"):
                            beat_context += f"{marker}{beat.get('label')}: {beat.get('visual_idea')}"
                            if beat.get("visual_type"):
                                beat_context += f" [suggested: {beat['visual_type']}]"
                            beat_context += "\n"
                    beat_context += "(The → arrow marks the primary beat for this segment)\n"
                else:
                    # Fallback: show all beats (backwards compat for segments without beat_index)
                    beat_context = "\nVISUAL IDEAS FROM SCRIPT:\n"
                    for beat in beats:
                        if beat.get("visual_idea"):
                            beat_context += f"- {beat.get('label')}: {beat.get('visual_idea')}\n"
                    beat_context += "(Use these ideas if they match the current narration text)\n"

            # Format word timings for the LLM to use for animation sync
            word_timings = ""
            seg_words = seg.get("words", [])
            if seg_words:
                # Create a condensed timing table - group every 5 words to avoid overwhelming the LLM
                word_timings = "**📊 WORD TIMINGS (use for animation sync)**:\n"
                word_timings += "```\n"
                word_timings += "Time(s)  | Word\n"
                word_timings += "---------|--------\n"
                
                # Show key words with their exact timestamps
                # Prioritize: first word, every 5th word, and any words >5 chars (likely key terms)
                shown_count = 0
                for i, w in enumerate(seg_words):
                    word = str(w.get("word", ""))
                    start = float(w.get("start", 0))
                    
                    # Show first 3 words, then every 5th word, or long words (likely key terms)
                    is_key_word = len(word) > 5 and word.isalpha()
                    should_show = (i < 3) or (i % 5 == 0) or is_key_word
                    
                    if should_show and shown_count < 40:  # Limit to 40 entries max
                        word_timings += f"{start:>7.2f}  | {word}\n"
                        shown_count += 1
                
                word_timings += "```\n"
                word_timings += f"Shot starts at: {seg['start']:.2f}s | Shot ends at: {seg['end']:.2f}s\n"
                word_timings += "**Formula**: `delay_ms = (word_time - shot_start) * 1000`\n"

            # Select system prompt based on HTML quality
            _w = getattr(self, 'video_width', 1920)
            _h = getattr(self, 'video_height', 1080)
            if hasattr(self, '_current_html_quality') and self._current_html_quality == "classic":
                try:
                    from prompts import HTML_GENERATION_SYSTEM_PROMPT_CLASSIC
                    system_prompt = HTML_GENERATION_SYSTEM_PROMPT_CLASSIC
                except ImportError:
                    system_prompt = HTML_GENERATION_SYSTEM_PROMPT_TEMPLATE
            else:
                # Use domain-filtered shot type cards instead of the monolithic prompt.
                # This sends only the shot types relevant to the subject domain,
                # reducing system prompt size by 38-67% depending on topic.
                try:
                    from shot_type_cards import build_filtered_system_prompt
                    _subject = getattr(self, '_current_subject_domain', 'general')
                    system_prompt = build_filtered_system_prompt(_subject, _w, _h)
                except ImportError:
                    # Fallback to monolithic prompt if shot_type_cards not available
                    from prompts import HTML_GENERATION_SYSTEM_PROMPT_ADVANCED
                    _fewshot = _get_fewshot_examples(_w, _h)
                    _aspect = getattr(self, 'aspect_label', '16:9 landscape')
                    system_prompt = (
                        HTML_GENERATION_SYSTEM_PROMPT_ADVANCED
                        .replace("{fewshot_examples}", _fewshot)
                        .replace("{canvas_width}", str(_w))
                        .replace("{canvas_height}", str(_h))
                        .replace("{aspect_label}", _aspect)
                    )
            
            # Build topic-aware guidance based on subject domain
            subject_domain = getattr(self, '_current_subject_domain', 'general')
            topic_profile = TOPIC_SHOT_PROFILES.get(subject_domain, TOPIC_SHOT_PROFILES['general'])
            topic_guidance = (
                f"**📌 SUBJECT-SPECIFIC VISUAL GUIDANCE ({topic_profile['description']})**:\n"
                f"{topic_profile['guidance']}\n"
                f"Image ratio target: {topic_profile['image_ratio']*100:.0f}% of shots should use AI-generated images.\n"
            )
            
            # Add recap hint if the segment is marked with needs_recap
            if seg.get("needs_recap"):
                topic_guidance += (
                    "\n**📋 RECAP SHOT NEEDED**: This segment covers the final concept before a recap point. "
                    "Include one additional shot at the end that briefly summarizes the key concepts "
                    "covered so far using a clean bullet-point or numbered list layout. "
                    "Use the key-takeaway card style.\n"
                )

            # Inject SVG map availability for geography-related content
            # Uses smart matching: searches narration for country names, cities, etc.
            if subject_domain in ("history", "general", "science"):
                try:
                    from map_assets import find_relevant_maps, format_maps_for_prompt
                    _relevant_maps = find_relevant_maps(seg.get("text", ""), max_results=5)
                    if _relevant_maps:
                        topic_guidance += format_maps_for_prompt(_relevant_maps)
                except ImportError:
                    pass  # map_assets.py not available — skip gracefully

            # Use dimension-aware safe area
            _safe_area = get_html_generation_safe_area(self.video_width, self.video_height) if hasattr(self, 'video_width') else HTML_GENERATION_SAFE_AREA
            _aspect_label = "9:16 portrait" if getattr(self, 'video_width', 1920) < getattr(self, 'video_height', 1080) else "16:9"

            user_prompt = HTML_GENERATION_USER_PROMPT_TEMPLATE.format(
                index=seg["index"],
                start=seg["start"],
                end=seg["end"],
                text=seg["text"],
                word_timings=word_timings,
                style_context=style_context,
                beat_context=beat_context,
                safe_area=_safe_area,
                language=language,
                topic_guidance=topic_guidance,
                # Color enforcement variables
                background_type=background_type,
                background_type_upper=background_type.upper(),
                text_color=palette.get('text', '#0f172a'),
                svg_stroke=palette.get('svg_stroke', '#0f172a'),
                svg_fill=palette.get('svg_fill', '#2563eb'),
                annotation_color=palette.get('annotation_color', '#dc2626'),
                primary_color=palette.get('primary', '#2563eb'),
                # Dimension placeholders for prompt templates
                aspect_label=_aspect_label,
                canvas_width=getattr(self, 'video_width', 1920),
                canvas_height=getattr(self, 'video_height', 1080),
            ).strip()

            # Append segment continuity context (Standard+ tiers)
            if self._tier_config.get("segment_context") and _seg_summaries:
                seg_idx = seg.get("index", 1) - 1  # 0-based
                total = len(_seg_summaries)
                prev_ctx = (
                    f"- Previous segment narration: \"{_seg_summaries[seg_idx - 1]}...\""
                    if seg_idx > 0 else "- This is the FIRST segment (strong opening visual needed)."
                )
                next_ctx = (
                    f"- Next segment narration: \"{_seg_summaries[seg_idx + 1]}...\""
                    if seg_idx < total - 1 else "- This is the LAST segment (use a conclusive visual)."
                )
                # Diversity hint: list beat visual types so LLM avoids repetition
                diversity_ctx = ""
                if self._tier_config.get("shot_diversity_enforcement") and _beat_visual_types:
                    diversity_ctx = (
                        f"- Beat visual types planned across all segments: {', '.join(_beat_visual_types)}. "
                        f"Use a DIFFERENT shot type from adjacent segments where possible."
                    )
                user_prompt += "\n\n" + SEGMENT_CONTEXT_ADDON.format(
                    seg_index=seg_idx + 1,
                    total_segments=total,
                    prev_context=prev_ctx,
                    next_context=next_ctx,
                    diversity_context=diversity_ctx,
                )

            # ── Inject user's original prompt so HTML LLM sees their preferences ──
            if getattr(self, '_base_prompt', ''):
                user_prompt += (
                    f"\n\n**📌 ORIGINAL USER REQUEST:**\n"
                    f"\"{self._base_prompt}\"\n"
                    f"Respect any visual preferences or instructions the user specified above "
                    f"(e.g., branding, style preferences, specific images to include).\n"
                )

            # ── Inject reference images into HTML generation prompt ──
            if getattr(self, '_reference_context', None):
                ref_images = self._reference_context.get("embeddable_images", [])
                if ref_images:
                    img_lines = []
                    for ri in ref_images:
                        s3_url = ri.get("s3_url", "")
                        desc = ri.get("description", "Reference image")
                        source = ri.get("source_file", "")
                        if s3_url:
                            img_lines.append(f"  - {desc} (from: {source}) → URL: {s3_url}")
                    if img_lines:
                        user_prompt += (
                            "\n\n**📎 REFERENCE IMAGES PROVIDED BY THE USER:**\n"
                            + "\n".join(img_lines)
                            + "\n\nEmbed these images directly via <img src=\"{url}\"> when relevant. "
                            "If an image looks like a logo or branding asset, use it as a small overlay "
                            "(e.g., corner watermark or header logo — not full-screen). "
                            "If it looks like content (diagram, photo, illustration), use it as a hero image or inline visual. "
                            "These are real S3 URLs — do NOT use data-img-prompt for these images."
                        )

            # Inject complexity level for this segment (guides shot duration & animation layering)
            _complexity = seg.get("complexity_level", "moderate")
            user_prompt += f"\n\n**COMPLEXITY LEVEL FOR THIS SEGMENT**: {_complexity}\n"

            # Inject segment duration + recommended shot count (pacing-aware)
            _seg_duration = seg.get("duration", seg["end"] - seg["start"])
            _pacing = self.PACING_PROFILES.get(self._pacing_style, self.PACING_PROFILES["education"])
            _sps = _pacing["seconds_per_shot"]
            # Complexity adjustment: complex content gets fewer, longer shots
            if _complexity == "high":
                _sps = _sps * 1.4  # 40% longer shots for complex content
            elif _complexity == "low":
                _sps = _sps * 0.75  # 25% shorter shots for simple content
            _recommended_shots = max(
                _pacing["min_shots"],
                min(_pacing["max_shots"], round(_seg_duration / _sps)),
            )
            _pacing_hint = {
                "reels": "Fast-paced, frenetic cuts. Each shot should be punchy and visually dynamic.",
                "marketing": "Rhythmic pacing that builds momentum. Vary shot lengths for emotional flow.",
                "education": "Deliberate pacing with room to breathe. Hold complex visuals longer.",
            }.get(self._pacing_style, "")
            user_prompt += (
                f"\n**SEGMENT DURATION**: {_seg_duration:.0f} seconds."
                f" Generate EXACTLY {_recommended_shots} shots — no more, no fewer."
                f" Each shot: {int(_sps)}–{int(_sps) + 2}s duration."
                f"\n**PACING STYLE**: {self._pacing_style.upper()} — {_pacing_hint}\n"
            )

            # Retry logic: distinguishes server overload (500), rate-limit (429),
            # and JSON parse failures so each gets an appropriate delay.
            import time
            import random as _rnd
            max_retries = 4  # extra attempt covers transient server 500s
            for attempt in range(max_retries):
                try:
                    raw, usage = self.html_client.chat(
                        messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
                        temperature=self._tier_config.get("html_temperature", 0.7),
                        max_tokens=self._tier_config.get("html_max_tokens", 24000),
                    )
                    data = self._parse_html_response(raw, seg, run_dir)

                    # HTML validation & self-repair (Standard+ tiers)
                    if self._tier_config.get("html_validation"):
                        for shot in (data.get("shots") or [data] if isinstance(data, dict) else []):
                            shot_html = shot.get("html", "")
                            shot_type = seg.get("visual_type", "")
                            is_valid, html_issues = self._validate_html_segment(shot_html, shot_type)
                            if not is_valid and html_issues:
                                repaired, repair_usage = self._repair_html_segment(shot_html, html_issues, user_prompt)
                                shot["html"] = repaired
                                if repair_usage:
                                    usage["prompt_tokens"] += repair_usage.get("prompt_tokens", 0)
                                    usage["completion_tokens"] += repair_usage.get("completion_tokens", 0)
                                    usage["total_tokens"] += repair_usage.get("total_tokens", 0)

                    shot_entries = self._expand_shots(seg, data)
                    if not shot_entries:
                        raise RuntimeError(f"HTML model did not return any usable shots for segment {seg.get('index')}.")
                    base_start = float(seg["start"])
                    base_end = float(seg["end"])
                    self._ensure_segment_coverage(shot_entries, seg, base_start, base_end)
                    self._apply_layout_to_entries(shot_entries, seg)
                    return shot_entries, usage
                except Exception as e:
                    if attempt < max_retries - 1:
                        err_str = str(e).lower()
                        # Pick a base delay suited to the failure type:
                        #   429 / rate-limit  → longer wait (server needs breathing room)
                        #   500 / overload    → moderate wait with jitter
                        #   JSON parse fail   → quick retry (no server issue)
                        if "429" in err_str or "rate" in err_str or "quota" in err_str:
                            base = 10.0
                        elif "500" in err_str or "server error" in err_str or "overload" in err_str or "unavailable" in err_str:
                            base = 4.0
                        else:
                            base = 1.5  # JSON parse or other transient error
                        # Exponential + jitter so parallel workers don't all retry at once
                        wait_time = min(base * (1.6 ** attempt) * _rnd.uniform(0.7, 1.3), 45.0)
                        print(f"⚠️  Attempt {attempt + 1}/{max_retries} failed for segment "
                              f"{seg.get('index')}: {e}")
                        print(f"   Retrying in {wait_time:.1f}s...")
                        time.sleep(wait_time)
                    else:
                        print(f"❌ All {max_retries} attempts failed for segment {seg.get('index')}")
                        raise

        results: List[Dict[str, Any]] = []
        total_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

        with concurrent.futures.ThreadPoolExecutor(max_workers=min(8, len(segments) or 1)) as executor:
            future_map = {executor.submit(task, seg): seg for seg in segments}
            for future in concurrent.futures.as_completed(future_map):
                seg = future_map[future]
                result_entries, usage = future.result()
                results.extend(result_entries)
                if usage:
                    total_usage["prompt_tokens"] += usage.get("prompt_tokens", 0)
                    total_usage["completion_tokens"] += usage.get("completion_tokens", 0)
                    total_usage["total_tokens"] += usage.get("total_tokens", 0)
                # Notify caller as soon as this segment's entries are ready so that
                # image generation can start in parallel with remaining HTML work.
                if on_segment_done and result_entries:
                    try:
                        on_segment_done(result_entries)
                    except Exception as _cb_err:
                        print(f"    ⚠️  on_segment_done callback error (non-fatal): {_cb_err}")

        results.sort(key=lambda item: item["start"])
        return results, total_usage

    def _parse_html_response(self, raw: str, seg: Dict[str, Any], run_dir: Path) -> Dict[str, Any]:
        try:
            data = _extract_json_blob(raw)
            if isinstance(data, list):
                data = data[0] if data else {}
            if not isinstance(data, dict):
                raise ValueError("HTML payload was not a JSON object.")
            return data
        except Exception as e:
            debug_path = self._write_html_debug_blob(run_dir, seg, raw)
            print(f"⚠️  JSON Parsing Error for segment {seg.get('index')}: {e}")
            print(f"    Raw content preview: {raw[:200]}...")
            print(f"    Full raw content saved to: {debug_path}")
            
            seg_dur = max(5.0, float(seg.get("end", 0)) - float(seg.get("start", 0)))
            fallback = self._fallback_html_payload(raw, seg_duration=seg_dur)
            if fallback:
                print(
                    f"⚠️  Using fallback markup for segment {seg.get('index')}."
                )
                return fallback
            raise RuntimeError(
                f"Unable to parse HTML JSON for segment {seg.get('index')} (raw saved to {debug_path})"
            )

    def _fallback_html_payload(self, raw: str, seg_duration: float = 60.0) -> Dict[str, Any]:
        stripped = self._strip_code_fences(raw)
        if stripped.startswith("{") and stripped.rstrip().endswith("}"):
            try:
                data = json.loads(stripped)
                if isinstance(data, dict) and "shots" in data:
                    return data
            except json.JSONDecodeError:
                pass

        html = stripped
        if stripped.strip().startswith("{") or stripped.strip().startswith("["):
            import ast
            # Aggressive extraction of "html": "..." strings if JSON is broken
            matches = list(re.finditer(r'"html"\s*:\s*("(?:\\.|[^"\\])*")', stripped))
            if matches:
                html_parts = []
                for m in matches:
                    try:
                        extracted = ast.literal_eval(m.group(1))
                        html_parts.append(extracted)
                    except Exception:
                        extracted = m.group(1)[1:-1].replace('\\"', '"').replace('\\n', '\n')
                        html_parts.append(extracted)
                html = "\n<!-- SHOT SPLIT -->\n".join(html_parts)
            else:
                cleaned = stripped.replace('\\"', '"').replace('\\n', '\n')
                match_start = re.search(r'<(style|div|svg|h[1-6])\b', cleaned, re.IGNORECASE)
                if match_start:
                    html = cleaned[match_start.start():]
                    html = re.sub(r'"?\s*\n?\s*\}\s*\]\s*\}\s*$', '', html).strip()

        if "<" not in html or ">" not in html:
            return {}

        return {
            "shots": [
                {
                    "offsetSeconds": 0,
                    "durationSeconds": max(5.0, seg_duration),
                    "htmlStartX": 0,
                    "htmlStartY": 0,
                    "width": self.video_width,
                    "height": self.video_height,
                    "html": html,
                }
            ]
        }

    @staticmethod
    def _build_kinetic_text_html(
        words_in_shot: List[Dict[str, Any]],
        start_time: float,
        palette: Dict[str, Any],
        bg_type: str,
    ) -> str:
        """100% accurate word-sync kinetic typography. Bypasses LLM entirely.

        Each word fades/slides in at its exact Whisper-aligned timestamp.
        Called when shot_type == 'KINETIC_TEXT' in super_ultra tier.
        """
        text_color = palette.get("text", "#ffffff")
        bg_css = "background:#000000" if bg_type == "black" else "background:#ffffff"
        spans: List[str] = []
        triggers: List[str] = []
        for i, w in enumerate(words_in_shot):
            word = str(w.get("word", "")).strip()
            if not word:
                continue
            delay = round(max(0.0, float(w["start"]) - start_time), 3)
            spans.append(
                f'<span id="kw{i}" style="opacity:0;display:inline-block;margin:0 6px">{word}</span>'
            )
            triggers.append(
                f'gsap.fromTo("#kw{i}", {{opacity:0,y:20}}, '
                f'{{opacity:1,y:0,duration:0.2,delay:{delay},ease:"power2.out"}});'
            )
        if not spans:
            return f'<div style="width:100%;height:100%;{bg_css}"></div>'
        spans_html = "".join(spans)
        triggers_js = "\n".join(triggers)
        return (
            f'<div style="width:100%;height:100%;display:flex;align-items:center;'
            f'justify-content:center;{bg_css};padding:80px">'
            f'<div style="font-size:3.4rem;font-family:\'Montserrat\',sans-serif;'
            f'font-weight:700;line-height:1.9;text-align:center;'
            f'color:{text_color};max-width:1400px">'
            f'{spans_html}'
            f'</div>'
            f'</div>'
            f'<script>\n{triggers_js}\n</script>'
        )

    @staticmethod
    def _sanitize_html_content(html: str) -> str:
        """
        Fix common LLM artifacts in HTML:
        1. Replace Unicode arrows in Mermaid syntax (→ to -->).
        2. Remove repetitive 'In In In' garbage lines.
        3. Fix missing animations for opacity:0 elements.
        4. Remove hallucinated JSON blocks nested inside the HTML string.
        """
        if not html:
            return ""
            
        # 1. Strip out hallucinated nested JSON blocks (e.g. LLM writes { "shots": ... inside the HTML string)
        # This prevents raw JSON text from rendering visibly on the frontend!
        # If we detect a nested JSON structure, we will TRY to extract the REAL `html` string from inside it.
        # Otherwise, we truncate.
        hallucination_match = re.search(r'\{[\s\n]*"?(shots|offsetSeconds|inTime)"?\s*:', html)
        if hallucination_match:
            idx = hallucination_match.start()
            nested_matches = list(re.finditer(r'"html"\s*:\s*"', html[idx:]))
            if nested_matches:
                nested_parts = []
                for m in nested_matches:
                    start_str = idx + m.end()
                    # find the end of the string, respecting escapes
                    end_str = start_str
                    escaped = False
                    while end_str < len(html):
                        if escaped:
                            escaped = False
                        elif html[end_str] == '\\':
                            escaped = True
                        elif html[end_str] == '"':
                            # Look ahead to verify this is the actual end of the JSON value
                            remaining = html[end_str+1:].lstrip()
                            if not remaining or remaining[0] in "}],":
                                break
                        end_str += 1
                    
                    val = html[start_str:end_str]
                    # Unescape standard JSON string escapes
                    val = val.replace('\\"', '"').replace('\\n', '\n')
                    nested_parts.append(val)
                
                if nested_parts:
                    extracted = "\n<!-- SHOT SPLIT -->\n".join(nested_parts)
                    # Recursively sanitize the extracted html (in case it also has garbage trailing)
                    return AutomationPipeline._sanitize_html_content(extracted)
            
            # If we couldn't find a nested "html" key inside the hallucination, truncate
            html = html[:idx].strip()
            
        # 2. Fix Mermaid arrows (naive global replace is risky but usually safe for arrows)
        # We target specific unicode arrows often used by LLMs
        # Right arrow
        html = re.sub(r'([=-])\s*[→⇒]\s*', r'\1->', html)  # e.g., -→ to -->
        html = re.sub(r'[→⇒]>', '-->', html)               # e.g., →> to -->
        html = html.replace('→', '-->')
        html = html.replace('⇒', '==>')
        
        # 3. Fix "In In In" garbage
        # Regex to match lines that are mostly "In" repeated
        html = re.sub(r'(?:\bIn\s+){3,}\bIn', '', html)
        
        # 4. Sanitize attribute artifacts: class="]mermaid[" -> class="mermaid"
        html = re.sub(r'=(["\'])\](.*?)\[\1', r'=\1\2\1', html)

        # 5. FIX CRITICAL: Ensure elements with opacity:0 have animations
        # Find all elements with opacity:0 and extract their IDs
        opacity_zero_ids = re.findall(r'id=["\']([^"\']+)["\'][^>]*style=["\'][^"\']*opacity\s*:\s*0', html)
        opacity_zero_ids += re.findall(r'style=["\'][^"\']*opacity\s*:\s*0[^"\']*["\'][^>]*id=["\']([^"\']+)["\']', html)
        
        # Check if there's a script tag
        has_script = '<script>' in html.lower() or '<script ' in html.lower()
        
        if opacity_zero_ids and not has_script:
            # No script tag but we have hidden elements - add auto-animation script
            selectors = ', '.join([f'#{id}' for id in set(opacity_zero_ids)])
            auto_script = f"""<script>
// Auto-generated: Animate hidden elements
gsap.to('{selectors}', {{opacity: 1, y: 0, duration: 0.5, stagger: 0.15, delay: 0.2, ease: 'power2.out'}});
</script>"""
            html = html + auto_script
        elif opacity_zero_ids and has_script:
            # Has script but check if IDs are referenced in the script
            script_match = re.search(r'<script[^>]*>(.*?)</script>', html, re.DOTALL | re.IGNORECASE)
            if script_match:
                script_content = script_match.group(1)
                missing_ids = [id for id in set(opacity_zero_ids) if id not in script_content]
                if missing_ids:
                    # Some IDs are not animated - add them
                    selectors = ', '.join([f'#{id}' for id in missing_ids])
                    additional_script = f"""<script>
// Auto-generated: Animate missing hidden elements
gsap.to('{selectors}', {{opacity: 1, y: 0, duration: 0.5, stagger: 0.15, delay: 0.2, ease: 'power2.out'}});
</script>"""
                    html = html + additional_script
        if "graph TD" in html or "graph LR" in html:
            # Attempt to fix A"Label" pattern, but avoid breaking HTML attrs.
            # HTML attrs always have `=` or space before value? No. `required` has no value.
            # `class="foo"` has `=`.
            # The error pattern is `ID"Label"` -> NO equals sign.
            # So we specifically look for: Word followed IMMEDIATEY by Quote, with NO equals sign.
            html = re.sub(r'\b([A-Za-z0-9_]+)"([^"]+)"', r'\1["\2"]', html)
            
            # Note: This effectively breaks `class="foo"`?
            # `class` is word. `"` follows. 
            # `class`="foo" has `=` in betweeen.
            # My regex `([A-Za-z0-9_]+)"` assumes NO intervening characters.
            # `class="foo"` -> `class` matches group 1? No, `class=` would be the text. `=` is not alphanumeric.
            # So `class="foo"` does NOT match `([A-Za-z0-9_]+)"`.
            # `width="100"` does NOT match.
            # `A"Label"` DOES match.
            # So this regex `\b([A-Za-z0-9_]+)"([^"]+)"` is actually reasonably safe for HTML attributes with `=`!

            # 4. Fix ID(Label)"" pattern (The error seen in user logs)
            # Replaces `AnyWord(AnyContent)""` with `AnyWord["AnyContent"]`
            # This handles cases where LLM creates a round node but then appends empty quotes or messes up.
            html = re.sub(r'\b([A-Za-z0-9_]+)\(([^)]+)\)""', r'\1["\2"]', html)
            
            # 5. Fix ID(Label)"Real Label" -> ID["Real Label"] (discarding the parens content as ID part?)
            # Or ID(Content)"Label" -> ID["Label"]? 
            # If the LLM writes `Node(Description)"Label"`, getting `Node["Label"]` is probably safer.
            html = re.sub(r'\b([A-Za-z0-9_]+)\([^)]+\)"([^"]+)"', r'\1["\2"]', html)

            # 6. Aggressive Stutter/Recursion Fixes
            # Fix: A"""DNA -> A["DNA
            html = html.replace('"""', '["')
            
            # Reverted global [" and "] replacements (caused SVG attribute corruption)
            # html = html.replace('[""', '["').replace('""]', '"]')

            # Fix: Word[""Word["... -> Word["Word...
            # This regex looks for `ID["` followed by `ID["` again nearby
            # We replace `ID["ID["` with `ID["`
            html = re.sub(r'\b([A-Za-z0-9_]+)\[""\1\["', r'\1["', html)

            # Fix: `A(Nested(Parens))-->B` classic Mermaid error.
            # Convert `ID(Content)` to `ID["Content"]` IF followed by an arrow.
            # This allows nested parens to just exist inside the quotes, which is valid.
            # \((.+)\) is greedy, so it grabs everything up to the last paren before the arrow.
            html = re.sub(r'\b([A-Za-z0-9_]+)\((.+)\)(?=\s*(?:---|==>|-\.))', r'\1["\2"]', html)
            
            # Fix: `viewBox="[0 0 100 100]"` (SVG JSON array style error)
            # Remove brackets from viewBox attribute
            html = re.sub(r'viewBox=["\']\[?([0-9\s\.]+)\]?["\']', r'viewBox="\1"', html)

        # FINAL SWEEP: Remove any trailing conversational LLM text or markdown
        # Very often, the LLM will output valid HTML and then write its own thoughts
        # "Wait, the delay for cleavage..."
        # Simply find the very last closing > bracket and delete EVERYTHING after it.
        last_tag_idx = html.rfind('>')
        if last_tag_idx != -1:
            html = html[:last_tag_idx + 1]

        return html

    @staticmethod
    def _strip_code_fences(raw: str) -> str:
        text = raw.strip()
        if text.startswith("```"):
            text = re.sub(r"^```[a-zA-Z0-9_-]*", "", text, count=1).strip()
            if text.endswith("```"):
                text = text[: -3]
        return text.strip()

    def _write_html_debug_blob(self, run_dir: Path, seg: Dict[str, Any], raw: str) -> Path:
        debug_dir = run_dir / "_html_debug"
        debug_dir.mkdir(parents=True, exist_ok=True)
        index = seg.get("index", "unknown")
        timestamp = datetime.now().strftime("%H%M%S")
        debug_path = debug_dir / f"segment_{index}_{timestamp}.txt"
        debug_path.write_text(raw)
        return debug_path

    def _expand_shots(self, seg: Dict[str, Any], data: Dict[str, Any]) -> List[Dict[str, Any]]:
        shot_candidates = (
            data.get("shots")
            or data.get("layouts")
            or data.get("slides")
            or data.get("cards")
            or data.get("frames")
        )
        if shot_candidates is None:
            shot_candidates = [data]
        elif isinstance(shot_candidates, dict):
            shot_candidates = [shot_candidates]

        base_start = float(seg["start"])
        base_end = float(seg["end"])
        seg_duration = max(0.5, base_end - base_start)
        total_shots = max(1, len(shot_candidates))
        default_span = seg_duration / total_shots
        entries: List[Dict[str, Any]] = []

        for idx, shot in enumerate(shot_candidates):
            if not isinstance(shot, dict):
                continue
            html = shot.get("html") or data.get("html")
            if not html:
                continue
            html = self._sanitize_html_content(html)
            html = self._ensure_fonts(html)

            start_time = self._resolve_shot_start(shot, base_start, seg_duration, idx, default_span, seg.get("words", []))
            duration = self._resolve_shot_duration(shot, seg_duration, default_span)
            if duration <= 0:
                continue
            end_time = min(base_end, start_time + duration)
            if end_time <= base_start:
                continue

            x, y, w, h, auto_box = self._resolve_shot_box(shot)
            entry = {
                "start": max(base_start, start_time),
                "end": max(base_start, end_time),
                "htmlStartX": x,
                "htmlStartY": y,
                "htmlEndX": x + w,
                "htmlEndY": y + h,
                "html": html,
                "id": shot.get("id") or f"segment-{seg.get('index')}-shot-{idx}",
                "index": seg.get("index"),
            }
            if auto_box:
                entry["_autoBox"] = True
            if "z" in shot:
                try:
                    entry["z"] = int(shot["z"])
                except (TypeError, ValueError):
                    pass
            entries.append(entry)

        # --- Enforce No-Overlap Rule (Sequential Only) ---
        # Sort by start time to be sure
        entries.sort(key=lambda x: x["start"])
        
        # Minimum shot duration to allow animations to complete
        MIN_SHOT_DURATION = 3.0  # At least 3 seconds per shot
        
        # Iterate and clamp duration of current shot if it overlaps with next
        for i in range(len(entries) - 1):
            curr = entries[i]
            nxt = entries[i+1]
            
            # If current ends after next starts, clamp current
            if curr["end"] > nxt["start"]:
                curr["end"] = nxt["start"]
            
            # If clamping made it too short, enforce minimum duration
            if curr["end"] - curr["start"] < MIN_SHOT_DURATION:
                # Try to extend, but don't overlap with next
                desired_end = curr["start"] + MIN_SHOT_DURATION
                curr["end"] = min(desired_end, nxt["start"])
            
            # Absolute minimum to prevent zero-duration shots
            if curr["end"] <= curr["start"]:
                curr["end"] = curr["start"] + 0.5
        
        # Also enforce minimum duration for the last entry
        if entries:
            last = entries[-1]
            if last["end"] - last["start"] < MIN_SHOT_DURATION:
                last["end"] = min(last["start"] + MIN_SHOT_DURATION, base_end)
                
        # Also ensure last shot doesn't exceed base_end (already handled by min(base_end) in loop)
        # -------------------------------------------------

        if not entries:
            html = data.get("html")
            if html:
                html = self._ensure_fonts(html)
                entries.append(
                    {
                        "start": base_start,
                        "end": base_end,
                        "htmlStartX": 510,
                        "htmlStartY": 320,
                        "htmlEndX": 1410,
                        "htmlEndY": 680,
                        "html": html,
                        "id": f"segment-{seg.get('index')}-fallback",
                        "index": seg.get("index"),
                        "_autoBox": True,
                    }
                )
        return entries

    @staticmethod
    def _resolve_shot_start(
        shot: Dict[str, Any], 
        base_start: float, 
        seg_duration: float, 
        idx: int, 
        default_span: float,
        seg_words: List[Dict[str, Any]] = None
    ) -> float:
        """
        Determine absolute start time of a shot. 
        Prioritizes 'start_word' alignment, then 'offsetSeconds', then index-based fallback.
        """
        # 1. Try aligning to 'start_word' if provided
        start_phrase = shot.get("start_word")
        if start_phrase and seg_words:
            # Normalize phrase: lowercase, remove non-alphanumeric
            def clean(s): return re.sub(r'[^a-z0-9]', '', str(s).lower())
            
            target_tokens = [clean(w) for w in start_phrase.split() if clean(w)]
            if target_tokens:
                # Search for the sequence in seg_words
                # We do a naive sliding window
                segment_tokens = [clean(w["word"]) for w in seg_words]
                
                # Find first occurrence
                match_idx = -1
                window_len = len(target_tokens)
                for i in range(len(segment_tokens) - window_len + 1):
                    if segment_tokens[i : i + window_len] == target_tokens:
                        match_idx = i
                        break
                
                # If exact match failed, try matching just the first long word (>3 chars)
                if match_idx == -1:
                    significant = next((w for w in target_tokens if len(w) > 3), None)
                    if significant:
                        try:
                            match_idx = segment_tokens.index(significant)
                        except ValueError:
                            pass
                
                if match_idx != -1:
                    # Found it! Return the start time of the word
                    # The word objects usually have 'start' as float or string
                    try:
                        return float(seg_words[match_idx]["start"])
                    except (ValueError, KeyError, TypeError):
                        pass

        # 2. Fallbacks
        def coerce(value, fallback):
            try:
                return float(value)
            except (TypeError, ValueError):
                return fallback

        if "absoluteStart" in shot:
            return coerce(shot["absoluteStart"], base_start)
        offset = coerce(shot.get("offsetSeconds"), None)
        if offset is None and "offset" in shot:
            offset = coerce(shot["offset"], None)
        if offset is None and "offsetFraction" in shot:
            offset = coerce(shot["offsetFraction"], 0.0) * seg_duration
        if offset is None:
            offset = idx * default_span
        return max(base_start, base_start + offset)

    def _resolve_shot_duration(self, shot: Dict[str, Any], seg_duration: float, default_span: float) -> float:
        def coerce(value, fallback):
            try:
                return float(value)
            except (TypeError, ValueError):
                return fallback

        duration = coerce(shot.get("durationSeconds"), None)
        if duration is None and "duration" in shot:
            duration = coerce(shot["duration"], None)
        if duration is None and "durationFraction" in shot:
            duration = coerce(shot["durationFraction"], 0.0) * seg_duration
        if duration is None:
            duration = default_span
        # Enforce pacing-aware min/max per shot
        _pacing = self.PACING_PROFILES.get(
            getattr(self, "_pacing_style", "education"),
            self.PACING_PROFILES["education"],
        )
        return max(_pacing["min_shot_duration"], min(_pacing["max_shot_duration"], duration))

    def _resolve_shot_box(self, shot: Dict[str, Any]) -> Tuple[int, int, int, int, bool]:
        def coerce_int(value, fallback):
            try:
                return int(round(float(value)))
            except (TypeError, ValueError):
                return fallback

        box = shot.get("box") or {}
        x = coerce_int(shot.get("htmlStartX"), None)
        y = coerce_int(shot.get("htmlStartY"), None)
        w = coerce_int(shot.get("width"), None)
        h = coerce_int(shot.get("height"), None)

        if x is None and "x" in box:
            x = coerce_int(box["x"], None)
        if y is None and "y" in box:
            y = coerce_int(box["y"], None)
        if w is None and "w" in box:
            w = coerce_int(box["w"], None)
        if h is None and "h" in box:
            h = coerce_int(box["h"], None)

        _vw = getattr(self, 'video_width', 1920)
        _vh = getattr(self, 'video_height', 1080)
        auto_box = False
        if w is None:
            w = _vw
            auto_box = True
        if h is None:
            h = _vh
            auto_box = True

        # Auto-center if x/y are missing but w/h are known (or defaulted above)
        if x is None:
            x = (_vw - w) // 2
            auto_box = True
        if y is None:
            y = (_vh - h) // 2
            auto_box = True

        w = max(200, w)
        h = max(150, h)
        return x, y, w, h, auto_box

    # Extra Google Fonts families required by each template (appended to the base import)
    _TEMPLATE_EXTRA_FONT_FAMILIES: Dict[str, str] = {
        "whiteboard":  "Caveat:wght@400;600;700",
        "chalkboard":  "Caveat:wght@400;600;700",
        "glamour":     "Playfair+Display:ital,wght@0,400;0,700;1,400",
        "diorama":     "Poppins:wght@400;600;700;800",
        "neon":        "Orbitron:wght@400;700;900&family=Share+Tech+Mono",
        "blueprint":   "Courier+Prime:wght@400;700&family=Share+Tech+Mono",
        "minimal":     "Inter:wght@300;400;600;700",
        "cerulean":    "Inter:wght@400;600;700",
    }

    def _build_overlay_source_clip_html(
        self,
        overlay_slots: list,
        accent_color: str,
        source_video_url: str,
        source_start: float,
        source_end: float,
    ) -> str:
        """
        Deterministic HTML for SOURCE_CLIP shots in overlay infographic mode.

        Layout:
          - source video fills 100% of canvas (via .source-clip-bounds marker
            the render worker already detects)
          - overlay_slots[] are absolutely-positioned cards over the video
            (top-right, top-left, bottom-banner, left-ribbon)
          - GSAP fade+slide-in for each slot

        No LLM call — fully templated for predictability.
        """
        from html import escape as _esc

        def _slot_html(idx: int, slot: dict) -> str:
            position = (slot.get("position") or "top-right").lower()
            tag = _esc(str(slot.get("tag") or ""))
            title = _esc(str(slot.get("title") or ""))
            detail = _esc(str(slot.get("detail") or ""))
            caption = _esc(str(slot.get("caption") or ""))
            uid = f"ov{idx}"

            if position == "bottom-banner":
                inner_html = (
                    f"<div style=\"font-size:1.4rem; font-weight:600; color:#ffffff; "
                    f"line-height:1.4;\">{caption or title}</div>"
                    + (f"<div style=\"margin-top:0.4rem; font-size:1rem; "
                       f"color:rgba(255,255,255,0.85); line-height:1.5;\">{detail}</div>" if detail else "")
                )
                return (
                    f'<div id="{uid}" class="overlay-callout overlay-bottom-banner" '
                    f'style="position:absolute; left:0; right:0; bottom:0; '
                    f'padding:1.6rem 6% 1.8rem; '
                    f'background:linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0.0)); '
                    f'opacity:0; transform:translateY(20px);">{inner_html}</div>'
                )

            if position == "left-ribbon":
                ribbon_text = caption or title or tag
                return (
                    f'<div id="{uid}" class="overlay-callout overlay-left-ribbon" '
                    f'style="position:absolute; top:0; bottom:0; left:0; width:8%; '
                    f'min-width:88px; background:rgba(15,23,42,0.78); '
                    f'backdrop-filter:blur(8px); display:flex; align-items:center; '
                    f'justify-content:center; padding:1rem 0.5rem; '
                    f'opacity:0; transform:translateX(-20px);">'
                    f'<div style="writing-mode:vertical-rl; transform:rotate(180deg); '
                    f'color:#ffffff; font-size:0.95rem; font-weight:600; '
                    f'letter-spacing:0.18em; text-transform:uppercase;">{ribbon_text}</div>'
                    f'</div>'
                )

            # default = corner card (top-right / top-left)
            corner_pos = "top:6%; left:5%;" if position == "top-left" else "top:6%; right:5%;"
            translate_in = "-18px" if position == "top-left" else "18px"
            tag_html = (
                f'<div class="overlay-tag" style="font-size:0.72rem; letter-spacing:0.16em; '
                f'text-transform:uppercase; color:{accent_color}; font-weight:700; '
                f'margin-bottom:0.4rem;">{tag}</div>'
            ) if tag else ""
            detail_html = (
                f'<p style="margin:0.4rem 0 0; font-size:0.95rem; line-height:1.45; '
                f'color:rgba(255,255,255,0.88); font-family:Inter,system-ui,sans-serif;">{detail}</p>'
            ) if detail else ""
            return (
                f'<div id="{uid}" class="overlay-callout overlay-{position}" '
                f'style="position:absolute; {corner_pos} max-width:32%; min-width:220px; '
                f'background:rgba(15,23,42,0.78); backdrop-filter:blur(10px); '
                f'border:1px solid rgba(255,255,255,0.14); border-radius:14px; '
                f'padding:1rem 1.2rem; color:#ffffff; '
                f'box-shadow:0 10px 30px rgba(0,0,0,0.45); '
                f'opacity:0; transform:translate({translate_in},-8px);">'
                f'{tag_html}'
                f'<h3 style="margin:0; font-size:1.4rem; font-weight:700; '
                f'line-height:1.2; font-family:Inter,system-ui,sans-serif;">{title}</h3>'
                f'{detail_html}'
                f'</div>'
            )

        slots_html = "".join(_slot_html(i, s) for i, s in enumerate(overlay_slots or []))

        # Animation timeline — staggered fade+slide for each callout
        anim_js_parts = []
        for i, slot in enumerate(overlay_slots or []):
            uid = f"ov{i}"
            position = (slot.get("position") or "top-right").lower()
            if position == "bottom-banner":
                anim_js_parts.append(
                    f"gsap.to('#{uid}',{{opacity:1,y:0,duration:0.55,"
                    f"ease:'power2.out',delay:{0.2 + i * 0.18}}});"
                )
            elif position == "left-ribbon":
                anim_js_parts.append(
                    f"gsap.to('#{uid}',{{opacity:1,x:0,duration:0.5,"
                    f"ease:'power2.out',delay:{0.2 + i * 0.18}}});"
                )
            else:
                anim_js_parts.append(
                    f"gsap.to('#{uid}',{{opacity:1,x:0,y:0,duration:0.5,"
                    f"ease:'power2.out',delay:{0.2 + i * 0.18}}});"
                )
        anim_js = "".join(anim_js_parts)

        # Source video tag — embedded inside .source-clip-bounds so the renderer
        # detects the full-canvas black region and composites the source video
        # to fill the entire frame.
        video_tag = ""
        if source_video_url:
            video_tag = (
                f'<video data-source-clip="true" data-source-start="{source_start}" '
                f'src="{source_video_url}#t={source_start},{source_end}" '
                f'autoplay muted playsinline '
                f'style="width:100%;height:100%;object-fit:cover;pointer-events:none;"></video>'
            )

        html_doc = (
            "<!DOCTYPE html><html><head>"
            "<style>*{margin:0;padding:0;box-sizing:border-box}</style>"
            "</head><body style='width:100%;height:100%;background:transparent;overflow:hidden;'>"
            "<div class='source-overlay-host' "
            "style='position:absolute; inset:0; background:#000000; overflow:hidden;'>"
            "<div class='source-clip-bounds' "
            f"style='position:absolute; inset:0; background:#000000; overflow:hidden;'>{video_tag}</div>"
            f"{slots_html}"
            "</div>"
            "<script>window.addEventListener('load',function(){"
            f"if(typeof gsap!=='undefined'){{{anim_js}}}"
            "})</script>"
            "</body></html>"
        )
        return self._ensure_fonts(html_doc)

    def _ensure_fonts(self, html: str) -> str:
        # Get colors based on background_type, preferring brand-override'd palette from style_guide
        bg_type = getattr(self, '_current_background_type', 'white')
        preset = BACKGROUND_PRESETS.get(bg_type, BACKGROUND_PRESETS["white"])

        # Brand palette (resolved style_guide) wins over raw preset defaults
        _sg = getattr(self, '_current_style_guide', None) or {}
        _palette = _sg.get("palette", {}) if isinstance(_sg, dict) else {}

        text_color = _palette.get("text", preset["text"])
        text_secondary = _palette.get("text_secondary", preset["text_secondary"])
        primary_color = _palette.get("primary", preset["primary"])
        accent_color = _palette.get("accent", preset["accent"])
        background_color = _palette.get("background", preset.get("background", "#ffffff"))
        svg_stroke_color = _palette.get("svg_stroke", primary_color)
        svg_fill_color = _palette.get("svg_fill", primary_color)
        annotation_color = _palette.get("annotation_color", accent_color)
        
        # Common educational styles (Highlighting, Markers)
        # Build Google Fonts import URL — base fonts + any template-specific additions
        _style_cfg = getattr(self, '_current_style_config', None)
        _layout_theme = (_style_cfg or {}).get("layout_theme", "") if _style_cfg else ""
        _extra_family = self._TEMPLATE_EXTRA_FONT_FAMILIES.get(_layout_theme, "")
        # Bebas Neue is always loaded — the Director may pick KINETIC_TITLE / INFOGRAPHIC_SVG /
        # PRODUCT_HERO shots at any time, and they all need it for display typography.
        _base_families = "Montserrat:wght@700;900&family=Inter:wght@400;600&family=Fira+Code&family=Bebas+Neue"
        _fonts_param = f"{_base_families}&family={_extra_family}" if _extra_family else _base_families
        _fonts_url = f"https://fonts.googleapis.com/css2?family={_fonts_param}&display=swap"

        # .svg-canvas class is always injected so any shot (INFOGRAPHIC_SVG / KINETIC_TITLE)
        # that opts into the cream+grid canvas works regardless of the document background.
        svg_canvas_css = """
            /* --- ILLUSTRATED SVG: cream+grid canvas --- */
            .svg-canvas {
                width: 100%; height: 100%;
                position: relative;
                background-color: #f5f0e8;
                background-image:
                    linear-gradient(rgba(180,170,160,0.25) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(180,170,160,0.25) 1px, transparent 1px);
                background-size: 60px 60px;
                overflow: hidden;
            }
        """

        global_css = f"""<style>
            @import url('{_fonts_url}');

            /* --- BRAND PALETTE (institute AI settings → style_guide → CSS vars) --- */
            :root {{
              --brand-primary: {primary_color};
              --brand-accent: {accent_color};
              --brand-text: {text_color};
              --brand-text-secondary: {text_secondary};
              --brand-bg: {background_color};
              --brand-svg-stroke: {svg_stroke_color};
              --brand-svg-fill: {svg_fill_color};
              --brand-annotation: {annotation_color};
              /* Legacy aliases so older hardcoded var names still resolve */
              --primary-color: {primary_color};
              --accent-color: {accent_color};
              --text-color: {text_color};
            }}

            /* --- TEXT SAFETY: prevent word-smashing and overflow --- */
            * {{
              overflow-wrap: break-word;
              word-break: break-word;
              box-sizing: border-box;
            }}
            /* Character-level animation spans must NEVER break across lines.
               LLMs wrap individual letters in inline-block spans (e.g. class="s6-char",
               "-char", "-letter") — word-break:break-word lets the browser split lines
               between characters, producing "REALISTI" / "C" on separate lines.
               Force them to keep-all so line breaks only happen at word boundaries. */
            [class*="-char"],
            [class*="-letter"],
            [class*="char-"],
            [class*="letter-"] {{
              display: inline-block;
              white-space: nowrap;
              word-break: normal;
              overflow-wrap: normal;
            }}
            /* Word-level wrappers: prevent internal breaks, allow breaks between words */
            [class*="-word"],
            [class*="word-"] {{
              display: inline-block;
              white-space: nowrap;
              word-break: normal;
              overflow-wrap: normal;
            }}
            /* Prevent any element from exceeding the viewport */
            body, html {{
              overflow: hidden;
              width: 100%;
              height: 100%;
              margin: 0;
              padding: 0;
            }}
            /* LLM often generates inline-block word wrappers without gap/margin.
               This catches the common pattern: parent > inline-block children. */
            [class*="-word-wrap"],
            [class*="-word-row"] > div {{
              margin-right: 0.25em;
            }}
            /* Flexbox word rows — ensure gap if not set */
            [class*="-word-row"],
            [class*="-words"],
            [class*="word-row"] {{
              gap: 0.25em;
            }}
            /* Ensure large display text doesn't overflow */
            h1, h2, h3, .text-display {{
              max-width: 100%;
              padding: 0 4%;
            }}

            /* --- FULL SCREEN CENTER CONTAINER (CRITICAL) --- */
            .full-screen-center {{
              width: 100%;
              height: 100%;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              box-sizing: border-box;
              padding: 60px 80px;
            }}
            
            .highlight {{ 
              background: linear-gradient(120deg, rgba(255, 226, 89, 0.6) 0%, rgba(255, 233, 148, 0.4) 100%); 
              padding: 0 4px; border-radius: 4px; display: inline-block; 
              box-decoration-break: clone; -webkit-box-decoration-break: clone;
            }}
            .emphasis {{ color: var(--primary-color, {primary_color}); font-weight: bold; }}
            .mermaid {{ display: flex; justify-content: center; width: 100%; margin: 20px auto; }}

            /* --- LAYOUT UTILITIES --- */
            /* 1. Split Layout (Symetric/Asymetric) */
            .layout-split {{ 
              display: grid; grid-template-columns: 1fr 1fr; gap: 60px; 
              width: 90%; max-width: 1700px; align-items: center; justify-items: center; 
              text-align: left; 
            }}
            .layout-split.reverse {{ direction: rtl; }}
            .layout-split.reverse > * {{ direction: ltr; }}
            .layout-split.golden-left {{ grid-template-columns: 1.2fr 0.8fr; }}
            .layout-split.golden-right {{ grid-template-columns: 0.8fr 1.2fr; }}
            
            /* 2. Simple content sections (NO card-heavy design) */
            .layout-bento {{ 
              display: grid; grid-template-columns: repeat(2, 1fr); 
              gap: 40px; width: 90%; max-width: 1600px; align-content: center; 
            }}
            .content-section {{ 
              padding: 24px; 
              color: {text_color};
              /* NO shadows, NO blur, NO card-like appearance */
            }}
            /* Legacy .bento-card for compatibility - simplified */
            .bento-card {{ 
              padding: 24px; 
              border-left: 3px solid {primary_color};
              color: {text_color};
              /* NO shadows, NO rounded corners, NO blur */
            }}
            .bento-card.center {{ text-align: center; }}
            
            /* 3. Hero / Center Focus */
            .layout-hero {{ 
              display: flex; flex-direction: column; align-items: center; justify-content: center; 
              text-align: center; width: 80%; max-width: 1200px; gap: 32px; 
            }}
            
            /* 4. Code Split */
            .layout-code-split {{ 
              display: grid; grid-template-columns: 40% 60%; gap: 40px; 
              width: 95%; max-width: 1800px; align-items: center; 
              text-align: left; 
            }}
            
            /* Typography Helpers - use dynamic colors */
            .text-display {{ font-family: 'Montserrat', sans-serif; font-size: 64px; font-weight: 800; line-height: 1.1; letter-spacing: -0.02em; color: {text_color}; }}
            .text-h2 {{ font-family: 'Montserrat', sans-serif; font-size: 48px; font-weight: 700; margin-bottom: 16px; color: {text_color}; }}
            .text-body {{ font-family: 'Inter', sans-serif; font-size: 28px; font-weight: 400; color: {text_secondary}; line-height: 1.5; }}
            .text-label {{ font-family: 'Fira Code', monospace; font-size: 18px; color: {accent_color}; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px; display: block; }}
            
            /* --- CLEAN EDUCATIONAL COMPONENTS (NO shadows, NO app-like design) --- */
            
            /* Key Term Highlighting - simple underline */
            .key-term {{
              color: {accent_color};
              font-weight: 700;
              border-bottom: 3px solid {accent_color};
            }}
            
            /* Step Numbers - simple inline numbering */
            .step-number {{
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 48px;
              height: 48px;
              background: {primary_color};
              color: #fff;
              font-weight: 800;
              font-size: 24px;
              border-radius: 50%;
              margin-right: 16px;
            }}
            
            .step-item {{
              display: flex;
              align-items: flex-start;
              margin: 20px 0;
              color: {text_color};
            }}
            
            .step-content {{
              flex: 1;
            }}
            
            /* Simple divider line */
            .divider {{
              width: 100%;
              height: 2px;
              background: {primary_color};
              margin: 24px 0;
              opacity: 0.5;
            }}
            
            /* Arrow indicator for flow */
            .arrow-right {{
              display: inline-block;
              width: 0;
              height: 0;
              border-top: 12px solid transparent;
              border-bottom: 12px solid transparent;
              border-left: 20px solid {primary_color};
              margin: 0 16px;
            }}
            
            /* Simple label tag */
            .label-tag {{
              display: inline-block;
              padding: 4px 12px;
              background: {primary_color};
              color: #fff;
              font-size: 14px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }}
            
            /* Comparison - simple side by side */
            .comparison {{
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 60px;
              width: 100%;
            }}
            .comparison .side {{
              color: {text_color};
            }}
            .comparison .side-title {{
              font-size: 18px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.1em;
              margin-bottom: 16px;
              padding-bottom: 8px;
              border-bottom: 3px solid currentColor;
            }}
            .comparison .side.before .side-title {{ color: #ef4444; }}
            .comparison .side.after .side-title {{ color: #10b981; }}
            
            /* SVG container for diagrams */
            .svg-diagram {{
              width: 100%;
              max-width: 800px;
              margin: 0 auto;
            }}
            .svg-diagram svg {{
              width: 100%;
              height: auto;
            }}
            
            /* Simple bullet list */
            .simple-list {{
              list-style: none;
              padding: 0;
              margin: 0;
            }}
            .simple-list li {{
              padding: 12px 0;
              padding-left: 32px;
              position: relative;
              font-size: 24px;
              color: {text_color};
            }}
            .simple-list li::before {{
              content: '→';
              position: absolute;
              left: 0;
              color: {primary_color};
              font-weight: bold;
            }}

            :host {{
              width: 100%; height: 100%;
              display: flex; flex-direction: column; align-items: center; justify-content: center;
              font-family: 'Inter', sans-serif;
              color: {text_color};
            }}

            /* ═══════════════════════════════════════════════════════
               PROFESSIONAL QUALITY UTILITIES
               ═══════════════════════════════════════════════════════ */

            /* --- PRODUCT/SUBJECT STAGE --- */
            .product-stage {{
              position: relative;
              width: 100%; height: 100%;
              overflow: hidden;
              background: var(--brand-bg, {background_color});
            }}

            /* --- HALFTONE DOT PATTERNS --- */
            /* Dark dots (use on light backgrounds) */
            .halftone {{
              background-image: radial-gradient(circle, rgba(0,0,0,0.18) 1.5px, transparent 1.5px);
              background-size: 18px 18px;
            }}
            /* Light dots (use on dark / colored backgrounds) */
            .halftone-light {{
              background-image: radial-gradient(circle, rgba(255,255,255,0.22) 1.5px, transparent 1.5px);
              background-size: 18px 18px;
            }}

            /* --- FLAT BADGE (year / stat callout — zero border-radius) --- */
            .flat-badge {{
              display: inline-block;
              padding: 10px 36px;
              background: var(--brand-accent, {accent_color});
              font-family: 'Bebas Neue', Impact, sans-serif;
              font-size: 4rem;
              letter-spacing: 0.05em;
              line-height: 1;
              color: #111;
              border-radius: 0;
            }}
            .flat-badge.light {{
              background: #fff;
              color: #111;
            }}
            .flat-badge.dark {{
              background: #111;
              color: #fff;
            }}

            /* --- SLAM TEXT (translateY reveal from bottom) --- */
            .slam-wrapper {{
              overflow: hidden;
            }}
            .slam-text {{
              display: block;
              transform: translateY(102%);
              font-family: 'Bebas Neue', Impact, sans-serif;
              font-size: 5.5rem;
              letter-spacing: 0.06em;
              line-height: 1;
              color: var(--brand-text, {text_color});
            }}

            /* --- TRACKING LABEL (small ALL-CAPS below subject) --- */
            .tracking-label {{
              font-family: 'Inter', sans-serif;
              font-size: 0.85rem;
              font-weight: 700;
              letter-spacing: 0.28em;
              text-transform: uppercase;
              color: var(--brand-text, {text_color});
              opacity: 0.8;
            }}

            /* --- DISPLAY HEADLINE SCALE SIZES --- */
            .display-xl {{
              font-family: 'Bebas Neue', 'Montserrat', sans-serif;
              font-size: clamp(4rem, 12vw, 9rem);
              font-weight: 900;
              letter-spacing: 0.04em;
              line-height: 0.95;
              color: var(--brand-text, {text_color});
            }}
            .display-lg {{
              font-family: 'Bebas Neue', 'Montserrat', sans-serif;
              font-size: clamp(3rem, 8vw, 6rem);
              font-weight: 900;
              letter-spacing: 0.03em;
              line-height: 1;
              color: var(--brand-text, {text_color});
            }}

            /* --- ACCENT COLOR WORD SWAP --- */
            .accent-word {{
              color: var(--brand-accent, {accent_color});
            }}

            /* --- BACKGROUND GEOMETRIC WATERMARK (position:absolute, z-index:2) --- */
            .bg-watermark {{
              position: absolute;
              pointer-events: none;
              z-index: 2;
              opacity: 0;
            }}

            /* --- STAGE DRIFT (continuous hold-motion) ---
               Wrap full shot content in <div class='stage-drift'> and tween:
               gsap.fromTo('.stage-drift', {{x:0,y:0,scale:1}}, {{x:20,y:-10,scale:1.04, duration:12, ease:'none'}});
               This enforces the CONTINUOUS MOTION rule — no frame is ever fully static. */
            .stage-drift {{
              width: 100%;
              height: 100%;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              transform-origin: center center;
              will-change: transform;
            }}

            /* --- DRAFT/BLUEPRINT guides (two-phase SVG reveal) ---
               Light dashed guide layer for architect-drafting look. Solid
               overlay lands on top. Used by INFOGRAPHIC_SVG blueprint pattern. */
            .draft-guide {{
              stroke: rgba(20, 20, 20, 0.32);
              stroke-width: 1.5;
              stroke-dasharray: 4 4;
              fill: none;
            }}
            .solid-overlay {{
              stroke: var(--brand-text, {text_color});
              stroke-width: 2.5;
              fill: none;
            }}

            /* --- PAPER TEXTURE (parchment / sketchbook grain) ---
               Layer over .svg-canvas or .product-stage to get a subtle fibrous
               noise overlay. Uses inline SVG noise filter as data-URI, no PNG. */
            .paper-texture {{
              position: relative;
            }}
            .paper-texture::before {{
              content: "";
              position: absolute;
              inset: 0;
              background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.12  0 0 0 0 0.10  0 0 0 0 0.08  0 0 0 0.18 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
              background-size: 240px 240px;
              mix-blend-mode: multiply;
              pointer-events: none;
              opacity: 0.55;
              z-index: 1;
            }}
            /* Stronger variant for darker parchment look */
            .paper-texture.strong::before {{
              opacity: 0.85;
            }}

            /* --- TECH ANNOTATION (red dashed dimension lines + callouts) ---
               Utility color for architect/engineer annotations — NOT part of the
               brand palette. Used for dimension lines, crosshairs, measurement
               arrows. One shot may use annotations freely; they read as "technical
               detail" and don't violate the 2-color content rule. */
            .tech-annotation {{
              stroke: #c4453a;
              stroke-width: 1.4;
              stroke-dasharray: 5 4;
              fill: none;
            }}
            .tech-annotation-label {{
              font-family: 'Inter', 'Fira Code', monospace;
              font-size: 0.7rem;
              font-weight: 600;
              letter-spacing: 0.12em;
              text-transform: uppercase;
              color: #c4453a;
            }}
            .tech-annotation-caption {{
              font-family: Georgia, 'Times New Roman', serif;
              font-style: italic;
              font-size: 0.85rem;
              color: var(--brand-text, {text_color});
              opacity: 0.75;
            }}

            /* --- VIGNETTE OVERLAY (scene-exit radial darkening transition) ---
               Start with opacity:0, tween to opacity:1 for cinematic fade-out.
               Combine with next-scene zoom for a seamless transition. */
            .vignette-overlay {{
              position: absolute;
              inset: 0;
              pointer-events: none;
              z-index: 50;
              opacity: 0;
              background: radial-gradient(ellipse at center,
                  transparent 15%,
                  rgba(0,0,0,0.35) 55%,
                  rgba(0,0,0,0.92) 100%);
            }}

            /* --- HAND-DRAWN ROUGHEN FILTER ---
               Applied via `filter="url(#roughen)"` on any SVG <path>/<rect>/<line>.
               Gives the blueprint-sketch wobble effect WITHOUT breaking
               stroke-dashoffset animation. Strength tuned so small drawings
               stay readable. See the inline <svg> defs block prepended at the
               top of every generated HTML. */

            {svg_canvas_css}
            </style>"""

        # Global SVG defs — hidden 0×0 SVG holding filters that any other
        # SVG in the document can reference. Used for the hand-drawn wobble
        # and paper grain effects in illustrated_svg / blueprint shots.
        svg_defs = """<svg width="0" height="0" style="position:absolute;pointer-events:none;" aria-hidden="true">
            <defs>
                <!-- Hand-drawn wobble — apply via filter="url(#roughen)" -->
                <filter id="roughen" x="-10%" y="-10%" width="120%" height="120%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="2" result="noise"/>
                    <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.6"/>
                </filter>
                <!-- Stronger wobble for bolder sketch feel -->
                <filter id="roughen-strong" x="-10%" y="-10%" width="120%" height="120%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="3" seed="5" result="noise"/>
                    <feDisplacementMap in="SourceGraphic" in2="noise" scale="4.2"/>
                </filter>
            </defs>
        </svg>"""

        # If the model already imports fonts, trust it.
        # But still inject our global helpers.
        if "fonts.googleapis.com" in html:
            return svg_defs + global_css + html

        # Fallback corporate pairing if none found
        base_style = (
            "<style>"
            "@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;900&family=Inter:wght@400;600&display=swap');"
            ":host { font-family: 'Inter', sans-serif; background: transparent; margin: 0; }"
            "h1, h2, h3, h4, h5, h6 { font-family: 'Montserrat', sans-serif; }"
            "</style>"
        )
        return svg_defs + global_css + base_style + html

    def _ensure_segment_coverage(
        self, entries: List[Dict[str, Any]], seg: Dict[str, Any], base_start: float, base_end: float
    ) -> None:
        # User requested "have one at all times", so we minimize gap tolerance.
        MIN_GAP = 0.05
        intervals: List[Tuple[float, float]] = []
        for entry in entries:
            start = max(base_start, float(entry.get("start", base_start)))
            end = min(base_end, float(entry.get("end", base_end)))
            if end - start > 0.1:
                intervals.append((start, end))
        intervals.sort()
        merged: List[List[float]] = []
        for start, end in intervals:
            if not merged or start > merged[-1][1] + 0.05:
                merged.append([start, end])
            else:
                merged[-1][1] = max(merged[-1][1], end)
        cursor = base_start
        filler_index = 0
        for start, end in merged:
            if start - cursor >= MIN_GAP:
                entries.append(self._build_fallback_entry(seg, cursor, start, filler_index))
                filler_index += 1
            cursor = max(cursor, end)
        if base_end - cursor >= MIN_GAP:
            entries.append(self._build_fallback_entry(seg, cursor, base_end, filler_index))

    def _build_fallback_entry(
        self, seg: Dict[str, Any], start: float, end: float, filler_index: int
    ) -> Dict[str, Any]:
        # Extract words relevant to the filler's time range from word-level data
        seg_words = seg.get("words", [])
        relevant_words = []
        for w in seg_words:
            w_start = float(w.get("start", 0))
            w_end = float(w.get("end", 0))
            # Include words that overlap with the filler time range
            if w_end >= start and w_start <= end:
                relevant_words.append(str(w.get("word", "")))
        
        # If we have word-level data, use it; otherwise fall back to segment text
        if relevant_words:
            snippet = " ".join(relevant_words[:22]) + ("..." if len(relevant_words) > 22 else "")
        else:
            text = str(seg.get("text", "")).strip()
            words = text.split()
            snippet = " ".join(words[:22]) + ("..." if len(words) > 22 else "")
        
        # Get colors based on background_type
        bg_type = getattr(self, '_current_background_type', 'white')
        preset = BACKGROUND_PRESETS.get(bg_type, BACKGROUND_PRESETS["white"])
        
        bg_color = preset["background"]
        text_color = preset["text"]
        label_color = preset["primary"]
        
        html = (
            "<style>"
            "@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700&family=Inter:wght@400;600&display=swap');"
            ".fs-container {"
            "  width: 100vw; height: 100vh;"
            "  display: flex; flex-direction: column; align-items: center; justify-content: center;"
            f"  background: {bg_color};"
            f"  color: {text_color};"
            "  font-family: 'Inter', sans-serif;"
            "  text-align: center;"
            "  padding: 60px;"
            "  box-sizing: border-box;"
            "}"
            ".fs-label {"
            "  font-family: 'Montserrat', sans-serif;"
            "  font-size: 24px;"
            "  text-transform: uppercase;"
            "  letter-spacing: 0.15em;"
            f"  color: {label_color};"
            "  margin-bottom: 32px;"
            "}"
            ".fs-content {"
            "  font-family: 'Montserrat', sans-serif;"
            "  font-size: 64px;"
            "  font-weight: 700;"
            "  line-height: 1.1;"
            "  max-width: 1600px;"
            f"  color: {text_color};"
            "}"
            "</style>"
            "<div class='fs-container'>"
            "<div class='fs-label'>Key Concept</div>"
            f"<div class='fs-content'>{snippet}</div>"
            "</div>"
            "<script>"
            "gsap.from('.fs-container > *', {y: 50, opacity: 0, duration: 1.2, stagger: 0.15, ease: 'power3.out'});"
            "</script>"
        )
        return {
            "start": start,
            "end": end,
            "htmlStartX": 0,
            "htmlStartY": 0,
            "htmlEndX": getattr(self, 'video_width', 1920),
            "htmlEndY": getattr(self, 'video_height', 1080),
            "html": html,
            "id": f"segment-{seg.get('index')}-filler-{filler_index}",
            "index": seg.get("index"),
            "_autoBox": True,
            "z": 1, # Background layer, but above character if we want covering? No, Character is separate. 1 is fine.

        }

    def _apply_layout_to_entries(self, entries: List[Dict[str, Any]], seg: Dict[str, Any]) -> None:
        # We now trust the LLM (or default to full screen) for geometry.
        # We only assign index and ensure int types.
        
        entries.sort(key=lambda x: x["start"])

        for i, entry in enumerate(entries):
            # Ensure Z index if missing
            if "z" not in entry:
                entry["z"] = 10 + i
            
            # Remove autoBox flag
            entry.pop("_autoBox", None)
            
            entry.setdefault("index", seg.get("index"))

    @staticmethod
    def _has_spatial_overlap(target: Dict[str, Any], others: List[Dict[str, Any]]) -> bool:
        tx1, ty1 = target["htmlStartX"], target["htmlStartY"]
        tx2, ty2 = target["htmlEndX"], target["htmlEndY"]
        
        for o in others:
            ox1, oy1 = o["htmlStartX"], o["htmlStartY"]
            ox2, oy2 = o["htmlEndX"], o["htmlEndY"]
            
            # Check intersection
            if not (tx2 <= ox1 or tx1 >= ox2 or ty2 <= oy1 or ty1 >= oy2):
                return True
        return False

    def _process_image_task_simple(
        self,
        task: Dict[str, Any],
        images_dir: Path,
    ) -> Optional[Dict[str, Any]]:
        """
        Thin wrapper used by the pipelined image generation in run().
        Generates one image and returns a result dict (or None on failure).
        May raise _ImageGenRateLimitError so the caller can handle requeue.
        """
        prompt   = task.get("prompt", "")
        seg_idx  = task.get("seg_idx", 0)
        full_tag = task.get("full_tag", "")
        entry    = task.get("entry")
        if not prompt:
            return None

        # Stock photo path: try configured providers in order (hint + fallback) before
        # falling through to AI generation.
        img_source = task.get("img_source", "generate")
        if self._tier_config.get("stock_preference") == "stock_only" and img_source == "generate":
            img_source = "stock"
        if img_source == "stock":
            orientation = "portrait" if getattr(self, 'video_width', 1920) < getattr(self, 'video_height', 1080) else "landscape"
            services = self._resolve_stock_provider_chain(task.get("stock_provider", ""), prompt)
            for svc in services:
                provider_name = type(svc).__name__.replace("Service", "")
                result = svc.search_photos(prompt, orientation=orientation)
                if result:
                    print(f"    📷 [pipeline] Stock photo ({provider_name}): {prompt[:60]}...")
                    return {
                        "entry":       entry,
                        "full_tag":    full_tag,
                        "stock_url":   result.get("url", ""),
                        "image_bytes": None,
                        "filename":    None,
                        "usage":       {},
                    }
            if services:
                print(f"    ⚠️  [pipeline] All stock providers failed, falling back to Seedream: {prompt[:50]}...")

        is_cutout = 'data-cutout="true"' in full_tag or "data-cutout='true'" in full_tag
        print(f"    🎨 [pipeline] Generating image{' (cutout)' if is_cutout else ''}: {prompt[:60]}...")
        image_bytes, usage_meta = self._call_image_generation_llm(prompt)
        if not image_bytes:
            # Seedream returned nothing — cascade through Pexels/Pixabay → SVG
            # placeholder so the shot doesn't ship with a broken `placeholder.png`.
            fb = self._image_fallback_chain(prompt, is_cutout=is_cutout)
            if fb:
                return {
                    "entry":       entry,
                    "full_tag":    full_tag,
                    "stock_url":   fb.get("stock_url"),
                    "image_bytes": fb.get("image_bytes"),
                    "is_svg":      fb.get("is_svg", False),
                    "filename":    None,
                    "usage":       usage_meta or {},
                }
            return None
        # Remove background for cutout assets, then VALIDATE the result has
        # actual transparency. rembg silently fails on ambiguous subjects and
        # returns a fully-opaque PNG — embedding that paints a white square
        # over the layout where transparency was promised.
        cutout_failed = False
        if is_cutout:
            image_bytes = self._remove_background(image_bytes)
            if not self._validate_cutout(image_bytes):
                cutout_failed = True
                print(f"    ⚠️  [pipeline] Cutout validation failed (no transparency) — hiding image element: {prompt[:60]}")
        filename = f"img_pipe_{seg_idx}_{abs(hash(prompt))}.png"
        try:
            (images_dir / filename).write_bytes(image_bytes)
        except Exception as _e:
            print(f"    ⚠️  Could not save pipelined image to disk (non-fatal): {_e}")
        print(f"    ✅ [pipeline] {filename} ({len(image_bytes)} bytes)")
        return {
            "entry":       entry,
            "full_tag":    full_tag,
            "image_bytes": image_bytes,
            "filename":    filename,
            "usage":       usage_meta,
            "cutout_failed": cutout_failed,
        }

    def _image_fallback_chain(
        self,
        prompt: str,
        is_cutout: bool = False,
    ) -> Optional[Dict[str, Any]]:
        """Cascade fallback when Seedream returns no bytes.

        Order:
          1. Pexels stock photo (skipped for cutouts — would not have transparency).
          2. Pixabay stock photo (same).
          3. Synthesized SVG placeholder using brand palette + prompt text.
              Always succeeds, so this is also the absolute last resort.

        Returns a dict matching the result-dict schema used by both
        `_process_image_task_simple` and `process_image_task`:
          - {"stock_url": "..."} for Pexels/Pixabay hits
          - {"image_bytes": <svg_bytes>, "is_svg": True} for the synthesized placeholder
          - None only if synthesis itself fails (should never happen).
        """
        # Stock fallback (skip for cutouts — stock photos rarely have alpha)
        if not is_cutout:
            try:
                orientation = "portrait" if (
                    getattr(self, 'video_width', 1920) < getattr(self, 'video_height', 1080)
                ) else "landscape"
                services = self._resolve_stock_provider_chain("", prompt)
                for svc in services:
                    provider_name = type(svc).__name__.replace("Service", "")
                    result = svc.search_photos(prompt, orientation=orientation)
                    if result and result.get("url"):
                        print(f"    🔄 Image fallback → stock photo ({provider_name}): {prompt[:50]}...")
                        return {"stock_url": result["url"], "image_bytes": None}
            except Exception as e:
                print(f"    ⚠️ Stock fallback errored ({e}); continuing to synth SVG")

        # Synth SVG placeholder — cannot fail
        try:
            svg_bytes = self._synthesize_svg_placeholder(prompt)
            print(f"    🔄 Image fallback → synthesized SVG placeholder: {prompt[:50]}...")
            return {"image_bytes": svg_bytes, "is_svg": True}
        except Exception as e:
            print(f"    ❌ SVG synth failed ({e}) — pipeline will leave placeholder src in HTML")
            return None

    def _synthesize_svg_placeholder(self, prompt: str) -> bytes:
        """Build a brand-themed SVG placeholder when both AI gen + stock fail.

        The SVG uses the run's palette (or a sensible default), shows the
        prompt's first noun phrase as a centered title, and adds a subtle
        gradient + corner mark so the result doesn't look like a broken image.
        Never raises — always returns valid bytes.
        """
        import html as _html_mod
        palette = (getattr(self, "_current_style_guide", None) or {}).get("palette") or {}
        bg = palette.get("background", "#0f172a")
        primary = palette.get("primary", "#3b82f6")
        accent = palette.get("accent", "#fbbf24")
        text_color = palette.get("text", "#f1f5f9")
        text_secondary = palette.get("text_secondary", "#94a3b8")

        w = int(getattr(self, "video_width", 1920))
        h = int(getattr(self, "video_height", 1080))

        # Take the first ~6 words of the prompt as the headline; cap length
        words = (prompt or "Image").split()
        headline = " ".join(words[:6]).strip()
        if len(headline) > 48:
            headline = headline[:45] + "…"
        headline_safe = _html_mod.escape(headline)
        # A short subtitle marker
        subtitle_safe = _html_mod.escape("AI image unavailable — placeholder")

        # Geometry — title centered, accent rule above
        cx, cy = w / 2, h / 2
        rule_w = max(80, w // 12)
        rule_y = cy - 90
        # Font sizes scale with canvas dimension
        title_size = max(40, min(110, int(w / 22)))
        sub_size = max(14, min(28, int(w / 80)))

        svg = (
            f'<?xml version="1.0" encoding="UTF-8"?>'
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
            f'width="{w}" height="{h}" preserveAspectRatio="xMidYMid slice">'
            f'<defs>'
            f'<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">'
            f'<stop offset="0" stop-color="{bg}"/>'
            f'<stop offset="1" stop-color="{primary}" stop-opacity="0.55"/>'
            f'</linearGradient>'
            f'<radialGradient id="vignette" cx="0.5" cy="0.5" r="0.7">'
            f'<stop offset="0.4" stop-color="#000000" stop-opacity="0"/>'
            f'<stop offset="1" stop-color="#000000" stop-opacity="0.55"/>'
            f'</radialGradient>'
            f'</defs>'
            f'<rect width="{w}" height="{h}" fill="url(#bg)"/>'
            f'<rect width="{w}" height="{h}" fill="url(#vignette)"/>'
            f'<rect x="{cx - rule_w/2}" y="{rule_y}" width="{rule_w}" height="6" '
            f'rx="3" fill="{accent}"/>'
            f'<text x="{cx}" y="{cy}" text-anchor="middle" '
            f'font-family="Bebas Neue, Montserrat, Inter, sans-serif" '
            f'font-size="{title_size}" font-weight="700" letter-spacing="0.02em" '
            f'fill="{text_color}">{headline_safe}</text>'
            f'<text x="{cx}" y="{cy + title_size * 0.85}" text-anchor="middle" '
            f'font-family="Inter, sans-serif" font-size="{sub_size}" '
            f'letter-spacing="0.22em" text-transform="uppercase" '
            f'fill="{text_secondary}">{subtitle_safe}</text>'
            f'</svg>'
        )
        return svg.encode("utf-8")

    @staticmethod
    def _validate_cutout(image_bytes: bytes) -> bool:
        """True if `image_bytes` is a usable transparent cutout.

        rembg can silently fail (model uncertainty, no clear subject) and
        return a fully-opaque PNG — the original image with no transparency.
        Embedding that into a layout where transparency was promised paints
        a visible white square over the composition. Detect by checking the
        alpha channel histogram: at least 5% of pixels must be transparent
        (alpha < 200) AND at most 95% fully opaque. If the image lacks an
        alpha channel entirely, the cutout obviously failed.
        """
        try:
            from io import BytesIO
            from PIL import Image
            img = Image.open(BytesIO(image_bytes))
            if img.mode not in ("RGBA", "LA"):
                return False
            alpha = img.split()[-1]
            hist = alpha.histogram()  # 256 bins for 8-bit alpha
            total = sum(hist) or 1
            opaque_count = sum(hist[200:256])
            transparent_count = sum(hist[0:50])
            transparent_ratio = transparent_count / total
            opaque_ratio = opaque_count / total
            # Must have at least 5% truly-transparent pixels AND not be 95%+
            # fully opaque. Both checks together cut both "failed cutout"
            # (all opaque) and "garbled cutout" (alpha noise).
            return transparent_ratio >= 0.05 and opaque_ratio <= 0.95
        except Exception:
            return False

    @staticmethod
    def _remove_background(image_bytes: bytes) -> bytes:
        """Remove background from image bytes using rembg, returning transparent PNG.

        Memory optimizations (pod limit ~3Gi):
        - Singleton u2netp session (~4.7MB model, not 176MB u2net)
        - Downscale to 1024px max before inference (reduces ONNX buffers)
        - Serialized via _rembg_lock so only 1 thread runs inference at a time
        - Mask is upscaled back to original resolution for crisp output
        """
        if not REMBG_AVAILABLE:
            print("    ⚠️  rembg not available — skipping background removal")
            return image_bytes
        try:
            from io import BytesIO
            from PIL import Image

            session = _get_rembg_session()
            original_img = Image.open(BytesIO(image_bytes))
            orig_w, orig_h = original_img.size

            # Downscale large images before rembg to save memory
            MAX_DIM = 1024
            if max(orig_w, orig_h) > MAX_DIM:
                scale = MAX_DIM / max(orig_w, orig_h)
                small_w, small_h = int(orig_w * scale), int(orig_h * scale)
                small_img = original_img.resize((small_w, small_h), Image.LANCZOS)
                buf = BytesIO()
                small_img.save(buf, format="PNG")
                input_bytes = buf.getvalue()
                del small_img, buf
            else:
                input_bytes = image_bytes

            # Serialize rembg calls — only one thread runs inference at a time
            # to prevent concurrent ONNX buffer allocation → OOM
            lock = _rembg_lock
            if lock:
                lock.acquire()
            try:
                result_bytes = rembg_remove(input_bytes, session=session)
            finally:
                if lock:
                    lock.release()

            # If we downscaled, extract the alpha mask and apply to original resolution
            result_img = Image.open(BytesIO(result_bytes))
            if result_img.mode != "RGBA":
                result_img = result_img.convert("RGBA")

            if max(orig_w, orig_h) > MAX_DIM:
                # Upscale the alpha mask to original resolution
                alpha_mask = result_img.split()[3]  # extract alpha channel
                alpha_mask = alpha_mask.resize((orig_w, orig_h), Image.LANCZOS)
                # Apply mask to original full-res image
                if original_img.mode != "RGBA":
                    original_img = original_img.convert("RGBA")
                original_img.putalpha(alpha_mask)
                result_img = original_img

            buf = BytesIO()
            result_img.save(buf, format="PNG", optimize=True)
            result_bytes = buf.getvalue()

            # Free references
            del original_img, result_img, buf

            print(f"    ✂️  Background removed ({len(image_bytes)} → {len(result_bytes)} bytes)")
            return result_bytes
        except Exception as e:
            print(f"    ⚠️  Background removal failed (using original): {e}")
            return image_bytes

    def _enhance_image_prompt(self, raw_prompt: str) -> Tuple[str, Dict[str, Any]]:
        """Enhance an image generation prompt with cinematic details (Premium+ tiers).

        Uses a quick LLM call to add lighting, camera angle, color palette, mood,
        and composition details while keeping the prompt under 200 words.
        """
        if not self._tier_config.get("image_prompt_enhancement"):
            return raw_prompt, {}

        # Use LLM-picked IMAGE STYLE, not pipeline visual mode
        image_style = getattr(self, '_current_image_style', 'realistic cinematic photograph')
        topic = getattr(self, '_current_topic', '')

        enhance_prompt = (
            f"Enhance this image generation prompt for a {image_style} educational video"
            f"{' about ' + topic if topic else ''}.\n\n"
            f"Original prompt: \"{raw_prompt}\"\n\n"
            "Add: lighting direction, camera angle, color palette, mood, and "
            "specific compositional details. Keep under 200 words total. "
            "The image must be 16:9 aspect ratio, no text overlays, no faces. "
            "Return the enhanced prompt text ONLY — no quotes, no explanation."
        )
        try:
            enhanced, _usage = self.html_client.chat(
                messages=[
                    {"role": "system", "content": "You enhance image generation prompts with cinematic details. Return enhanced prompt only."},
                    {"role": "user", "content": enhance_prompt},
                ],
                temperature=0.6,
                max_tokens=500,
            )
            enhanced = enhanced.strip().strip('"').strip("'")
            if len(enhanced) > 30:
                return enhanced, _usage or {}
        except Exception as e:
            print(f"    ⚠️ Image prompt enhancement failed: {e}")
        return raw_prompt, {}

    def _rank_pexels_candidates_with_llm(
        self,
        candidates: List[Dict[str, Any]],
        query: str,
        narration_excerpt: str,
        visual_description: str,
    ) -> Tuple[Optional[Dict[str, Any]], Dict[str, Any]]:
        """Score Pexels candidates against the shot's narration via a small LLM call.

        Returns the top-ranked candidate, or None if the ranker fails. Each
        candidate's `alt`, `duration`, and `id` are surfaced to the LLM so it
        can judge semantic fit.
        """
        usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        if not candidates:
            return None, usage
        if len(candidates) == 1:
            return candidates[0], usage

        # Build a compact candidate list for the LLM
        lines = []
        for i, c in enumerate(candidates):
            lines.append(
                f"{i}. id={c.get('id')} | {c.get('duration', 0)}s | "
                f"{(c.get('alt') or '')[:120]}"
            )
        ctx = (
            f"Shot query: {query}\n"
            f"Narration: {narration_excerpt[:200]}\n"
            f"Visual direction: {visual_description[:200]}\n\n"
            "Candidate stock clips:\n" + "\n".join(lines) + "\n\n"
            "Pick the candidate that best matches the narration and visual direction. "
            "Return JSON: {\"best_index\": N, \"reason\": \"short\"}."
        )
        try:
            raw, _usage = self.html_client.chat(
                messages=[
                    {"role": "system", "content": (
                        "You score stock video candidates for a video production pipeline. "
                        "Respond with ONE JSON object and nothing else. No preamble, no code "
                        "fences, no explanation before or after. Start your response with `{`."
                    )},
                    {"role": "user", "content": ctx},
                ],
                temperature=0.3,
                # 200 tokens wasn't enough — some models burn that on a preamble
                # ("Here is the JSON requested:") and truncate before emitting
                # the JSON body. 400 is safely above the observed failure mode.
                max_tokens=400,
                response_format={"type": "json_object"},
            )
            if _usage:
                usage["prompt_tokens"] += _usage.get("prompt_tokens", 0)
                usage["completion_tokens"] += _usage.get("completion_tokens", 0)
                usage["total_tokens"] += _usage.get("total_tokens", 0)

            parsed = _extract_json_blob(raw)
            if isinstance(parsed, dict):
                idx = parsed.get("best_index")
                if isinstance(idx, int) and 0 <= idx < len(candidates):
                    return candidates[idx], usage
        except Exception as e:
            print(f"    ⚠️ Candidate ranker failed ({e}) — falling back to first candidate")
        return candidates[0], usage

    def _process_stock_videos(self, html_segments: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """Scan HTML for <video data-video-query='...'> tags, search Pexels, inject URLs.

        When `stock_video_ranking` is enabled (super_ultra), fetches 5-6 candidates,
        dedupes against `self._used_pexels_video_ids`, and picks the best match via
        a tiny LLM scoring call. Otherwise uses the legacy first-match path.

        Always strips internal shot-context fields before returning, even on the
        Pexels-unavailable early-return path, so the timeline JSON stays clean.
        """
        total_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

        def _strip_internal_fields() -> None:
            # Strip only fields the timeline JSON consumers don't need:
            #   _skill_audio_events → consumed by the Sound Planner inside this run
            #   _validator_record   → animation-validator telemetry (pre/post issues,
            #                         shipped='regen'|'original'); useful for log
            #                         aggregation, not for playback.
            # Keep:
            #   _shot_type, _narration_excerpt, _visual_description → small
            #   (≤300 bytes/entry), used by the frame-regen LLM as run-context.
            #   Without these, regen produces shots that drift stylistically from
            #   the rest of the timeline (AI_VIDEO_GENERATION.md §12.3 — closed).
            for entry in html_segments:
                entry.pop("_skill_audio_events", None)
                entry.pop("_validator_record", None)

        pexels_ok = self._pexels_service and self._pexels_service.is_available
        pixabay_ok = self._pixabay_service and self._pixabay_service.is_available
        if not pexels_ok and not pixabay_ok:
            _strip_internal_fields()
            return html_segments, total_usage

        orientation = "portrait" if getattr(self, 'video_width', 1920) < getattr(self, 'video_height', 1080) else "landscape"
        VIDEO_TAG_RE = re.compile(r'(<video[^>]+data-video-query=(["\'])(.*?)\2[^>]*>)', re.DOTALL)
        replacements_count = 0
        use_ranking = bool(self._tier_config.get("stock_video_ranking"))
        used_ids: set = getattr(self, "_used_pexels_video_ids", None) or set()

        for entry in html_segments:
            html = entry.get("html", "")
            if "data-video-query" not in html:
                continue

            shot_narration = entry.get("_narration_excerpt", "")
            shot_visual = entry.get("_visual_description", "")

            for match in VIDEO_TAG_RE.finditer(html):
                full_tag = match.group(1)
                query = match.group(3)

                provider_match = re.search(r'data-stock-provider=["\'](\w+)["\']', full_tag)
                provider_hint = provider_match.group(1).lower() if provider_match else ""
                services = self._resolve_stock_provider_chain(provider_hint, query)

                picked: Optional[Dict[str, Any]] = None
                picked_provider = ""
                for svc in services:
                    provider_name = type(svc).__name__.replace("Service", "")
                    if use_ranking:
                        candidates = svc.search_video_candidates(
                            query, orientation=orientation, per_page=6
                        )
                        fresh = [c for c in candidates if c.get("id") not in used_ids]
                        pool = fresh if fresh else candidates
                        if pool:
                            picked, stock_usage = self._rank_pexels_candidates_with_llm(
                                candidates=pool,
                                query=query,
                                narration_excerpt=shot_narration,
                                visual_description=shot_visual,
                            )
                            total_usage["prompt_tokens"] += stock_usage.get("prompt_tokens", 0)
                            total_usage["completion_tokens"] += stock_usage.get("completion_tokens", 0)
                            total_usage["total_tokens"] += stock_usage.get("total_tokens", 0)
                            if picked and picked.get("id") is not None:
                                used_ids.add(picked["id"])
                    else:
                        picked = svc.search_videos(query, orientation=orientation)

                    if picked:
                        picked_provider = provider_name
                        break

                if not picked:
                    print(f"    ⚠️ No stock video for: {query[:50]}")
                    continue
                print(f"    🎬 Stock video ({picked_provider}): {query[:60]}...")

                video_url = picked.get("url", "")
                if not video_url:
                    continue
                poster_url = picked.get("image", "")

                # Build enriched tag with src, poster, and playback attributes
                new_tag = full_tag
                if 'src=' not in new_tag:
                    new_tag = new_tag.replace('>', f' src="{video_url}">', 1)
                else:
                    new_tag = re.sub(r'src=["\'][^"\']*["\']', f'src="{video_url}"', new_tag)
                if poster_url and 'poster=' not in new_tag:
                    new_tag = new_tag.replace('>', f' poster="{poster_url}">', 1)
                for attr in ['autoplay', 'muted', 'loop', 'playsinline']:
                    if attr not in new_tag:
                        new_tag = new_tag.replace('>', f' {attr}>', 1)

                html = html.replace(full_tag, new_tag)
                replacements_count += 1
                rank_tag = " [ranked]" if use_ranking else ""
                print(f"    🎬 Stock video{rank_tag}: {query[:40]}... → {video_url[:60]}...")

            entry["html"] = html

        # Strip the shot-context fields from every entry so timeline JSON stays clean.
        for entry in html_segments:
            for k in ("_shot_type", "_narration_excerpt", "_visual_description",
                      "_skill_audio_events"):
                entry.pop(k, None)

        # Persist updated used-id set
        self._used_pexels_video_ids = used_ids

        if replacements_count > 0:
            print(f"    📝 Applied {replacements_count} stock video replacement(s)")
        return html_segments, total_usage

    def _process_generated_images(self, html_segments: List[Dict[str, Any]], run_dir: Path) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """
        Scan generated HTML for <img data-img-prompt="..."> tags, generate images via Gemini,
        save them to disk, and update the src attribute.
        """
        images_dir = run_dir / "generated_images"
        images_dir.mkdir(parents=True, exist_ok=True)

        # Image generation runs through OpenRouter — requires the same key the rest
        # of the pipeline already uses.
        if not getattr(self.script_client, "api_key", None):
            print("    ⚠️  No OpenRouter API key configured. Skipping image generation.")
            return html_segments, {}
        
        # We'll use a ThreadPoolExecutor to generate images in parallel
        # First, gather all image requests
        tasks = []
        total_html_segments = len(html_segments)
        segments_with_images = 0
        
        for seg_idx, entry in enumerate(html_segments):
            html = entry.get("html", "")
            if "data-img-prompt" not in html:
                continue
            
            segments_with_images += 1
            # Regex to find all such tags
            # We capture: entire tag, quote style, prompt, rest of tag
            matches = list(re.finditer(r'(<img[^>]+data-img-prompt=(["\'])(.*?)\2[^>]*>)', html))
            # Word-boundary regex — avoids false positives like "photograph" → "graph"
            # or "notable" → "table", "architectural" → "chart"
            _SVG_KW_RE = re.compile(
                r'\b(diagram|flowchart|bar chart|pie chart|line chart|infographic|'
                r'comparison chart|data table|workflow|process flow|timeline diagram|'
                r'schematic|blueprint|concept map|mind map|venn diagram)\b',
                re.IGNORECASE,
            )
            for match in matches:
                full_tag = match.group(1)
                prompt = match.group(3)
                if _SVG_KW_RE.search(prompt):
                    print(f"    ⚠️  Skipping image gen (SVG candidate): {prompt[:70]}...")
                    continue
                is_cutout = 'data-cutout="true"' in full_tag or "data-cutout='true'" in full_tag
                img_source = "generate"  # default for backwards compat
                source_match = re.search(r'data-img-source=["\'](\w+)["\']', full_tag)
                if source_match:
                    img_source = source_match.group(1).lower()
                provider_match = re.search(r'data-stock-provider=["\'](\w+)["\']', full_tag)
                stock_provider = provider_match.group(1).lower() if provider_match else ""
                # Subject continuity (ultra+): if the Director plan flagged this
                # shot as part of a recurring subject, attach the subject_id to
                # the task so the worker thread can pass `reference_image_url`
                # to Seedream after the FIRST shot of that subject lands.
                _subject_id = (
                    getattr(self, "_subject_id_for_shot", {}) or {}
                ).get(seg_idx)
                # Also probe a per-img tag override (`data-subject-id="..."`)
                # in case the Director embedded one directly in the HTML.
                _sid_match = re.search(r'data-subject-id=["\']([^"\']+)["\']', full_tag)
                if _sid_match:
                    _subject_id = _sid_match.group(1).strip() or _subject_id
                tasks.append({
                    "entry": entry,
                    "full_tag": full_tag,
                    "prompt": prompt,
                    "seg_idx": seg_idx,
                    "is_cutout": is_cutout,
                    "img_source": img_source,
                    "stock_provider": stock_provider,
                    "subject_id": _subject_id,
                    "timestamp": datetime.now().strftime("%f")  # basic uniqueness
                })

        if not tasks:
            print(f"    ℹ️  No image tags found in HTML segments (checked {total_html_segments} segments, {segments_with_images} had 'data-img-prompt' attribute).")
            print(f"    ℹ️  The LLM may not have generated image tags. Check HTML generation prompt includes image instructions.")
            return html_segments, {}

        print(f"    Found {len(tasks)} images to generate from {segments_with_images} segments.")

        # IMAGE_WORKERS: 4 concurrent Gemini calls.  Higher than the old hard-coded 2,
        # but conservative enough not to saturate free-tier quotas.
        IMAGE_WORKERS = 4
        # Max times we'll requeue a single task that gets a 429.
        MAX_REQUEUE = 2

        def process_image_task(task):
            """
            Generate one image and return a result dict.
            Raises _ImageGenRateLimitError on 429 so the executor thread is freed
            immediately — the caller handles sleep + requeue in the main thread.
            """
            img_source = task.get("img_source", "generate")

            # stock_only tier: treat every img_source=="generate" as "stock" — never
            # call the AI image generator. If stock search also fails, the tag stays
            # as-is and the CSS gradient background (written by the LLM) shows instead.
            _stock_only = self._tier_config.get("stock_preference") == "stock_only"
            if _stock_only and img_source == "generate":
                img_source = "stock"

            # Stock photo path: try configured providers in order (hint + fallback)
            # before falling through to AI generation.
            if img_source == "stock":
                orientation = "portrait" if getattr(self, 'video_width', 1920) < getattr(self, 'video_height', 1080) else "landscape"
                services = self._resolve_stock_provider_chain(task.get("stock_provider", ""), task["prompt"])
                for svc in services:
                    provider_name = type(svc).__name__.replace("Service", "")
                    result = svc.search_photos(task["prompt"], orientation=orientation)
                    if result:
                        print(f"    📷 Stock photo ({provider_name}) for seg={task.get('seg_idx', '?')}: {task['prompt'][:60]}...")
                        return {
                            "entry": task.get("entry"),
                            "entry_id": id(task.get("entry")),
                            "full_tag": task.get("full_tag", ""),
                            "stock_url": result.get("url", ""),
                            "image_bytes": None,
                            "filename": None,
                            "usage": {},
                        }
                if services:
                    print(f"    ⚠️  All stock providers failed, falling back to Seedream: {task['prompt'][:50]}...")

            prompt     = task["prompt"]
            idx        = task["seg_idx"]
            is_cutout  = task.get("is_cutout", False)

            if is_cutout:
                # Cutout assets need clean isolated objects — skip cinematic style
                # prefix and LLM enhancement which would add backgrounds/scenes
                enhance_usage = {}
                pass
            else:
                # Enhance image prompt with cinematic details (Premium+ tiers)
                prompt, enhance_usage = self._enhance_image_prompt(prompt)

                # Use LLM-picked IMAGE STYLE, not pipeline visual mode
                image_style = getattr(self, '_current_image_style', 'realistic cinematic photograph')
                if image_style.lower() not in prompt.lower():
                    prompt = f"{image_style}, {prompt}"

            # Subject continuity (ultra+): if this shot is part of a recurring
            # subject AND a reference URL has already been cached from an
            # earlier shot of the same subject, pass it as `reference_image_url`
            # so Seedream conditions on the cached image. Without that, the
            # subject would visually drift across shots.
            #
            # First-shot ordering: tasks are appended in shot-index order so
            # the first shot of each subject naturally enters the executor
            # first. We use a per-subject `threading.Event` to make any
            # SUBSEQUENT task block until the first finishes and uploads.
            _sub_id = task.get("subject_id")
            _ref_url: Optional[str] = None
            _is_first_for_subject = False
            if _sub_id and getattr(self, "_subject_meta_lock", None) is not None:
                with self._subject_meta_lock:
                    _ref_url = (self._subject_refs or {}).get(_sub_id)
                    if not _ref_url and _sub_id not in self._subject_first_claimed:
                        # Claim the first-task slot for this subject.
                        import threading as _t_subj
                        self._subject_first_claimed.add(_sub_id)
                        self._subject_ready_events[_sub_id] = _t_subj.Event()
                        _is_first_for_subject = True
                if (not _ref_url) and (not _is_first_for_subject):
                    # Some other task has the first-shot slot — wait for it.
                    event = self._subject_ready_events.get(_sub_id)
                    if event and event.wait(timeout=120):
                        _ref_url = (self._subject_refs or {}).get(_sub_id)

            label = f"seg={idx}" + (" (cutout)" if is_cutout else "")
            if _sub_id:
                label += f" [subject:{_sub_id}{'/first' if _is_first_for_subject else '/ref' if _ref_url else '/no-ref'}]"
            print(f"    🎨 Generating image {label}: {prompt[:60]}...")
            # May raise _ImageGenRateLimitError — propagates to as_completed caller.
            # Subject continuity: if THIS is the first task for a subject, we
            # MUST set the subject's ready-event before any path that exits this
            # function, otherwise subsequent tasks (and the requeued retry of
            # this same task) would deadlock on event.wait until the 120s
            # timeout. Set the event in the 429 path so the requeued task can
            # re-claim or proceed without a reference.
            try:
                image_bytes, usage_meta = self._call_image_generation_llm(
                    prompt, reference_image_url=_ref_url
                )
            except _ImageGenRateLimitError:
                if _is_first_for_subject and _sub_id:
                    # Release the first-task claim so the requeued retry (or a
                    # different subject member) can take it next time.
                    if getattr(self, "_subject_meta_lock", None):
                        with self._subject_meta_lock:
                            self._subject_first_claimed.discard(_sub_id)
                    event = (self._subject_ready_events or {}).get(_sub_id)
                    if event:
                        event.set()
                raise
            except Exception:
                if _is_first_for_subject and _sub_id:
                    event = (self._subject_ready_events or {}).get(_sub_id)
                    if event:
                        event.set()
                raise
            if not usage_meta: usage_meta = {}
            for k, v in enhance_usage.items():
                if k in ["prompt_tokens", "completion_tokens", "total_tokens"]:
                    usage_meta[k] = usage_meta.get(k, 0) + v
            if not image_bytes:
                print(f"    ❌ No image bytes for: {prompt[:50]}...")
                # Subject continuity: unblock waiters before we cascade so they
                # don't stall the full 120s. Subsequent shots proceed text-only.
                if _is_first_for_subject and _sub_id:
                    event = (self._subject_ready_events or {}).get(_sub_id)
                    if event:
                        event.set()

                # Cascade through Pexels/Pixabay → SVG placeholder so the
                # `<img>` tag isn't left pointing at the LLM's `placeholder.png`.
                fb = self._image_fallback_chain(prompt, is_cutout=is_cutout)
                if fb:
                    return {
                        "entry_id":   id(task["entry"]),
                        "full_tag":   task["full_tag"],
                        "stock_url":  fb.get("stock_url"),
                        "image_bytes": fb.get("image_bytes"),
                        "is_svg":     fb.get("is_svg", False),
                        "filename":   None,
                        "usage":      usage_meta,
                    }
                return None

            # Remove background for cutout assets, then VALIDATE the result.
            # rembg silently returns a fully-opaque image when it can't find a
            # subject; embedding that paints a white square over the layout.
            cutout_failed = False
            if is_cutout:
                image_bytes = self._remove_background(image_bytes)
                if not self._validate_cutout(image_bytes):
                    cutout_failed = True
                    print(
                        f"    ⚠️  Cutout validation failed (no transparency) "
                        f"— hiding image element: {prompt[:60]}"
                    )

            # Subject continuity: this is the FIRST successful shot for the
            # subject — upload the image to S3 and cache the URL so subsequent
            # shots of the same subject can use it as `reference_image_url`.
            # Failures are non-fatal (logged inside the helper). We still
            # upload even when cutout validation failed: the original bytes
            # are useful as an i2i reference even though they're not a clean
            # cutout for layout use.
            if _is_first_for_subject and _sub_id:
                try:
                    uploaded_url = self._upload_subject_reference(
                        image_bytes, _sub_id, run_dir,
                    )
                    if uploaded_url and getattr(self, "_subject_meta_lock", None):
                        with self._subject_meta_lock:
                            self._subject_refs[_sub_id] = uploaded_url
                finally:
                    event = (self._subject_ready_events or {}).get(_sub_id)
                    if event:
                        event.set()

            # Save to disk for audit/debug (non-blocking write; bytes already in memory)
            filename = f"img_{idx}_{abs(hash(prompt))}.png"
            try:
                (images_dir / filename).write_bytes(image_bytes)
            except Exception as e:
                print(f"    ⚠️  Could not save image to disk (non-fatal): {e}")

            # Return raw bytes — no disk re-read needed for base64 embedding
            print(f"    ✅ Image generated: {filename} ({len(image_bytes)} bytes)")
            return {
                "entry_id":   id(task["entry"]),
                "full_tag":   task["full_tag"],
                "image_bytes": image_bytes,       # pass bytes directly — no re-read
                "filename":   filename,
                "usage":      usage_meta,
                "cutout_failed": cutout_failed,
            }

        replacements      = {}
        successful_generations = 0
        failed_generations     = 0
        total_image_usage = {"prompt_tokens": 0, "completion_tokens": 0,
                              "total_tokens": 0, "image_count": 0, "stock_count": 0}

        # requeue_counts tracks how many times a task has been re-submitted after 429
        requeue_counts: Dict[int, int] = {i: 0 for i in range(len(tasks))}

        with concurrent.futures.ThreadPoolExecutor(max_workers=IMAGE_WORKERS) as executor:
            # Map future → (task, task_index) so we can requeue on 429
            pending: Dict[concurrent.futures.Future, Tuple[Dict, int]] = {
                executor.submit(process_image_task, t): (t, i)
                for i, t in enumerate(tasks)
            }

            while pending:
                done, _ = concurrent.futures.wait(
                    pending, return_when=concurrent.futures.FIRST_COMPLETED
                )
                for future in done:
                    task, task_idx = pending.pop(future)
                    try:
                        res = future.result()
                    except _ImageGenRateLimitError as rl_err:
                        # 429 — thread was freed immediately; sleep in main thread
                        if requeue_counts[task_idx] < MAX_REQUEUE:
                            requeue_counts[task_idx] += 1
                            wait = min(rl_err.retry_after, 60.0)
                            print(f"    ⏳ Rate-limited — sleeping {wait:.0f}s in main thread "
                                  f"then requeuing (attempt {requeue_counts[task_idx]}/{MAX_REQUEUE})...")
                            time.sleep(wait)
                            new_future = executor.submit(process_image_task, task)
                            pending[new_future] = (task, task_idx)
                        else:
                            print(f"    ❌ Giving up on image after {MAX_REQUEUE} rate-limit requeues: "
                                  f"{task['prompt'][:50]}...")
                            failed_generations += 1
                        continue
                    except Exception as exc:
                        print(f"    ❌ Image task raised unexpected error: {exc}")
                        failed_generations += 1
                        continue

                    if res:
                        successful_generations += 1
                        if res.get("stock_url"):
                            total_image_usage["stock_count"] += 1
                        else:
                            total_image_usage["image_count"] += 1
                        u = res.get("usage") or {}
                        total_image_usage["prompt_tokens"]      += u.get("promptTokenCount", 0)
                        total_image_usage["completion_tokens"]  += u.get("candidatesTokenCount", 0)
                        total_image_usage["total_tokens"]       += u.get("totalTokenCount", 0)
                        entry_id = res["entry_id"]
                        replacements.setdefault(entry_id, []).append(res)
                    else:
                        failed_generations += 1

        print(f"    📊 Image generation: {successful_generations} OK, "
              f"{failed_generations} failed out of {len(tasks)} total")

        if successful_generations == 0:
            print("    ⚠️  No images generated. HTML will retain placeholder images.")
            return html_segments, total_image_usage

        # Apply replacements — base64-encode from in-memory bytes (no disk re-read)
        replacements_applied = 0
        for entry in html_segments:
            entry_id     = id(entry)
            html         = entry.get("html", "")
            original_html = html

            if entry_id not in replacements:
                continue

            for rep in replacements[entry_id]:
                old_tag     = rep["full_tag"]

                # Cutout failure handling: the cutout had no real transparency
                # (rembg silently failed). Embedding the white-background bytes
                # would paint a white square over the layout. Replace the
                # `<img>` with a hidden div instead so adjacent flexbox /
                # absolute layout doesn't shift; the rest of the shot composes
                # without the cutout.
                if rep.get("cutout_failed"):
                    placeholder = (
                        '<div data-cutout-failed="true" '
                        'style="display:none" aria-hidden="true"></div>'
                    )
                    if old_tag in html:
                        html = html.replace(old_tag, placeholder)
                        replacements_applied += 1
                        print(
                            f"    🚫 Cutout failed — hid image element for entry {entry_id}: "
                            f"{old_tag[:50]}..."
                        )
                    else:
                        pm = re.search(r'data-img-prompt=(["\'])(.*?)\1', old_tag)
                        if pm:
                            pv = pm.group(2)
                            pat = rf'<img[^>]+data-img-prompt=(["\']){re.escape(pv)}\1[^>]*>'
                            html = re.sub(pat, placeholder, html)
                            replacements_applied += 1
                            print(f"    🚫 Cutout failed (prompt match) — hid image: {pv[:30]}...")
                    continue

                # Stock photos:    use CDN URL directly.
                # SVG placeholders: keep as base64 data URI (tiny, no S3 round-trip).
                # Generated PNGs:   emit local filename so the post-upload URL
                #                   swap in video_generation_service.py rewrites
                #                   it to the public S3 URL. Eliminates the
                #                   timeline-JSON bloat that was causing
                #                   audio/visual drift on long videos.
                # No filename:      last-resort base64 fallback (in-memory only paths).
                if rep.get("stock_url"):
                    new_src = rep["stock_url"]
                    src_kind = "stock-url"
                elif rep.get("is_svg"):
                    b64     = base64.b64encode(rep["image_bytes"]).decode("utf-8")
                    new_src = f"data:image/svg+xml;base64,{b64}"
                    src_kind = "svg-base64"
                elif rep.get("filename"):
                    new_src = rep["filename"]
                    src_kind = "S3-deferred"
                else:
                    b64     = base64.b64encode(rep["image_bytes"]).decode("utf-8")
                    new_src = f"data:image/png;base64,{b64}"
                    src_kind = "base64-fallback"

                # Strategy 1: direct tag replacement
                if old_tag in html:
                    new_tag = re.sub(r'src=["\'][^"\']*["\']', f'src="{new_src}"', old_tag)
                    html = html.replace(old_tag, new_tag)
                    replacements_applied += 1
                    print(f"    ✅ {src_kind} image for entry {entry_id}: {old_tag[:50]}...")
                else:
                    # Strategy 2: match by data-img-prompt value
                    pm = re.search(r'data-img-prompt=(["\'])(.*?)\1', old_tag)
                    if pm:
                        pv  = pm.group(2)
                        pat = rf'<img[^>]+data-img-prompt=(["\']){re.escape(pv)}\1[^>]*>'
                        for m in re.finditer(pat, html):
                            mt      = m.group(0)
                            new_tag = re.sub(r'src=["\'][^"\']*["\']', f'src="{new_src}"', mt)
                            html    = html.replace(mt, new_tag)
                            replacements_applied += 1
                            print(f"    ✅ {src_kind} image (prompt match): {pv[:30]}...")

            if html != original_html:
                entry["html"] = html

        print(f"    📝 Applied {replacements_applied} image replacements")
        return html_segments, total_image_usage

    def _upload_subject_reference(
        self,
        image_bytes: bytes,
        subject_id: str,
        run_dir: Path,
    ) -> Optional[str]:
        """Upload a generated subject-reference image to S3 and return its public URL.

        Used by the image-continuity flow: when the FIRST shot of a recurring
        subject lands, we upload that image so subsequent shots can pass its
        URL as `reference_image_url` to Seedream (image-to-image continuity).

        Returns the public URL on success, None on failure. Failure is non-fatal
        — the subject just doesn't get continuity for the rest of the run.
        """
        import os as _os_subj
        import re as _re_subj
        try:
            import boto3 as _boto3_subj
        except Exception as _imp_err:
            print(f"    ⚠️ subject_ref upload skipped (boto3 unavailable): {_imp_err}")
            return None

        # Sanitize subject_id for use in an S3 key.
        safe_sid = _re_subj.sub(r"[^A-Za-z0-9_-]", "_", subject_id)[:64] or "subject"
        run_id = run_dir.name or "run"
        bucket = "vacademy-media-storage-public"
        key = f"SUBJECT_REFS/{run_id}/{safe_sid}.png"

        try:
            client = _boto3_subj.client(
                "s3",
                aws_access_key_id=_os_subj.environ.get("AWS_ACCESS_KEY_ID") or None,
                aws_secret_access_key=_os_subj.environ.get("AWS_SECRET_ACCESS_KEY") or None,
                region_name=_os_subj.environ.get("AWS_REGION", "ap-south-1"),
            )
            client.put_object(
                Bucket=bucket,
                Key=key,
                Body=image_bytes,
                ContentType="image/png",
                ACL="public-read",
            )
        except Exception as _up_err:
            print(f"    ⚠️ subject_ref S3 upload failed for '{subject_id}': {_up_err}")
            return None

        url = f"https://{bucket}.s3.amazonaws.com/{key}"
        print(f"    🎯 Cached reference for subject '{subject_id}': {url}")
        return url

    def _call_image_generation_llm(
        self,
        prompt: str,
        width: Optional[int] = None,
        height: Optional[int] = None,
        reference_image_url: Optional[str] = None,
    ) -> Tuple[Optional[bytes], Optional[Dict[str, Any]]]:
        """Generate image via OpenRouter (bytedance-seed/seedream-4.5).

        Returns (image_bytes, usage_metadata). 429 raises _ImageGenRateLimitError
        so the executor thread is freed and the main thread handles requeue.
        5xx/network errors retry with jittered backoff.

        When `reference_image_url` is provided, the call uses the multimodal
        content-array shape (text part + image_url part) so Seedream can do
        image-to-image conditioning — used by the subject continuity flow to
        keep recurring characters/products visually consistent across shots.
        """
        import random as _random
        import traceback as _tb

        width = width or getattr(self, 'video_width', 1920)
        height = height or getattr(self, 'video_height', 1080)

        api_key = getattr(self.script_client, "api_key", None)
        if not api_key:
            print(f"    ⚠️ No OpenRouter API key for image gen. Cannot generate: {prompt[:50]}...")
            return None, None

        # Seedream doesn't accept a structured aspect-ratio param — hint textually.
        if width < height:
            aspect_hint = "9:16 vertical framing"
        elif width > height:
            aspect_hint = "16:9 widescreen framing"
        else:
            aspect_hint = "1:1 square framing"
        full_prompt = f"{prompt}\n\n({aspect_hint})"

        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://stilllift-automation.local",
            "X-Title": "StillLift Automation",
        }

        # Two payload shapes:
        #   - text-only (default): `content` is a plain string.
        #   - multimodal (image-to-image): `content` is an array of parts,
        #     including a single `image_url` part referencing the subject's
        #     prior generated image. Seedream uses it as the visual reference
        #     so the subject (character, product, etc.) looks consistent.
        if reference_image_url:
            i2i_prompt = (
                f"{full_prompt}\n\nReference: match the subject's identity, "
                f"colors, and proportions from the attached image. Same subject, "
                f"new pose / angle / context as described."
            )
            content: Any = [
                {"type": "text", "text": i2i_prompt},
                {"type": "image_url", "image_url": {"url": reference_image_url}},
            ]
        else:
            content = full_prompt

        payload = {
            "model": "bytedance-seed/seedream-4.5",
            "messages": [{"role": "user", "content": content}],
            "modalities": ["image"],
        }

        max_retries = 3
        for attempt in range(max_retries):
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=180) as response:
                    data = json.loads(response.read().decode("utf-8"))

                usage_metadata = data.get("usage", {}) or {}

                choices = data.get("choices") or []
                if choices:
                    message = choices[0].get("message", {}) or {}
                    for image in message.get("images", []) or []:
                        image_url = (image.get("image_url") or {}).get("url", "")
                        if not image_url:
                            continue
                        # Data URL form: "data:image/png;base64,<payload>"
                        if "," in image_url:
                            b64 = image_url.split(",", 1)[1]
                        else:
                            b64 = image_url
                        try:
                            return base64.b64decode(b64), usage_metadata
                        except (ValueError, base64.binascii.Error) as e:
                            print(f"    ⚠️  Could not decode image from Seedream response: {e}")
                            return None, None

                print(f"    ⚠️  Seedream response had no image payload for '{prompt[:50]}...'")
                return None, None

            except urllib.error.HTTPError as e:
                if e.code == 429:
                    retry_after = 15.0
                    raw_hdr = e.headers.get("Retry-After")
                    if raw_hdr:
                        try:
                            retry_after = float(raw_hdr) + 1
                        except ValueError:
                            pass
                    print(f"    ⚠️  Seedream 429 for '{prompt[:40]}...' — signalling rate-limit "
                          f"(retry-after {retry_after:.0f}s)")
                    raise _ImageGenRateLimitError(retry_after)

                if e.code >= 500:
                    if attempt < max_retries - 1:
                        wait = (2.0 ** attempt) * _random.uniform(0.8, 1.4)
                        print(f"    ⚠️  Seedream HTTP {e.code} (attempt {attempt+1}/{max_retries}) "
                              f"for '{prompt[:40]}...'. Retrying in {wait:.1f}s...")
                        time.sleep(wait)
                        continue
                print(f"    ❌ Seedream image HTTP {e.code} for '{prompt[:50]}...': {e}")
                return None, None

            except Exception as e:
                if attempt < max_retries - 1:
                    wait = (1.5 ** attempt) * _random.uniform(0.5, 1.5)
                    print(f"    ⚠️  Seedream image attempt {attempt+1}/{max_retries} failed "
                          f"for '{prompt[:40]}...': {e}. Retrying in {wait:.1f}s...")
                    print(f"    📋 {_tb.format_exc()[:200]}")
                    time.sleep(wait)
                    continue
                print(f"    ❌ Seedream image failed after {max_retries} attempts: "
                      f"{_tb.format_exc()[:400]}")
                return None, None

        return None, None

    def _generate_avatar_runpod(self, run_dir: Path) -> Optional[Path]:
        if not self._current_avatar_image_url:
            print("⚠️ No avatar image URL provided, using default teacher image.")
            import sys
            import logging
            from pathlib import Path
            logger = logging.getLogger(__name__)
            
            app_dir = Path(__file__).parent.parent
            if str(app_dir.parent) not in sys.path:
                sys.path.insert(0, str(app_dir.parent))
                
            from app.services.s3_service import S3Service
            s3_service = S3Service()
            default_teacher_path = app_dir / "assets" / "default_teacher.png"
            video_id = run_dir.name
            
            if default_teacher_path.exists():
                print("📤 Uploading default teacher image to S3 for RunPod access...")
                try:
                    s3_url = s3_service.upload_video_file(
                        file_path=default_teacher_path,
                        video_id=video_id,
                        stage="avatar_input" # Save it under an avatar_input folder
                    )
                    if s3_url:
                        self._current_avatar_image_url = s3_url
                        print(f"✅ Default teacher image uploaded: {s3_url}")
                    else:
                        print("⚠️ Failed to upload default teacher image, avatar generation may fail.")
                except Exception as e:
                    print(f"⚠️ Exception uploading default teacher: {e}")
            else:
                print(f"⚠️ Default teacher image not found at {default_teacher_path}. Ensure it exists or provide avatar_image_url.")
        print(f"👤 Generating Avatar Video via RunPod with image: {self._current_avatar_image_url}")
        
        audio_url_file = run_dir / "audio_s3_url.txt"
        if not audio_url_file.exists():
            print("⚠️ audio_s3_url.txt not found. Avatar generation requires a public S3 URL for the audio.")
            return None
            
        audio_s3_url = audio_url_file.read_text().strip()
        if not audio_s3_url:
            print("⚠️ audio_s3_url.txt is empty.")
            return None
            
        try:
            # Import dynamically to avoid path issues
            import sys
            import logging
            from pathlib import Path
            logger = logging.getLogger(__name__)
            # Ensure the app dir is in path
            app_dir = Path(__file__).parent.parent
            if str(app_dir.parent) not in sys.path:
                sys.path.insert(0, str(app_dir.parent))
            
            from app.services.avatar_service import get_avatar_provider
            from app.config import get_settings
            
            settings = get_settings()
            
            # The config now has runpod api key
            if not settings.runpod_api_key or not settings.runpod_endpoint_id:
                print("⚠️ RunPod API key or Endpoint ID not configured in settings. Skipping avatar generation gracefully and proceeding without breaking the pipeline.")
                return None
                
            provider = get_avatar_provider(
                provider="runpod",
                api_key=settings.runpod_api_key,
                endpoint_id=settings.runpod_endpoint_id
            )

            # Submit the job and return immediately. The caller (video_generation_service)
            # will poll RunPod asynchronously via asyncio.sleep() so the thread is freed.
            runpod_job_id = provider.submit(
                image_url=self._current_avatar_image_url,
                audio_url=audio_s3_url
            )
            (run_dir / "runpod_job_id.txt").write_text(runpod_job_id)
            print(f"✅ RunPod avatar job submitted: {runpod_job_id} — polling will happen async")
            return None

        except Exception as e:
            print(f"❌ RunPod avatar submission failed: {e}")
            import traceback
            traceback.print_exc()
            return None

    def _generate_avatar(self, audio_path: Path, run_dir: Path, opts: Dict[str, Any]) -> Optional[Path]:
        avatar_opts = opts.get("avatar", {})
        if not avatar_opts.get("enabled", False):
            return None
        
        print("👤 Generating Avatar Video with EchoMimic...")
        
        # Paths
        echomimic_root = Path(avatar_opts.get("echomimic_path", "EchoMimic")).expanduser().resolve()
        source_image_path = Path(avatar_opts.get("source_image", "")).expanduser().resolve()
        
        if not echomimic_root.exists():
            print(f"⚠️ EchoMimic not found at {echomimic_root}. Please clone it: git clone https://github.com/BadToBest/EchoMimic")
            return None
            
        if not source_image_path.exists():
            print(f"⚠️ Avatar source image not found at {source_image_path}")
            return None
            
        # Update EchoMimic Config (configs/prompts/animation.yaml)
        config_path = echomimic_root / "configs" / "prompts" / "animation.yaml"
        if not config_path.parent.exists():
            # Attempt to creating directories if they don't exist, though usually they should.
            try:
                config_path.parent.mkdir(parents=True, exist_ok=True)
            except Exception as e:
                print(f"⚠️ Could not create config directory {config_path.parent}: {e}")

        print(f"    📝 Updating config: {config_path}")
        # We manually construct YAML to avoid dependency on PyYAML
        # Ensure paths are strings and safely quoted
        yaml_content = (
            "test_cases:\n"
            f'  "{str(source_image_path)}":\n'
            f'    - "{str(audio_path)}"\n'
        )
        
        try:
            config_path.write_text(yaml_content, encoding='utf-8')
        except Exception as e:
            print(f"    ❌ Failed to write config: {e}")
            return None
            
        # Run Inference
        # Command: python -u infer_audio2vid.py
        # Use the dedicated virtual environment for EchoMimic
        echomimic_venv_python = REPO_ROOT / ".venv_echomimic" / "bin" / "python"
        if not echomimic_venv_python.exists():
             print(f"    ⚠️ .venv_echomimic not found at {echomimic_venv_python}, trying default sys.executable")
             echomimic_python = sys.executable
        else:
             echomimic_python = str(echomimic_venv_python)

        cmd = [echomimic_python, "-u", "infer_audio2vid.py"]
        
        # Environment
        env = os.environ.copy()
        # Pass FFMPEG_PATH if provided in options or environment
        ffmpeg_path = avatar_opts.get("ffmpeg_path") or env.get("FFMPEG_PATH")
        if ffmpeg_path:
            env["FFMPEG_PATH"] = ffmpeg_path
            
        print(f"    🚀 Running EchoMimic inference in {echomimic_root} with {echomimic_python}...")
        try:
            # We must run in the EchoMimic directory so it finds its relative imports/configs
            subprocess.run(cmd, cwd=echomimic_root, env=env, check=True)
        except subprocess.CalledProcessError as e:
            print(f"    ❌ EchoMimic inference failed: {e}")
            print("    (Ensure requirements.txt is installed and weights are downloaded)")
            return None
            
        # Locate Output
        # EchoMimic saves to ./output directory by default
        output_dir = echomimic_root / "output"
        if not output_dir.exists():
             print(f"    ⚠️ Output directory not found: {output_dir}")
             return None
             
        # Find the most recently created .mp4 file
        try:
            generated_videos = list(output_dir.glob("**/*.mp4"))
            if not generated_videos:
                print("    ⚠️ No .mp4 found in output directory.")
                return None
                
            generated_videos.sort(key=lambda p: p.stat().st_mtime, reverse=True)
            latest_video = generated_videos[0]
            
            # Copy to run directory
            final_path = run_dir / "avatar_video.mp4"
            import shutil
            shutil.copy2(latest_video, final_path)
            print(f"    ✅ Avatar video saved to: {final_path}")
            return final_path
            
        except Exception as e:
            print(f"    ❌ Error recovering output video: {e}")
            return None
            


    # --- Timeline + video -------------------------------------------------
    def _write_timeline(
        self,
        html_segments: List[Dict[str, Any]],
        run_dir: Path,
        branding_config: Optional[Dict[str, Any]] = None,
        content_type: str = "VIDEO",
        chapters: Optional[List[Dict[str, Any]]] = None,
        glossary: Optional[List[Dict[str, Any]]] = None,
        questions: Optional[List[Dict[str, Any]]] = None,
        language: str = "English",
        audio_path: Optional[Path] = None,
        style_guide: Optional[Dict[str, Any]] = None,
    ) -> Path:
        """
        Write timeline JSON with branding support.
        
        Branding is injected as timeline entries:
        - Intro: Full-screen centered, shown before audio starts
        - Outro: Full-screen centered, shown after audio ends
        - Watermark: Corner overlay, shown throughout the video content
        
        Args:
            html_segments: List of HTML segment entries
            run_dir: Directory to write timeline file
            branding_config: Branding configuration (intro, outro, watermark)
            content_type: Type of content (VIDEO, QUIZ, STORYBOOK, etc.)
        """
        # Video dimensions for positioning
        VIDEO_WIDTH = getattr(self, 'video_width', 1920)
        VIDEO_HEIGHT = getattr(self, 'video_height', 1080)
        
        # Determine navigation mode based on content type
        NAVIGATION_MAP = {
            "VIDEO": "time_driven",
            "QUIZ": "user_driven",
            "STORYBOOK": "user_driven", 
            "INTERACTIVE_GAME": "self_contained",
            "PUZZLE_BOOK": "user_driven",
            "SIMULATION": "self_contained",
            "FLASHCARDS": "user_driven",
            "MAP_EXPLORATION": "user_driven",
            # New content types
            "WORKSHEET": "user_driven",
            "CODE_PLAYGROUND": "self_contained",
            "TIMELINE": "user_driven",
            "CONVERSATION": "user_driven",
            "SLIDES": "user_driven",
        }
        navigation = NAVIGATION_MAP.get(content_type, "time_driven")
        
        # Determine entry label based on content type
        ENTRY_LABEL_MAP = {
            "VIDEO": "segment",
            "QUIZ": "question",
            "STORYBOOK": "page",
            "INTERACTIVE_GAME": "game",
            "PUZZLE_BOOK": "puzzle",
            "SIMULATION": "simulation",
            "FLASHCARDS": "card",
            "MAP_EXPLORATION": "region",
            # New content types
            "WORKSHEET": "exercise",
            "CODE_PLAYGROUND": "exercise",
            "TIMELINE": "event",
            "CONVERSATION": "exchange",
            "SLIDES": "slide",
        }
        entry_label = ENTRY_LABEL_MAP.get(content_type, "segment")
        
        # Get branding settings with defaults
        branding = branding_config or {}
        intro_config = branding.get("intro", {})
        outro_config = branding.get("outro", {})
        watermark_config = branding.get("watermark", {})
        
        intro_enabled = intro_config.get("enabled", False)
        intro_duration = float(intro_config.get("duration_seconds", 3.0)) if intro_enabled else 0.0
        
        outro_enabled = outro_config.get("enabled", False)
        outro_duration = float(outro_config.get("duration_seconds", 4.0)) if outro_enabled else 0.0
        
        watermark_enabled = watermark_config.get("enabled", False)
        
        timeline_entries: List[Dict[str, Any]] = []
        
        # Track the end time of all content for outro positioning
        content_starts_at = intro_duration
        content_max_end = 0.0
        
        # 1. Add INTRO entry if enabled (full-screen, before audio starts)
        if intro_enabled and intro_config.get("html"):
            intro_entry = {
                "id": "branding-intro",
                "inTime": 0.0,
                "exitTime": intro_duration,
                "htmlStartX": 0,
                "htmlStartY": 0,
                "htmlEndX": VIDEO_WIDTH,
                "htmlEndY": VIDEO_HEIGHT,
                "html": intro_config["html"],
                "z": 9999,  # Very high z-index to be on top
            }
            timeline_entries.append(intro_entry)
            print(f"   ➕ Added intro branding (0s - {intro_duration}s)")
        
        # 2. Process content entries
        if navigation in ["user_driven", "self_contained"]:
            # For interactive content, we want a clean timeline without branding or time-based sequencing
            
            # Remove intro if it was added
            if timeline_entries and timeline_entries[0].get("id") == "branding-intro":
                print(f"   ℹ️ Removing intro branding for {navigation} mode")
                timeline_entries = []
                content_starts_at = 0.0
                intro_duration = 0.0
            
            # Disable subsequent branding
            watermark_enabled = False
            outro_enabled = False
            
            for entry in html_segments:
                clean_entry = {
                    "id": entry.get("id"),
                    "html": entry.get("html"),
                    "htmlStartX": int(entry.get("htmlStartX", 0)),
                    "htmlStartY": int(entry.get("htmlStartY", 0)),
                    "htmlEndX": int(entry.get("htmlEndX", VIDEO_WIDTH)),
                    "htmlEndY": int(entry.get("htmlEndY", VIDEO_HEIGHT)),
                    "z": int(entry.get("z", 1))
                }

                # Pass through critical metadata (quiz answers, game state etc)
                if "entry_meta" in entry:
                    clean_entry["entry_meta"] = entry["entry_meta"]

                # Pass through sound cues (Sound Planner output).
                # Interactive content has no global time clock so cues fire
                # relative to each entry's own open — no intro offset needed.
                if entry.get("sound_cues"):
                    clean_entry["sound_cues"] = entry["sound_cues"]

                timeline_entries.append(clean_entry)
            
            content_max_end = 0.0
            
        else:
            # Standard Time-Driven Logic (Video)
            for entry in html_segments:
                start = int(entry.get("index", len(timeline_entries) + 1))

                # Original times from the content
                original_in_time = float(entry.get("start", 0))
                original_exit_time = float(entry.get("end", 0))

                # Sanitize: exitTime must be > inTime
                if original_exit_time <= original_in_time:
                    original_exit_time = original_in_time + 1.0

                # Offset times by intro duration (audio starts after intro)
                adjusted_in_time = original_in_time + content_starts_at
                adjusted_exit_time = original_exit_time + content_starts_at

                timeline_entry = {
                    "inTime": adjusted_in_time,
                    "exitTime": adjusted_exit_time,
                    "htmlStartX": int(entry["htmlStartX"]),
                    "htmlStartY": int(entry["htmlStartY"]),
                    "htmlEndX": int(entry["htmlEndX"]),
                    "htmlEndY": int(entry["htmlEndY"]),
                    "html": entry["html"],
                    "id": entry.get("id", f"segment-{start}"),
                }
                if "z" in entry:
                    try:
                        timeline_entry["z"] = int(entry["z"])
                    except (TypeError, ValueError):
                        pass
                # Add entry_meta if present
                if "entry_meta" in entry:
                    timeline_entry["entry_meta"] = entry["entry_meta"]

                # SOURCE_CLIP: propagate source video time range for the renderer
                if entry.get("source_start") is not None:
                    timeline_entry["source_start"] = entry["source_start"]
                    timeline_entry["source_end"] = entry.get("source_end", 0)
                    timeline_entry["source_video_index"] = entry.get("source_video_index", 0)
                    timeline_entry["shot_type"] = "SOURCE_CLIP"
                    # Overlay-mode hint for the render worker: when an HTML overlay
                    # has translucent callouts on top of a full-canvas source video,
                    # the black-region heuristic can mis-classify the layout as
                    # "card mode" if the callouts cover too much of the canvas.
                    # An explicit "fullscreen" hint forces brightness-based alpha.
                    if entry.get("_overlay_slots"):
                        timeline_entry["compositing_mode"] = "fullscreen"
                        timeline_entry["overlay_slots"] = entry["_overlay_slots"]

                # Pass through sound cues from the Sound Planner. The cue `t`
                # values are shot-relative (0 = segment start). We ALSO emit an
                # `absolute_time` field that's offset by `content_starts_at`
                # (intro branding duration) so the live player can schedule
                # against the global master clock without recomputing.
                raw_cues = entry.get("sound_cues") or []
                if raw_cues:
                    offset_cues: List[Dict[str, Any]] = []
                    for cue in raw_cues:
                        try:
                            cue_t = float(cue.get("t", 0.0))
                        except (TypeError, ValueError):
                            cue_t = 0.0
                        enriched = dict(cue)
                        enriched["absolute_time"] = round(adjusted_in_time + cue_t, 3)
                        offset_cues.append(enriched)
                    timeline_entry["sound_cues"] = offset_cues

                timeline_entries.append(timeline_entry)
                
                # Track the maximum end time for content
                content_max_end = max(content_max_end, adjusted_exit_time)
        
        # If no content entries, use a minimal duration
        if content_max_end <= content_starts_at:
            content_max_end = content_starts_at + 1.0

        # Ensure timeline covers the full audio duration.
        # Without this, visuals can end before audio finishes.
        if audio_path and Path(audio_path).exists() and navigation == "time_driven":
            try:
                _probe = subprocess.run(
                    ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                     "-of", "default=noprint_wrappers=1:nokey=1", str(audio_path)],
                    capture_output=True, text=True, timeout=10,
                )
                _actual_audio_dur = float(_probe.stdout.strip())
                # Audio starts at content_starts_at, so content should end at
                # content_starts_at + audio_duration
                _audio_end = content_starts_at + _actual_audio_dur
                if _audio_end > content_max_end + 1.0:
                    print(f"   ⚠️ Audio ({_actual_audio_dur:.1f}s) extends beyond last visual "
                          f"({content_max_end:.1f}s). Extending last segment to match.")
                    # Extend the last content entry's exitTime to cover the audio
                    for _te in reversed(timeline_entries):
                        if _te.get("id", "").startswith("segment-"):
                            _te["exitTime"] = _audio_end
                            break
                    content_max_end = _audio_end
            except Exception as _e:
                print(f"   ℹ️ Could not probe audio duration: {_e}")

        # 3. Add WATERMARK entry if enabled (spans entire content duration, positioned in corner)
        if watermark_enabled and watermark_config.get("html"):
            position = watermark_config.get("position", "top-right")
            max_width = int(watermark_config.get("max_width", 200))
            max_height = int(watermark_config.get("max_height", 80))
            margin = int(watermark_config.get("margin", 40))
            
            # Calculate position based on setting
            if position == "top-left":
                wm_x = margin
                wm_y = margin
            elif position == "top-right":
                wm_x = VIDEO_WIDTH - max_width - margin
                wm_y = margin
            elif position == "bottom-left":
                wm_x = margin
                wm_y = VIDEO_HEIGHT - max_height - margin
            elif position == "bottom-right":
                wm_x = VIDEO_WIDTH - max_width - margin
                wm_y = VIDEO_HEIGHT - max_height - margin
            else:  # default to top-right
                wm_x = VIDEO_WIDTH - max_width - margin
                wm_y = margin
            
            watermark_entry = {
                "id": "branding-watermark",
                "inTime": content_starts_at,  # Start when content starts (after intro)
                "exitTime": content_max_end,  # End when content ends (before outro)
                "htmlStartX": wm_x,
                "htmlStartY": wm_y,
                "htmlEndX": wm_x + max_width,
                "htmlEndY": wm_y + max_height,
                "html": watermark_config["html"],
                "z": 1000,  # High z-index but below intro/outro
            }
            timeline_entries.append(watermark_entry)
            print(f"   ➕ Added watermark branding ({content_starts_at}s - {content_max_end}s) at {position}")
        
        # 4. Add OUTRO entry if enabled (full-screen, after audio ends)
        if outro_enabled and outro_config.get("html"):
            outro_start = content_max_end
            outro_end = outro_start + outro_duration
            
            outro_entry = {
                "id": "branding-outro",
                "inTime": outro_start,
                "exitTime": outro_end,
                "htmlStartX": 0,
                "htmlStartY": 0,
                "htmlEndX": VIDEO_WIDTH,
                "htmlEndY": VIDEO_HEIGHT,
                "html": outro_config["html"],
                "z": 9999,  # Very high z-index to be on top
            }
            timeline_entries.append(outro_entry)
            print(f"   ➕ Added outro branding ({outro_start}s - {outro_end}s)")
        
        # Calculate final duration
        final_duration = (content_max_end + outro_duration) if outro_enabled else content_max_end
        
        # Build chapter markers (offset by intro duration so times match absolute video timeline)
        chapter_markers = None
        if chapters:
            chapter_markers = [
                {"time": round(ch["time"] + content_starts_at, 3), "label": ch["label"]}
                for ch in chapters
            ]

        # Create timeline object with metadata for the frontend player
        # The player needs to know when to start the audio (after intro)
        meta_dict: Dict[str, Any] = {
            "content_type": content_type,              # Tells frontend what type of content
            "navigation": navigation,                  # "time_driven", "user_driven", or "self_contained"
            "entry_label": entry_label,                # Label for entries (question, page, segment)
            "language": language,                      # Content language (used by frontend TTS, captions)
            "audio_start_at": content_starts_at,       # Audio should start playing at this time
            "total_duration": final_duration,
            "intro_duration": intro_duration,
            "outro_duration": outro_duration if outro_enabled else 0.0,
            "content_starts_at": content_starts_at,
            "content_ends_at": content_max_end,
            "dimensions": {"width": VIDEO_WIDTH, "height": VIDEO_HEIGHT},
        }
        # Store color palette so client player and render server use matching CSS variables
        if style_guide and isinstance(style_guide, dict):
            _palette = style_guide.get("palette")
            if _palette and isinstance(_palette, dict):
                meta_dict["palette"] = {
                    "background": _palette.get("background", "#ffffff"),
                    "text": _palette.get("text", "#0f172a"),
                    "text_secondary": _palette.get("text_secondary", "#475569"),
                    "primary": _palette.get("primary", "#2563eb"),
                    "accent": _palette.get("accent", "#f59e0b"),
                }
            # Persist a compact `style_guide` summary for the frame-regen LLM so
            # post-hoc edits respect the run's brand & motion strategy. ~200 bytes.
            meta_dict["style_guide"] = {
                "background_type": style_guide.get("background_type", ""),
                "layout_theme": style_guide.get("layout_theme", ""),
                "motion_strategy": style_guide.get("motion_strategy", ""),
            }

        # Persist the shot pack (premium+) so the frame-regen LLM can reuse the
        # exact same design tokens as the original run. Without this, regen
        # picks new colors / sizes / eases and the regenerated shot looks
        # off-brand against its neighbours. The pack is small (~600 bytes).
        _shot_pack = getattr(self, "_current_shot_pack", None)
        if _shot_pack and isinstance(_shot_pack, dict):
            meta_dict["shot_pack"] = _shot_pack

        # Source video metadata for renderer compositing
        if self._input_video_contexts:
            meta_dict["source_videos"] = [
                {
                    "index": i,
                    "url": ctx.get("source_url", ""),
                    "input_video_id": ctx.get("input_video_id", ""),
                    "duration_s": ctx.get("duration_seconds", 0),
                    "mode": ctx.get("mode", ""),
                }
                for i, ctx in enumerate(self._input_video_contexts)
            ]
            # Backward compat: keep singular for old code paths
            meta_dict["source_video"] = meta_dict["source_videos"][0]

        # Background music (Lyria) — auto-generated earlier in run() and
        # stashed on self. Injecting here means it flows through the same
        # meta.audio_tracks[] path as user-added tracks, so the Web Audio
        # mixer and render worker pick it up without any extra wiring.
        _bg_music_track = getattr(self, "_background_music_track", None)
        if _bg_music_track:
            meta_dict.setdefault("audio_tracks", []).append(_bg_music_track)

        if chapter_markers:
            meta_dict["chapters"] = chapter_markers

        # Glossary: offset term times by intro duration to match absolute video timeline
        if glossary:
            meta_dict["glossary"] = [
                {"term": g["term"], "time": round(g["time"] + content_starts_at, 3)}
                for g in glossary
            ]

        # Questions: map chapter_index to actual chapter end times (= next chapter's start)
        # Only included for VIDEO content with chapters and MCQ data from the script plan
        if questions and chapter_markers and content_type == "VIDEO":
            n_chapters = len(chapter_markers)
            question_markers = []
            for q in questions:
                try:
                    chapter_idx = int(q.get("chapter_index", 0))
                    # Fire at the start of the NEXT chapter (marks end of current chapter)
                    if chapter_idx + 1 < n_chapters:
                        q_time = chapter_markers[chapter_idx + 1]["time"]
                    else:
                        # Last chapter: fire just before content ends
                        q_time = round(content_max_end, 3)
                    q_text = str(q.get("question", "")).strip()
                    q_options = [str(o) for o in q.get("options", [])]
                    q_correct = int(q.get("correct", 0))
                    q_explanation = str(q.get("explanation", "")).strip()
                    if q_text and len(q_options) == 4:
                        question_markers.append({
                            "time": q_time,
                            "question": q_text,
                            "options": q_options,
                            "correct": q_correct,
                            "explanation": q_explanation,
                        })
                except (ValueError, TypeError):
                    continue
            if question_markers:
                meta_dict["questions"] = question_markers
                print(f"   ❓ Added {len(question_markers)} MCQ questions to timeline metadata")

        timeline_output = {
            "meta": meta_dict,
            "entries": timeline_entries
        }
        
        timeline_path = run_dir / "time_based_frame.json"
        timeline_path.write_text(json.dumps(timeline_output, indent=2))
        print(f"   📊 Timeline meta: content_type={content_type}, navigation={navigation}, audio starts at {content_starts_at}s, total duration {final_duration}s")
        
        # Also save branding metadata separately for backward compatibility
        branding_meta = {
            "intro_duration_seconds": intro_duration,
            "outro_duration_seconds": outro_duration if outro_enabled else 0.0,
            "content_starts_at": content_starts_at,
            "content_ends_at": content_max_end,
            "total_duration": final_duration,
        }
        branding_meta_path = run_dir / "branding_meta.json"
        branding_meta_path.write_text(json.dumps(branding_meta, indent=2))
        
        return timeline_path

    # ------------------------------------------------------------------
    # Per-shot audio mixing: TTS + source video audio for SOURCE_CLIP
    # ------------------------------------------------------------------

    def _mix_audio_with_source_clips(
        self,
        audio_path: Path,
        words_json_path: Path,
        timeline_path: Path,
        run_dir: Path,
    ) -> Path:
        """Mix source video audio into TTS narration for SOURCE_CLIP shots.

        Reads the timeline JSON to find SOURCE_CLIP entries, extracts audio
        segments from source videos, and builds an FFmpeg filter_complex that
        mutes TTS during those ranges and overlays the source audio with
        crossfades. Replaces narration.mp3 in-place.

        Returns the (possibly updated) audio path.
        """
        import subprocess as _sp

        # Read timeline to find SOURCE_CLIP entries
        tl_data = json.loads(timeline_path.read_text())
        tl_entries = tl_data.get("entries", tl_data if isinstance(tl_data, list) else [])
        meta = tl_data.get("meta", {}) if isinstance(tl_data, dict) else {}
        content_starts_at = meta.get("content_starts_at", 0.0)

        clips = []
        for e in tl_entries:
            if e.get("shot_type") != "SOURCE_CLIP":
                continue
            if e.get("source_start") is None:
                continue
            clips.append({
                "in_time": float(e["inTime"]),
                "exit_time": float(e["exitTime"]),
                "source_start": float(e["source_start"]),
                "source_end": float(e.get("source_end", 0)),
                "source_video_index": int(e.get("source_video_index", 0)),
            })

        if not clips:
            return audio_path

        print(f"🎵 Mixing audio: {len(clips)} SOURCE_CLIP segments")

        mix_dir = run_dir / "_audio_mix"
        mix_dir.mkdir(exist_ok=True)

        # Download source videos (one per unique index) and extract audio
        source_audio_cache: Dict[int, Path] = {}
        for clip in clips:
            sv_idx = clip["source_video_index"]
            if sv_idx in source_audio_cache:
                continue
            if not self._input_video_contexts or sv_idx >= len(self._input_video_contexts):
                print(f"  ⚠️ source_video_index {sv_idx} out of range, skipping")
                continue
            ctx = self._input_video_contexts[sv_idx]
            source_url = (
                ctx.get("assets_urls", {}).get("source_video", "")
                or ctx.get("source_public_url", "")
                or ctx.get("source_url", "")
            )
            if not source_url:
                continue

            # Download source video
            src_path = mix_dir / f"source_{sv_idx}.mp4"
            try:
                if "s3.amazonaws.com/" in source_url:
                    import boto3
                    s3 = boto3.client("s3",
                        aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID") or None,
                        aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY") or None,
                        region_name=os.environ.get("AWS_REGION", "ap-south-1"),
                    )
                    for bkt in ["vacademy-media-storage-public", "vacademy-media-storage"]:
                        if bkt in source_url:
                            parts = source_url.split(f"{bkt}.s3.amazonaws.com/")
                            if len(parts) == 2:
                                try:
                                    s3.download_file(bkt, parts[1], str(src_path))
                                    break
                                except Exception:
                                    continue
                if not src_path.exists():
                    from urllib.request import Request, urlopen
                    req = Request(source_url, headers={"User-Agent": "VacademyMixer/1.0"})
                    with urlopen(req, timeout=120) as resp:
                        src_path.write_bytes(resp.read())

                # Extract full audio track (we'll seek per-segment in the mix command)
                audio_track = mix_dir / f"source_audio_{sv_idx}.wav"
                _sp.run(
                    ["ffmpeg", "-y", "-i", str(src_path), "-vn",
                     "-acodec", "pcm_s16le", "-ar", "44100", "-ac", "1",
                     str(audio_track)],
                    capture_output=True, timeout=120,
                )
                if audio_track.exists():
                    source_audio_cache[sv_idx] = audio_track
                    print(f"  ✅ Extracted audio from source [{sv_idx}]")
                # Clean up video file to save disk
                src_path.unlink(missing_ok=True)
            except Exception as exc:
                print(f"  ⚠️ Failed to get source [{sv_idx}] audio: {exc}")
                src_path.unlink(missing_ok=True)

        # Filter clips to only those with available audio
        clips = [c for c in clips if c["source_video_index"] in source_audio_cache]
        if not clips:
            print("  ⚠️ No source audio available, skipping mix")
            import shutil
            shutil.rmtree(mix_dir, ignore_errors=True)
            return audio_path

        # Extract per-clip segments from full source audio
        segment_paths: List[Path] = []
        for i, clip in enumerate(clips):
            src_audio = source_audio_cache[clip["source_video_index"]]
            seg_path = mix_dir / f"segment_{i}.wav"
            dur = clip["source_end"] - clip["source_start"]
            if dur <= 0:
                continue
            _sp.run(
                ["ffmpeg", "-y", "-i", str(src_audio),
                 "-ss", str(clip["source_start"]),
                 "-t", str(dur),
                 "-acodec", "pcm_s16le", "-ar", "44100", "-ac", "1",
                 str(seg_path)],
                capture_output=True, timeout=30,
            )
            if seg_path.exists():
                segment_paths.append(seg_path)
            else:
                segment_paths.append(None)

        # Build FFmpeg filter_complex
        # Input 0: TTS narration
        # Inputs 1..N: source audio segments
        inputs = ["-i", str(audio_path)]
        valid_clips = []
        input_idx = 1
        for i, clip in enumerate(clips):
            if i < len(segment_paths) and segment_paths[i] and segment_paths[i].exists():
                inputs.extend(["-i", str(segment_paths[i])])
                valid_clips.append((clip, input_idx))
                input_idx += 1

        if not valid_clips:
            import shutil
            shutil.rmtree(mix_dir, ignore_errors=True)
            return audio_path

        # Volume-gate TTS during SOURCE_CLIP ranges
        crossfade = 0.15
        vol_filters = []
        for clip, _ in valid_clips:
            # Convert timeline time to audio time
            audio_start = max(0, clip["in_time"] - content_starts_at - crossfade)
            audio_end = clip["exit_time"] - content_starts_at + crossfade
            vol_filters.append(
                f"volume=enable='between(t,{audio_start:.3f},{audio_end:.3f})':volume=0"
            )

        tts_chain = ",".join(vol_filters)
        filter_parts = [f"[0:a]{tts_chain}[tts_gated]"]

        # Delay and fade each source segment
        src_labels = []
        for clip, idx in valid_clips:
            label = f"src{idx}"
            audio_t = max(0, clip["in_time"] - content_starts_at)
            delay_ms = int(audio_t * 1000)
            dur = clip["exit_time"] - clip["in_time"]
            fade_dur = min(0.3, dur / 3)
            fade_out_start = max(0, dur - fade_dur)
            filter_parts.append(
                f"[{idx}:a]adelay={delay_ms}|{delay_ms},"
                f"afade=t=in:st=0:d={fade_dur:.2f},"
                f"afade=t=out:st={fade_out_start:.2f}:d={fade_dur:.2f}"
                f"[{label}]"
            )
            src_labels.append(f"[{label}]")

        # Mix all streams
        all_inputs = "[tts_gated]" + "".join(src_labels)
        n_inputs = 1 + len(src_labels)
        filter_parts.append(
            f"{all_inputs}amix=inputs={n_inputs}:duration=first:normalize=0[aout]"
        )

        filter_complex = ";".join(filter_parts)

        mixed_path = mix_dir / "narration_mixed.mp3"
        cmd = [
            "ffmpeg", "-y",
            *inputs,
            "-filter_complex", filter_complex,
            "-map", "[aout]",
            "-acodec", "libmp3lame", "-q:a", "2",
            str(mixed_path),
        ]

        try:
            result = _sp.run(cmd, capture_output=True, text=True, timeout=120)
            if result.returncode != 0:
                print(f"  ⚠️ FFmpeg mix failed: {result.stderr[:300]}")
                import shutil
                shutil.rmtree(mix_dir, ignore_errors=True)
                return audio_path
        except Exception as exc:
            print(f"  ⚠️ FFmpeg mix error: {exc}")
            import shutil
            shutil.rmtree(mix_dir, ignore_errors=True)
            return audio_path

        # Replace narration.mp3 with mixed version
        import shutil
        backup = audio_path.with_suffix(".mp3.bak")
        shutil.copy2(audio_path, backup)
        shutil.copy2(mixed_path, audio_path)
        print(f"  ✅ Mixed audio written ({len(valid_clips)} source clips)")

        # Filter words: remove TTS words that fall within SOURCE_CLIP ranges
        if words_json_path.exists():
            try:
                words = json.loads(words_json_path.read_text())
                clip_ranges = [
                    (max(0, c["in_time"] - content_starts_at),
                     c["exit_time"] - content_starts_at)
                    for c, _ in valid_clips
                ]
                filtered = [
                    w for w in words
                    if not any(r[0] <= w.get("start", 0) <= r[1] for r in clip_ranges)
                ]
                if len(filtered) < len(words):
                    words_json_path.write_text(
                        json.dumps(filtered, ensure_ascii=False)
                    )
                    print(f"  ✅ Filtered words: {len(words)} → {len(filtered)} "
                          f"(suppressed {len(words) - len(filtered)} during SOURCE_CLIP)")
            except Exception:
                pass  # non-fatal

        # Cleanup
        shutil.rmtree(mix_dir, ignore_errors=True)
        return audio_path

    def _render_video(
        self,
        audio_path: Path,
        timeline_path: Path,
        words_json_path: Path,
        run_dir: Path,
        avatar_video_path: Optional[Path] = None,
        show_captions: bool = True,
        background_color: str = "#000000",
    ) -> Path:
        output_video = run_dir / "output.mp4"
        frames_dir = run_dir / ".render_frames"
        
        # Get audio delay from branding config (intro duration)
        audio_delay = 0.0

        # Primary: check branding_meta.json (ground truth — written during _write_timeline)
        branding_meta_path = run_dir / "branding_meta.json"
        if branding_meta_path.exists():
            try:
                branding_meta = json.loads(branding_meta_path.read_text())
                audio_delay = float(branding_meta.get("intro_duration_seconds", 0.0))
                print(f"   🎵 Audio will start at {audio_delay}s (from branding_meta.json)")
            except Exception as e:
                print(f"   ⚠️ Could not load branding metadata: {e}")

        # Fallback: use in-memory branding config (for first-run before _write_timeline)
        if audio_delay == 0.0 and hasattr(self, '_current_branding') and self._current_branding:
            intro_config = self._current_branding.get("intro", {})
            if intro_config.get("enabled", False):
                audio_delay = float(intro_config.get("duration_seconds", 0.0))
                print(f"   🎵 Audio will start at {audio_delay}s (from branding config)")
        
        _video_options_path = str(DEFAULT_VIDEO_OPTIONS)
        crossfade_duration = self._tier_config.get("crossfade_duration", 0.0)
        if crossfade_duration > 0.0:
            _base_opts = json.loads(Path(DEFAULT_VIDEO_OPTIONS).read_text())
            _base_opts["crossfade_duration"] = crossfade_duration
            _patched_opts_path = run_dir / "video_options_patched.json"
            _patched_opts_path.write_text(json.dumps(_base_opts))
            _video_options_path = str(_patched_opts_path)

        cmd = [
            sys.executable,
            str(GENERATE_VIDEO_SCRIPT),
            str(audio_path),
            str(timeline_path),
            str(output_video),
            "--video-options",
            _video_options_path,
            "--captions-words",
            str(words_json_path),
            "--captions-settings",
            str(DEFAULT_CAPTIONS_SETTINGS),
            "--frames-dir",
            str(frames_dir),
            "--background",
            background_color,
        ]
        
        # Add audio delay for intro silence
        if audio_delay > 0:
            cmd.extend(["--audio-delay", str(audio_delay)])
        if show_captions:
            cmd.append("--show-captions")
        if avatar_video_path:
            cmd.extend(["--avatar-video", str(avatar_video_path)])
            
            
        try:
            # Capture output to ensure we see errors in the logs
            result = subprocess.run(cmd, check=True, cwd=REPO_ROOT, capture_output=True, text=True)
            print(f"Render output: {result.stdout}")
        except subprocess.CalledProcessError as e:
            print(f"❌ Video generation command failed!")
            print(f"STDOUT: {e.stdout}")
            print(f"STDERR: {e.stderr}")
            raise RuntimeError(f"Video generation failed with exit code {e.returncode}. Error: {e.stderr}")
            
        if not output_video.exists():
            raise RuntimeError(f"Video not found at {output_video}")
        return output_video

    def _emit_progress(self, event: Dict[str, Any]) -> None:
        """Fire a progress event to the SSE bridge (non-fatal if callback missing)."""
        if self._progress_callback:
            try:
                self._progress_callback(event)
            except Exception:
                pass  # never let a callback error break the pipeline

    def _resolve_run_dir(self, run_name: Optional[str], resume_run: Optional[str]) -> Path:
        if resume_run:
            candidate = Path(resume_run)
            if not candidate.is_absolute():
                candidate = (self.runs_dir / resume_run).expanduser().resolve()
            if not candidate.exists():
                raise FileNotFoundError(f"Resume run directory not found: {candidate}")
            return candidate

        safe_name = run_name or datetime.now().strftime("autogen_%Y%m%d_%H%M%S")
        run_dir = (self.runs_dir / safe_name).expanduser().resolve()
        return run_dir

    @staticmethod
    def _require_file(path: Path, description: str) -> None:
        if not path.exists():
            raise FileNotFoundError(f"Cannot resume stage; missing {description}: {path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a full video from a short prompt.")
    prompt_group = parser.add_mutually_exclusive_group(required=False)
    prompt_group.add_argument("--prompt", help="Base idea for the video.")
    prompt_group.add_argument("--prompt-file", help="Path to a text file with the prompt.")
    parser.add_argument("--run-name", help="Optional run identifier (default timestamp).")
    parser.add_argument("--resume-run", help="Existing run name or absolute path to resume.")
    parser.add_argument(
        "--start-from",
        choices=VideoGenerationPipeline.STAGE_ORDER,
        default="script",
        help="Stage to begin executing from.",
    )
    parser.add_argument("--openrouter-key", help="Override OpenRouter API key.")
    parser.add_argument("--script-model", default="xiaomi/mimo-v2-flash:free", help="Model for script drafting.")
    parser.add_argument("--html-model", default="xiaomi/mimo-v2-flash:free", help="Model for HTML generation.")
    parser.add_argument("--voice-id", default="Qggl4b0xRMiqOwhPtVWT", help="ElevenLabs voice ID.")
    parser.add_argument("--voice-model", default="eleven_multilingual_v2", help="ElevenLabs model ID.")
    parser.add_argument(
        "--background-type",
        choices=["black", "white"],
        default="black",
        help="Background color type: 'black' for dark theme, 'white' for light theme (default: black)."
    )
    parser.add_argument(
        "--target-audience",
        default="General/Adult",
        help="Target audience for age-appropriate content. Examples: 'Class 3 (Ages 7-8)', 'Class 9-10 (Ages 14-15)', 'College/Adult'."
    )
    parser.add_argument(
        "--target-duration",
        default="2-3 minutes",
        help="Target video duration. Examples: '2-3 minutes', '5 minutes', '7 minutes', '10 minutes'."
    )
    parser.add_argument(
        "--max-segments",
        type=int,
        default=8,
        help="Maximum number of segments to limit LLM expense (default: 8). Each segment = 1 LLM call for HTML generation."
    )
    args = parser.parse_args()

    if args.resume_run and args.run_name:
        parser.error("--run-name cannot be combined with --resume-run")
    if args.start_from != "script" and not args.resume_run:
        parser.error("--resume-run is required when --start-from is not 'script'")
    if args.start_from == "script" and not (args.prompt or args.prompt_file):
        parser.error("--prompt or --prompt-file is required when --start-from is 'script'")

    return args


def main() -> None:
    args = parse_args()
    prompt_text = ""
    if args.prompt:
        prompt_text = args.prompt
    elif args.prompt_file:
        prompt_path = Path(args.prompt_file).expanduser()
        prompt_text = prompt_path.read_text()

    pipeline = VideoGenerationPipeline(
        openrouter_key=args.openrouter_key or DEFAULT_OPENROUTER_KEY,
        script_model=args.script_model,
        html_model=args.html_model,
        voice_id=args.voice_id,
        voice_model=args.voice_model,
    )
    outputs = pipeline.run(
        prompt_text,
        run_name=args.run_name,
        resume_run=args.resume_run,
        start_from=args.start_from,
        background_type=args.background_type,
        target_audience=args.target_audience,
        target_duration=args.target_duration,
        max_segments=args.max_segments,
    )
    print("\n✅ Pipeline completed successfully!")
    print(f"• Run directory: {outputs['run_dir']}")
    print(f"• Script:        {outputs['script_path']}")
    print(f"• Audio:         {outputs['audio_path']}")
    print(f"• Words JSON:    {outputs['words_json']}")
    print(f"• Timeline JSON: {outputs['timeline_json']}")
    print(f"• Video:         {outputs['video_path']}")


if __name__ == "__main__":
    main()


