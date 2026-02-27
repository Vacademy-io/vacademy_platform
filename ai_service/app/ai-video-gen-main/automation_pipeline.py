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
        SCRIPT_USER_PROMPT_TEMPLATE,
        STYLE_GUIDE_SYSTEM_PROMPT,
        STYLE_GUIDE_USER_PROMPT_TEMPLATE,
        HTML_GENERATION_SYSTEM_PROMPT_TEMPLATE,
        HTML_GENERATION_SAFE_AREA,
        HTML_GENERATION_USER_PROMPT_TEMPLATE,
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
DEFAULT_GEMINI_IMAGE_KEY = os.environ.get("GEMINI_API_KEY", "")

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
    "french": {
        "edge": {"female": "fr-FR-DeniseNeural", "male": "fr-FR-HenriNeural"},
        "google": {"female": "fr-FR-Neural2-A", "male": "fr-FR-Neural2-B"}
    },
    "german": {
        "edge": {"female": "de-DE-KatjaNeural", "male": "de-DE-ConradNeural"},
        "google": {"female": "de-DE-Neural2-A", "male": "de-DE-Neural2-B"}
    },
    "japanese": {
        "edge": {"female": "ja-JP-NanamiNeural", "male": "ja-JP-KeitaNeural"},
        "google": {"female": "ja-JP-Neural2-B", "male": "ja-JP-Neural2-C"}
    },
    "chinese": {
        "edge": {"female": "zh-CN-XiaoxiaoNeural", "male": "zh-CN-YunxiNeural"},
        "google": {"female": "zh-CN-Neural2-C", "male": "zh-CN-Neural2-D"}
    }
}


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
    # Free tier models to try in order (fallback chain)
    FREE_MODELS = [
        "xiaomi/mimo-v2-flash:free",
        "mistralai/devstral-2512:free",
        "nvidia/nemotron-3-nano-30b-a3b:free"
    ]
    
    def __init__(
        self,
        api_key: str,
        default_model: str,
        referer: str = "https://stilllift-automation.local",
        title: str = "StillLift Automation",
    ) -> None:
        self.api_key = api_key
        # If default_model is one of the free models, use fallback chain
        if default_model in self.FREE_MODELS:
            self.model_chain = self.FREE_MODELS
        else:
            self.model_chain = [default_model]
        self.default_model = default_model
        self.base_url = "https://openrouter.ai/api/v1/chat/completions"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": referer,
            "X-Title": title,
        }



    @retry_with_backoff(max_retries=4, initial_delay=2.0, exceptions=(urllib.error.URLError, RuntimeError))
    def chat(
        self,
        messages: Sequence[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.6,
        max_tokens: int = 2000,
    ) -> Tuple[str, Dict[str, Any]]:
        # If using free models, try them in order with fallback
        models_to_try = self.model_chain if model is None and self.default_model in self.FREE_MODELS else [model or self.default_model]
        
        last_error = None
        for model_to_use in models_to_try:
            try:
                payload = {
                    "model": model_to_use,
                    "messages": list(messages),
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                }
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

        response = None
        word_list = []

        if supports_marks:
            # Create SSML with marks for each word to get precise timestamps
            ssml_input, word_list = self._create_ssml_with_marks(text)
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
            # Plain text synthesis (for unsupported voices or after timepoint failure)
            simple_input = texttospeech.SynthesisInput(text=text)
            response = client.synthesize_speech(
                input=simple_input,
                voice=voice,
                audio_config=audio_config
            )

        # Save audio
        output_path.write_bytes(response.audio_content)
        
        # Process timepoints to create word timestamps (if available)
        word_entries = []
        if hasattr(response, 'timepoints') and response.timepoints:
            word_entries = self._process_timepoints(response, word_list)
        
        if word_entries:
            print(f"    ✅ Got {len(word_entries)} word timestamps from Google TTS Timepoints")
            raw_json_path.write_text(json.dumps(word_entries, indent=2))
        else:
            # Fallback to Whisper alignment if no timepoints returned
            print(f"    ⚠️ No timepoints returned, using Whisper alignment fallback")
            self._generate_timestamps_with_fallback(output_path, text, raw_json_path)

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

    def _align_with_whisper(self, audio_path: Path, text: str) -> list:
        """Use Whisper for forced alignment to get accurate word timestamps from audio."""
        try:
            from faster_whisper import WhisperModel
        except ImportError:
            print("    ⚠️ faster-whisper not installed. Run: pip install faster-whisper")
            return []
        
        try:
            print("    🎯 Running Whisper forced alignment...")
            
            # Use tiny or base model for speed (word-level timing is accurate enough)
            # Compute type determines precision/speed tradeoff
            model = WhisperModel("base", device="cpu", compute_type="int8")
            
            # Transcribe with word timestamps
            segments, info = model.transcribe(
                str(audio_path),
                word_timestamps=True,
                language="en"  # TODO: Make this dynamic based on video language
            )
            
            word_entries = []
            for segment in segments:
                if segment.words:
                    for word_info in segment.words:
                        word_entries.append({
                            "word": word_info.word.strip(),
                            "start": round(word_info.start, 3),
                            "end": round(word_info.end, 3)
                        })
            
            if word_entries:
                print(f"    ✅ Whisper alignment extracted {len(word_entries)} word timestamps")
            else:
                print("    ⚠️ Whisper returned no word timestamps")
            
            return word_entries
            
        except Exception as e:
            print(f"    ❌ Whisper alignment failed: {e}")
            return []

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
        gemini_image_key: str = DEFAULT_GEMINI_IMAGE_KEY,
        runs_dir: Path = DEFAULT_RUNS_DIR,
    ) -> None:
        if not openrouter_key:
            raise ValueError("OpenRouter API key is required (set OPENROUTER_API_KEY or pass --openrouter-key).")
        self.script_client = OpenRouterClient(openrouter_key, script_model)
        self.html_client = OpenRouterClient(openrouter_key, html_model)
        self.voice_id = voice_id
        self.voice_model = voice_model
        self.gemini_image_api_key = gemini_image_key
        self.runs_dir = runs_dir
        self.runs_dir.mkdir(parents=True, exist_ok=True)

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
        tts_provider: str = "edge",
        branding_config: Optional[Dict[str, Any]] = None,
        style_config: Optional[Dict[str, Any]] = None,
        content_type: str = "VIDEO",
        generate_avatar: bool = False,
        avatar_image_url: Optional[str] = None,
        max_segments: int = 8,
    ) -> Dict[str, Any]:
        # Store max_segments for use in concept-aligned segmentation
        self._max_segments = max_segments
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
        do_html = stage_idx <= self.STAGE_INDEX["html"] and self.STAGE_INDEX["html"] < stop_idx
        do_avatar = stage_idx <= self.STAGE_INDEX["avatar"] and self.STAGE_INDEX["avatar"] < stop_idx and generate_avatar
        do_render = stage_idx <= self.STAGE_INDEX["render"] and self.STAGE_INDEX["render"] < stop_idx

        # Token usage aggregation
        total_usage = {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
            "image_count": 0
        }
        
        def accumulate_usage(u: Dict[str, Any]):
            if not u: return
            total_usage["prompt_tokens"] += u.get("prompt_tokens", 0)
            total_usage["completion_tokens"] += u.get("completion_tokens", 0)
            total_usage["total_tokens"] += u.get("total_tokens", 0)
            total_usage["image_count"] += u.get("image_count", 0)

        script_path = run_dir / "script.txt"
        response_json = run_dir / "narration_raw.json"
        audio_path = run_dir / "narration.mp3"
        words_json = run_dir / "narration.words.json"
        words_csv = run_dir / "narration.words.csv"
        alignment_json = run_dir / "alignment.json"
        timeline_path = run_dir / "time_based_frame.json"

        # Initialize outputs to safe defaults in case stages are skipped
        tts_outputs = {"response_json": None, "audio_path": None}
        word_outputs = {"words_json": None, "words_csv": None, "alignment_json": None}

        if do_script:
            if not base_prompt or not base_prompt.strip():
                raise ValueError("A prompt is required when starting from the script stage.")
            print(f"📝 Drafting refined script ({run_dir.name}) for {target_audience} [{target_duration}]...")
            script_out = self._draft_script(base_prompt, run_dir, language=language, target_audience=target_audience, target_duration=target_duration, content_type=content_type)
            script_plan = script_out["result"]
            accumulate_usage(script_out.get("usage", {}))
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

        # Only proceed to TTS if we are not stopping before it
        if self.STAGE_INDEX["tts"] < stop_idx:
            if do_tts:
                # print("🗣️  Synthesize narration ...") # Already printed in method
                tts_outputs = self._synthesize_voice(
                    script_plan["script_path"], 
                    run_dir, 
                    language=language,
                    voice_gender=voice_gender,
                    tts_provider=tts_provider
                )
            else:
                self._require_file(response_json, "narration_raw.json (ElevenLabs response)")
                self._require_file(audio_path, "narration.mp3 (decoded audio)")
                tts_outputs = {"response_json": response_json, "audio_path": audio_path}

        # Only proceed to WORDS if we are not stopping before it
        if self.STAGE_INDEX["words"] < stop_idx:
            if do_words:
                print("🔤 Deriving word timings ...")
                # Ensure we have the necessary inputs from TTS stage (or loaded files)
                if not tts_outputs["response_json"]:
                     # This should not happen due to the check above and do_tts logic, 
                     # but essentially if we are here, we must have tts outputs
                     # If we skipped TTS generation (do_tts=False), we loaded them in the else block above.
                     pass
                word_outputs = self._parse_timestamps(tts_outputs["response_json"], run_dir)
            else:
                self._require_file(words_json, "narration.words.json")
                self._require_file(words_csv, "narration.words.csv")
                # Note: alignment.json not required since phonemes disabled
                word_outputs = {
                    "words_json": words_json,
                    "words_csv": words_csv,
                }

            words = self._load_words(word_outputs["words_json"])
            if not words:
                raise RuntimeError("No words parsed from timestamps; cannot continue.")
        else:
            words = []

        if do_html:
            print("🎨 Designing Visual Style Guide ...")
            style_guide = self._generate_style_guide(script_plan["script_text"], run_dir, background_type=background_type, style_config=self._current_style_config)
            
            # CHECK FOR INTERACTIVE CONTENT TYPES
            interactive_types = ["QUIZ", "STORYBOOK", "FLASHCARDS", "PUZZLE_BOOK", "INTERACTIVE_GAME", "SIMULATION", "WORKSHEET", "CODE_PLAYGROUND", "TIMELINE", "CONVERSATION", "MAP_EXPLORATION"]
            
            if content_type in interactive_types:
                print(f"🎮 Processing interactive content type: {content_type}")
                # For interactive content, we bypass audio-based segmentation and directly use the structure from the plan
                html_segments, html_usage = self._process_interactive_content(script_plan, content_type)
                accumulate_usage(html_usage)
                
                # Some interactive types still need image generation (like Storybooks)
                print("🖼️  Checking for visual assets to generate ...")
                html_segments, image_usage = self._process_generated_images(html_segments, run_dir)
                accumulate_usage(image_usage)
            else:
                # STANDARD VIDEO FLOW
                # Extract subject domain from AI-classified script plan
                plan_data = script_plan.get("plan", {})
                subject_domain = plan_data.get("subject_domain", "general")
                if subject_domain not in TOPIC_SHOT_PROFILES:
                    subject_domain = "general"
                self._current_subject_domain = subject_domain
                self._current_visual_style = plan_data.get("visual_style", "realistic cinematic photograph")
                print(f"📘 Subject domain: {subject_domain} ({TOPIC_SHOT_PROFILES[subject_domain]['description']})")
                print(f"🎨 Visual style: {self._current_visual_style}")
                
                print("🧠 Building concept-aligned segments ...")
                # Use beat_outline for concept-aligned segmentation if available
                beat_outline = plan_data.get("beat_outline", [])

                # Store raw questions from script plan (chapter timestamps assigned later)
                self._current_questions = plan_data.get("questions", [])
                if self._current_questions:
                    print(f"   📝 Loaded {len(self._current_questions)} MCQ questions from script plan")

                # Configurable max segments to limit LLM expense
                # Default: max 12 segments (covers ~8 minutes of video at ~40s each)
                max_segments = getattr(self, '_max_segments', 12)
                
                if beat_outline and len(beat_outline) >= 2 and words:
                    segments = self._segment_words_by_beats(words, beat_outline, max_segments=max_segments)
                    print(f"   ✅ Created {len(segments)} concept-aligned segments from {len(beat_outline)} beats (max: {max_segments})")
                else:
                    segments = self._segment_words(words)
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
                html_results, html_usage = self._generate_html_segments(segments, style_guide, plan_data, run_dir, language=language)
                html_segments = html_results
                accumulate_usage(html_usage)
                
                print("🖼️  Generating AI images for visual assets ...")
                html_segments, image_usage = self._process_generated_images(html_segments, run_dir)
                accumulate_usage(image_usage)
            
            print("🧾 Writing timeline JSON ...")
            timeline_path = self._write_timeline(
                html_segments, run_dir, self._current_branding, self._current_content_type,
                chapters=getattr(self, '_current_chapters', None),
                glossary=getattr(self, '_current_glossary', None),
                questions=getattr(self, '_current_questions', None),
                language=language,
            )
        
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
            system_prompt = SCRIPT_SYSTEM_PROMPT
            user_prompt = SCRIPT_USER_PROMPT_TEMPLATE.format(
                base_prompt=base_prompt.strip(), 
                language=language,
                target_audience=target_audience,
                target_duration=target_duration
            ).strip()
        else:
            # Use content-type-specific prompts
            system_prompt = ct_prompts["system"]
            
            # Format user prompt with all available parameters
            defaults = ct_prompts.get("defaults", {})
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
            ).strip()
            
        print(f"📝 Generating {content_type} content...")

        # Retry up to 3 times if we get invalid JSON
        max_attempts = 3
        last_error = None
        for attempt in range(max_attempts):
            try:
                raw, usage = self.script_client.chat(
                    messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
                    temperature=0.5,
                    max_tokens=16000,  # Increased for complex content types
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
        else:
            # Default fallback
            script_text = data.get("script", data.get("title", content_type))

        # Store the content type in the plan for later stages
        data["_content_type"] = content_type
        
        plan_path = run_dir / "script_plan.json"
        plan_path.write_text(json.dumps(data, indent=2))
        script_path = run_dir / "script.txt"
        script_path.write_text(script_text + "\n")
        return {"result": {"plan": data, "script_path": script_path, "script_text": script_text}, "usage": usage}

    # --- Google TTS bridge -------------------------------------------------
    # --- Edge TTS bridge (Free, Timed) -------------------------------------------------
    @retry_with_backoff(max_retries=3, initial_delay=2.0)
    def _synthesize_voice(
        self, 
        script_path: Path, 
        run_dir: Path, 
        language: str = "English",
        voice_gender: str = "female",
        tts_provider: str = "edge"
    ) -> Dict[str, Any]:
        print(f"🗣️  Synthesizing narration ({tts_provider}) - {language} [{voice_gender}]...")
        
        # Ensure local deps are available
        if str(LOCAL_DEPS_DIR) not in sys.path:
            sys.path.insert(0, str(LOCAL_DEPS_DIR))
            
        import asyncio
        import edge_tts
        from edge_tts import submaker
        
        response_json = run_dir / "narration_raw.json"
        audio_path = run_dir / "narration.mp3"
        script_text = script_path.read_text().strip()
        
        # --- Voice Selection Logic ---
        lang_key = language.lower().strip()
        gender_key = voice_gender.lower().strip()
        provider_key = tts_provider.lower().strip()
        
        if gender_key not in ["male", "female"]: gender_key = "female"
        if provider_key not in ["edge", "google"]: provider_key = "edge"
        
        # Fallback to English if language not found
        if lang_key not in VOICE_MAPPING:
             print(f"    ⚠️  Language '{language}' not found in mapping, falling back to 'english'")
             lang_key = "english"
             
        # Select voice
        try:
            selected_voice = VOICE_MAPPING[lang_key][provider_key][gender_key]
        except KeyError:
            # Deep fallback
            selected_voice = VOICE_MAPPING["english"][provider_key][gender_key]
            
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
                return {"response_json": response_json, "audio_path": audio_path}
            except Exception as e:
                print(f"    ❌ Google TTS failed: {e}")
                raise e

        # --- Edge TTS Path ---
        # Default behavior: Use EdgeTTS with selected voice
        
        async def _run_tts():
            communicate = edge_tts.Communicate(script_text, selected_voice)
            
            # We will perform a TWO-PASS or single-pass-with-subs approach? 
            # stream() is easiest for single pass, but if it fails, we need subs.
            # Let's try to capture Subs directly if available?
            # Actually, `communicate.stream()` produces `type="WordBoundary"`.
            # If that fails, `submaker` is needed?
            
            # Simple approach: AriaNeural (and other neural voices) generally works. 
            # Let's stick to stream() but with Aria.
            
            audio_data = bytearray()
            word_entries = [] 
            
            print(f"    ℹ️  EdgeTTS Processing script of length: {len(script_text)}")
            
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_data.extend(chunk["data"])
                elif chunk["type"] == "WordBoundary":
                    # offset/duration in 100ns units (1e-7 seconds)
                    start_s = chunk["offset"] / 1e7
                    dur_s = chunk["duration"] / 1e7
                    text = chunk["text"]
                    word_entries.append({
                        "word": text,
                        "start": start_s,
                        "end": start_s + dur_s
                    })
            
            if not word_entries:
                print("    ⚠️  WARNING: No WordBoundary events received! Switching to 'SubMaker' fallback.")
                
                # 2. SubMaker Fallback with timeout protection
                # The communicate stream also emits events that SubMaker uses
                # We need to feed the submaker if we hadn't already. 
                # But since we already consumed the stream, and submaker needs the stream events passed to it,
                # we technically should have been feeding it.
                # However, re-running is cheap for us here to ensure correctness.
                
                print("    🔄 Re-running generation to capture Subtitles...")
                communicate_retry = edge_tts.Communicate(script_text, selected_voice)
                submaker = edge_tts.SubMaker()
                audio_data_retry = bytearray() # Re-capture to be safe
                chunk_count = 0
                # More reasonable chunk limit: ~100 chunks per character (accounts for audio + boundary events)
                max_chunks = min(len(script_text) * 100, 50000)  # Cap at 50k chunks to prevent excessive processing
                
                try:
                    # Wrap stream processing with timeout (max 3 minutes for very long scripts)
                    # More aggressive timeout: 3 min base + 0.05s per character (capped at 5 min)
                    max_timeout = min(300, max(180, len(script_text) * 0.05))
                    print(f"    ℹ️  SubMaker timeout set to {max_timeout:.1f}s for {len(script_text)} character script")
                    
                    async def process_stream():
                        nonlocal chunk_count, audio_data_retry
                        async for chunk in communicate_retry.stream():
                            chunk_count += 1
                            # Progress logging for long scripts
                            if chunk_count % 500 == 0:
                                print(f"    ℹ️  Processed {chunk_count} chunks (max: {max_chunks})...")
                            
                            # Safety check to prevent infinite loops
                            if chunk_count > max_chunks:
                                print(f"    ⚠️  Reached chunk limit ({max_chunks}). Stopping stream processing.")
                                break
                            
                            if chunk["type"] == "audio":
                                audio_data_retry.extend(chunk["data"])
                            elif chunk["type"] == "WordBoundary" or chunk["type"] == "SentenceBoundary":
                                submaker.feed(chunk)
                        return audio_data_retry
                    
                    stream_timed_out = False
                    try:
                        audio_data = await asyncio.wait_for(process_stream(), timeout=max_timeout)
                        print(f"    ✅ Stream processing completed ({chunk_count} chunks)")
                    except asyncio.TimeoutError:
                        print(f"    ⚠️  Stream processing timed out after {max_timeout}s. Using partial audio and skipping SRT.")
                        audio_data = audio_data_retry
                        vtt_content = ""  # Skip SRT generation if stream timed out
                        stream_timed_out = True
                    
                    # Generate SRT with timeout protection (only if stream didn't timeout)
                    if not stream_timed_out:
                        try:
                            print("    ℹ️  Generating SRT from SubMaker...")
                            # SubMaker.get_srt() can sometimes hang, so we'll use a simple timeout
                            import concurrent.futures
                            with concurrent.futures.ThreadPoolExecutor() as executor:
                                future = executor.submit(submaker.get_srt)
                                try:
                                    vtt_content = future.result(timeout=30)  # 30 second timeout for SRT generation
                                    print(f"    ✅ SubMaker generated {len(vtt_content)} characters of SRT")
                                except concurrent.futures.TimeoutError:
                                    print(f"    ⚠️  SubMaker.get_srt() timed out after 30s. Using empty SRT.")
                                    vtt_content = ""
                        except Exception as e:
                            print(f"    ⚠️  SubMaker.get_srt() failed: {e}")
                            vtt_content = ""
                except Exception as e:
                    print(f"    ⚠️  SubMaker stream processing failed: {e}")
                    vtt_content = ""
                    # Use retry audio if available, otherwise keep original
                    if audio_data_retry:
                        audio_data = audio_data_retry
                
                # Parse SRT (SubRip) - Using VTT parser logic logic adjusted for SRT
                # Format:
                # 1
                # 00:00:00,100 --> 00:00:02,500
                # Hello world
                
                chars = []
                starts = []
                ends = []
                
                lines = vtt_content.splitlines()
                current_start = 0.0
                current_end = 0.0
                
                import re
                # SRT uses comma for milliseconds: 00:00:05,400
                time_pattern = re.compile(r"(\d{2}):(\d{2}):(\d{2})[,.](\d{3})")
                
                def parse_time(t_str):
                    parts = time_pattern.match(t_str)
                    if not parts: return 0.0
                    h, m, s, ms = map(int, parts.groups())
                    return h*3600 + m*60 + s + ms/1000.0

                for i, line in enumerate(lines):
                    if "-->" in line:
                        times = line.split("-->")
                        current_start = parse_time(times[0].strip())
                        current_end = parse_time(times[1].strip())
                        
                        # Next lines are text until empty line
                        text_accumulator = ""
                        j = i + 1
                        while j < len(lines) and lines[j].strip():
                            text_accumulator += lines[j].strip() + " "
                            j += 1
                        
                        text_line = text_accumulator.strip()
                        if text_line:
                            # Distribute characters over this duration
                            seg_len = current_end - current_start
                            char_len = len(text_line)
                            if char_len > 0:
                                per_char = seg_len / char_len
                                for k, char in enumerate(text_line):
                                    c_s = current_start + (k * per_char)
                                    c_e = c_s + per_char
                                    chars.append(char)
                                    starts.append(round(c_s, 3))
                                    ends.append(round(c_e, 3))
                                # Add space separator
                                chars.append(" ")
                                starts.append(round(current_end, 3))
                                ends.append(round(current_end, 3))
                
                final_data = {
                    "alignment": {
                        "characters": chars,
                        "character_start_times_seconds": starts,
                        "character_end_times_seconds": ends
                    }
                }
                if not vtt_content:
                    print("    ⚠️  No subtitles generated. Edge TTS is invalid for this text/voice combo.")
                    print("    ⚠️  Generating MOCK timestamps to prevent crash (Sync will be approximate).")
                    chars = list(script_text)
                    starts = []
                    ends = []
                    t = 0.0
                    step = 0.06
                    for c in chars:
                        starts.append(round(t, 3))
                        t += step
                        ends.append(round(t, 3))
                    
                    final_data = {
                        "alignment": {
                            "characters": chars,
                            "character_start_times_seconds": starts,
                            "character_end_times_seconds": ends
                        }
                    }
                else:
                     print(f"    ✅ Recovered {len(chars)} chars/timestamps via VTT.")
                     # ... vtt parsing already done above ... use `final_data` if constructed or reconstruct it.
                     # Wait, my previous edit inserted the parser. I just need to wrap it.
                     pass 

                # Actually the previous edit failed to insert the "if not vtt_content" block correctly.
                # Let's clean up the whole mess after `vtt_content = ...` definition.

            else:
                # Normal word entries path...
                # Convert Word Timings to Pseudo-Character Alignment for compatibility
                chars = []
                starts = []
                ends = []
                
                for w in word_entries:
                    word_str = w["word"]
                    w_start = w["start"]
                    w_end = w["end"]
                    w_dur = w_end - w_start
                    
                    if not word_str: continue
                    
                    char_dur = w_dur / len(word_str)
                    for i, char in enumerate(word_str):
                        c_start = w_start + (i * char_dur)
                        c_end = c_start + char_dur
                        chars.append(char)
                        starts.append(round(c_start, 3))
                        ends.append(round(c_end, 3))
                    
                    chars.append(" ")
                    starts.append(round(w_end, 3))
                    ends.append(round(w_end, 3))

                final_data = {
                    "alignment": {
                        "characters": chars,
                        "character_start_times_seconds": starts,
                        "character_end_times_seconds": ends
                    }
                }
                print(f"    ✅ Captured {len(word_entries)} words.")

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
        
        return {"response_json": response_json, "audio_path": audio_path}

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
        print(f"🎨 Using {background_type.upper()} background theme")
        print(f"   Text color: {preset['text']} | SVG stroke: {style_guide['palette']['svg_stroke']} | Annotation: {style_guide['palette']['annotation_color']}")
        return style_guide

    # --- Segmentation + HTML ----------------------------------------------
    @staticmethod
    def _load_words(words_path: Path) -> List[Dict[str, Any]]:
        return json.loads(words_path.read_text())

    @staticmethod
    def _segment_words(words: List[Dict[str, Any]], window: float = 40.0) -> List[Dict[str, Any]]:
        if not words:
            return []
        total_duration = float(words[-1]["end"])
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

                            "text": chunk_text,
                            "words": chunk_words,  # Include raw words for alignment
                        }
                    )
                    idx += 1
            start_time += window
        return segments

    def _segment_words_by_beats(
        self, words: List[Dict[str, Any]], beat_outline: List[Dict[str, Any]], max_segments: int = 8
    ) -> List[Dict[str, Any]]:
        """
        Concept-aligned segmentation: uses the beat_outline labels to find natural
        topic transitions in the narration text, then splits words at those boundaries.
        
        Falls back to fixed-window if beat matching fails.
        max_segments caps total segments to control LLM cost.
        """
        if not words or not beat_outline:
            return self._segment_words(words)
        
        total_duration = float(words[-1]["end"])
        full_text = " ".join(str(w.get("word", "")) for w in words).lower()
        
        # Try to find approximate word positions for each beat label
        # by searching for key_terms or summary keywords in the word stream
        beat_boundaries: List[float] = [0.0]
        
        for beat in beat_outline:
            key_terms = beat.get("key_terms", [])
            summary_words = beat.get("summary", "").lower().split()[:3]  # First 3 words of summary
            search_terms = [t.lower() for t in key_terms] + summary_words
            
            best_time = None
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
        
        beat_boundaries.append(total_duration)
        
        # Merge very short segments (< 15s) with neighbors
        merged = [beat_boundaries[0]]
        for b in beat_boundaries[1:]:
            if b - merged[-1] < 15.0 and len(merged) > 1:
                continue  # Skip, let it merge with next
            merged.append(b)
        if merged[-1] != total_duration:
            merged.append(total_duration)
        beat_boundaries = merged
        
        # Enforce max_segments cap by merging smallest adjacent pairs
        while len(beat_boundaries) - 1 > max_segments:
            # Find smallest gap
            min_gap = float("inf")
            min_idx = 1
            for i in range(1, len(beat_boundaries) - 1):
                gap = beat_boundaries[i + 1] - beat_boundaries[i - 1]
                if beat_boundaries[i] - beat_boundaries[i - 1] < min_gap:
                    min_gap = beat_boundaries[i] - beat_boundaries[i - 1]
                    min_idx = i
            beat_boundaries.pop(min_idx)
        
        # If we only got start+end (no useful beat boundaries), fall back
        if len(beat_boundaries) <= 2:
            print("   ⚠️ Beat matching found no useful boundaries, using fixed-window fallback")
            return self._segment_words(words)
        
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
                    # Check if this segment has a recap marker, capture beat label and key terms
                    beat_idx = min(idx, len(beat_outline) - 1)
                    needs_recap = beat_outline[beat_idx].get("needs_recap", False) if beat_idx < len(beat_outline) else False
                    beat_label = beat_outline[beat_idx].get("label", f"Section {idx + 1}") if beat_idx < len(beat_outline) else f"Section {idx + 1}"
                    key_terms = beat_outline[beat_idx].get("key_terms", []) if beat_idx < len(beat_outline) else []

                    segments.append({
                        "index": idx + 1,
                        "start": round(start_time, 3),
                        "end": round(end_time, 3),
                        "text": chunk_text,
                        "words": chunk_words,
                        "needs_recap": needs_recap,
                        "beat_label": beat_label,
                        "key_terms": key_terms,
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
                "htmlStartX": 0, "htmlStartY": 0, "htmlEndX": 1920, "htmlEndY": 1080,
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

    def _generate_html_segments(self, segments: List[Dict[str, Any]], style_guide: Dict[str, Any], script_plan: Optional[Dict[str, Any]], run_dir: Path, language: str = "English") -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        # Resolve template once (shared across all segment tasks)
        _layout_theme_id = style_guide.get("layout_theme", "")
        _template = _get_template_by_id(_layout_theme_id) if _layout_theme_id else None

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

            # Extract relevant visual ideas from beat outline if available
            beat_context = ""
            if script_plan and "beat_outline" in script_plan:
                beat_context = "\nVISUAL IDEAS FROM SCRIPT:\n"
                for beat in script_plan["beat_outline"]:
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
            try:
                if hasattr(self, '_current_html_quality') and self._current_html_quality == "classic":
                    from prompts import HTML_GENERATION_SYSTEM_PROMPT_CLASSIC
                    system_prompt = HTML_GENERATION_SYSTEM_PROMPT_CLASSIC
                else:
                    from prompts import HTML_GENERATION_SYSTEM_PROMPT_ADVANCED
                    system_prompt = HTML_GENERATION_SYSTEM_PROMPT_ADVANCED
            except ImportError:
                # Fallback to default if import fails
                system_prompt = HTML_GENERATION_SYSTEM_PROMPT_TEMPLATE
            
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

            user_prompt = HTML_GENERATION_USER_PROMPT_TEMPLATE.format(
                index=seg["index"],
                start=seg["start"],
                end=seg["end"],
                text=seg["text"],
                word_timings=word_timings,
                style_context=style_context,
                beat_context=beat_context,
                safe_area=HTML_GENERATION_SAFE_AREA,
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
            ).strip()

            # Retry logic for robustness against JSON parsing failures
            import time
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    raw, usage = self.html_client.chat(
                        messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
                        temperature=0.7,  # Lower temperature for more consistent JSON output
                        max_tokens=24000,
                    )
                    data = self._parse_html_response(raw, seg, run_dir)
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
                        wait_time = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s
                        print(f"⚠️  Attempt {attempt + 1}/{max_retries} failed for segment {seg.get('index')}: {e}")
                        print(f"   Retrying in {wait_time}s...")
                        time.sleep(wait_time)
                    else:
                        print(f"❌ All {max_retries} attempts failed for segment {seg.get('index')}")
                        raise

        results: List[Dict[str, Any]] = []
        total_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

        with concurrent.futures.ThreadPoolExecutor(max_workers=min(4, len(segments) or 1)) as executor:
            future_map = {executor.submit(task, seg): seg for seg in segments}
            for future in concurrent.futures.as_completed(future_map):
                seg = future_map[future]
                result_entries, usage = future.result()
                results.extend(result_entries)
                if usage:
                    total_usage["prompt_tokens"] += usage.get("prompt_tokens", 0)
                    total_usage["completion_tokens"] += usage.get("completion_tokens", 0)
                    total_usage["total_tokens"] += usage.get("total_tokens", 0)

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
                    "width": 1920,
                    "height": 1080,
                    "html": html,
                }
            ]
        }

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

    @staticmethod
    def _resolve_shot_duration(shot: Dict[str, Any], seg_duration: float, default_span: float) -> float:
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
        # Enforce a readable minimum: 3 seconds per shot (prompt asks for 5+ but segments
        # shorter than ~12s would produce fewer than the requested 3-4 shots at 5s each).
        return max(3.0, duration)

    @staticmethod
    def _resolve_shot_box(shot: Dict[str, Any]) -> Tuple[int, int, int, int, bool]:
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

        auto_box = False
        if w is None:
            w = 1920
            auto_box = True
        if h is None:
            h = 1080
            auto_box = True

        # Auto-center if x/y are missing but w/h are known (or defaulted above)
        if x is None:
            x = (1920 - w) // 2
            auto_box = True
        if y is None:
            y = (1080 - h) // 2
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

    def _ensure_fonts(self, html: str) -> str:
        # Get colors based on background_type
        bg_type = getattr(self, '_current_background_type', 'white')
        preset = BACKGROUND_PRESETS.get(bg_type, BACKGROUND_PRESETS["white"])
        
        text_color = preset["text"]
        text_secondary = preset["text_secondary"]
        primary_color = preset["primary"]
        accent_color = preset["accent"]
        
        # Common educational styles (Highlighting, Markers)
        # Build Google Fonts import URL — base fonts + any template-specific additions
        _style_cfg = getattr(self, '_current_style_config', None)
        _layout_theme = (_style_cfg or {}).get("layout_theme", "") if _style_cfg else ""
        _extra_family = self._TEMPLATE_EXTRA_FONT_FAMILIES.get(_layout_theme, "")
        _base_families = "Montserrat:wght@700;900&family=Inter:wght@400;600&family=Fira+Code"
        _fonts_param = f"{_base_families}&family={_extra_family}" if _extra_family else _base_families
        _fonts_url = f"https://fonts.googleapis.com/css2?family={_fonts_param}&display=swap"

        global_css = f"""<style>
            @import url('{_fonts_url}');
            
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
            </style>"""
        
        # If the model already imports fonts, trust it.
        # But still inject our global helpers.
        if "fonts.googleapis.com" in html:
            return global_css + html

        # Fallback corporate pairing if none found
        base_style = (
            "<style>"
            "@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;900&family=Inter:wght@400;600&display=swap');"
            ":host { font-family: 'Inter', sans-serif; background: transparent; margin: 0; }"
            "h1, h2, h3, h4, h5, h6 { font-family: 'Montserrat', sans-serif; }"
            "</style>"
        )
        return global_css + base_style + html

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
            "htmlEndX": 1920,
            "htmlEndY": 1080,
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

    def _process_generated_images(self, html_segments: List[Dict[str, Any]], run_dir: Path) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """
        Scan generated HTML for <img data-img-prompt="..."> tags, generate images via Gemini,
        save them to disk, and update the src attribute.
        """
        images_dir = run_dir / "generated_images"
        images_dir.mkdir(parents=True, exist_ok=True)
        
        # Check if Gemini API key is available
        if not self.gemini_image_api_key:
            print("    ⚠️  No Gemini API key configured. Skipping image generation.")
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
                tasks.append({
                    "entry": entry,
                    "full_tag": full_tag,
                    "prompt": prompt,
                    "seg_idx": seg_idx,
                    "timestamp": datetime.now().strftime("%f")  # basic uniqueness
                })

        if not tasks:
            print(f"    ℹ️  No image tags found in HTML segments (checked {total_html_segments} segments, {segments_with_images} had 'data-img-prompt' attribute).")
            print(f"    ℹ️  The LLM may not have generated image tags. Check HTML generation prompt includes image instructions.")
            return html_segments, {}

        print(f"    Found {len(tasks)} images to generate from {segments_with_images} segments.")
        
        def process_image_task(task):
            prompt = task["prompt"]
            idx = task["seg_idx"]

            # Prepend video-wide visual style for consistency across all images
            visual_style = getattr(self, '_current_visual_style', 'realistic cinematic photograph')
            if visual_style.lower() not in prompt.lower():
                prompt = f"{visual_style}, {prompt}"

            # Generate
            print(f"    🎨 Generating image {idx}: {prompt[:60]}...")
            # We don't get exact token usage from this simplified call, but we can count images
            image_bytes, usage_meta = self._call_image_generation_llm(prompt)
            if not image_bytes:
                print(f"    ❌ Failed to generate image for: {prompt[:50]}...")
                return None
                
            # Save
            filename = f"img_{idx}_{abs(hash(prompt))}.png"
            path = images_dir / filename
            try:
                path.write_bytes(image_bytes)
                # Verify file was written
                if not path.exists() or path.stat().st_size == 0:
                    print(f"    ❌ Image file was not saved correctly: {filename}")
                    return None
                print(f"    ✅ Saved image: {filename} ({len(image_bytes)} bytes) at {path}")
                
                return {
                    "entry_id": id(task["entry"]),
                    "full_tag": task["full_tag"],
                    "new_src": str(path.absolute()),
                    "filename": filename,
                    "usage": usage_meta
                }
            except Exception as e:
                print(f"    ❌ Failed to save image {filename}: {e}")
                return None

        replacements = {}
        successful_generations = 0
        failed_generations = 0
        total_image_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0, "image_count": 0}
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            futures = [executor.submit(process_image_task, t) for t in tasks]
            for f in concurrent.futures.as_completed(futures):
                res = f.result()
                if res:
                    successful_generations += 1
                    total_image_usage["image_count"] += 1
                    u = res.get("usage")
                    if u:
                        total_image_usage["prompt_tokens"] += u.get("promptTokenCount", 0)
                        total_image_usage["completion_tokens"] += u.get("candidatesTokenCount", 0)
                        total_image_usage["total_tokens"] += u.get("totalTokenCount", 0)
                    
                    entry_id = res["entry_id"]
                    if entry_id not in replacements:
                        replacements[entry_id] = []
                    replacements[entry_id].append(res)
                else:
                    failed_generations += 1
        
        print(f"    📊 Image generation summary: {successful_generations} successful, {failed_generations} failed out of {len(tasks)} total")
        
        if successful_generations == 0:
            print("    ⚠️  No images were successfully generated. HTML will retain placeholder images.")
            return html_segments, total_image_usage
        
        # Apply replacements - use a more robust matching strategy
        replacements_applied = 0
        for entry in html_segments:
            entry_id = id(entry)
            html = entry.get("html", "")
            original_html = html
            
            if entry_id in replacements:
                for rep in replacements[entry_id]:
                    old_tag = rep["full_tag"]
                    # Embed image as base64 data: URL so HTML is self-contained
                    # (file:// URLs don't work in browser iframes rendered via srcdoc)
                    try:
                        img_bytes = Path(rep['new_src']).read_bytes()
                        b64 = base64.b64encode(img_bytes).decode('utf-8')
                        new_src = f"data:image/png;base64,{b64}"
                    except Exception as e:
                        print(f"    ⚠️  Could not read image for base64 encoding: {e}")
                        continue

                    # Strategy 1: Direct tag replacement (most reliable)
                    if old_tag in html:
                        # Replace src attribute in the tag
                        new_tag = re.sub(r'src=["\'][^"\']*["\']', f'src="{new_src}"', old_tag)
                        html = html.replace(old_tag, new_tag)
                        replacements_applied += 1
                        print(f"    ✅ Embedded image (base64) in entry {entry_id}: {old_tag[:50]}...")
                    else:
                        # Strategy 2: Find by data-img-prompt value (fallback)
                        prompt_match = re.search(r'data-img-prompt=(["\'])(.*?)\1', old_tag)
                        if prompt_match:
                            prompt_value = prompt_match.group(2)
                            # Find all img tags with this prompt
                            img_pattern = rf'<img[^>]+data-img-prompt=(["\']){re.escape(prompt_value)}\1[^>]*>'
                            matches = list(re.finditer(img_pattern, html))
                            for match in matches:
                                matched_tag = match.group(0)
                                new_tag = re.sub(r'src=["\'][^"\']*["\']', f'src="{new_src}"', matched_tag)
                                html = html.replace(matched_tag, new_tag)
                                replacements_applied += 1
                                print(f"    ✅ Embedded image (base64, prompt match): {prompt_value[:30]}...")
            
            if html != original_html:
                entry["html"] = html
        
        print(f"    📝 Applied {replacements_applied} image replacements to HTML segments")
        return html_segments, total_image_usage

    @retry_with_backoff(max_retries=3, initial_delay=1.0)
    def _call_image_generation_llm(self, prompt: str, width: int = 1920, height: int = 1080) -> Tuple[Optional[bytes], Optional[Dict[str, Any]]]:
        """
        Generate image using Google Generative AI (Gemini). Returns (image_bytes, usage_metadata).
        """
        if not self.gemini_image_api_key:
            print(f"    ⚠️ No Gemini API key for images. Cannot generate: {prompt[:50]}...")
            return None, None

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key={self.gemini_image_api_key}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "imageConfig": {"aspectRatio": "16:9"},
                "responseModalities": ["IMAGE"]
            }
        }

        max_retries = 4
        for attempt in range(max_retries):
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST"
            )
            try:
                with urllib.request.urlopen(req, timeout=120) as response:
                    raw = response.read().decode("utf-8")
                    data = json.loads(raw)

                usage_metadata = data.get("usageMetadata", {})

                # 1. Direct inlineData
                if "inlineData" in data:
                    b64 = data["inlineData"].get("data")
                    if b64:
                        return base64.b64decode(b64), usage_metadata

                # 2. Candidates
                if "candidates" in data and data["candidates"]:
                    candidate = data["candidates"][0]
                    if "content" in candidate and "parts" in candidate["content"]:
                        for part in candidate["content"]["parts"]:
                            if "inlineData" in part:
                                b64 = part["inlineData"].get("data")
                                if b64:
                                    return base64.b64decode(b64), usage_metadata

                return None, None

            except urllib.error.HTTPError as e:
                if e.code == 429:
                    # Respect Retry-After header if present, else exponential backoff
                    wait = (2 ** attempt) * 5  # 5s, 10s, 20s, 40s
                    retry_after = e.headers.get("Retry-After")
                    if retry_after:
                        try:
                            wait = int(retry_after) + 1
                        except ValueError:
                            pass
                    if attempt < max_retries - 1:
                        print(f"    ⏳ Rate limited (429) for image '{prompt[:40]}...'. Waiting {wait}s (attempt {attempt + 1}/{max_retries})...")
                        time.sleep(wait)
                        continue
                    print(f"    ❌ Gemini image rate limit exceeded after {max_retries} retries: {prompt[:50]}...")
                    return None, None
                print(f"    ❌ Gemini image HTTP error {e.code} for prompt '{prompt[:50]}...': {e}")
                return None, None
            except Exception as e:
                import traceback
                print(f"    ⚠️  Gemini image attempt {attempt + 1}/{max_retries} failed for '{prompt[:50]}...': {str(e)}")
                if attempt < max_retries - 1:
                    wait = (2 ** attempt) * 3  # 3s, 6s, 12s
                    print(f"    📋 Error details: {traceback.format_exc()[:300]}")
                    print(f"    ⏳ Retrying in {wait}s...")
                    time.sleep(wait)
                    continue
                print(f"    ❌ Gemini image generation failed after {max_retries} attempts: {traceback.format_exc()[:500]}")
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
    @staticmethod
    def _write_timeline(
        html_segments: List[Dict[str, Any]],
        run_dir: Path,
        branding_config: Optional[Dict[str, Any]] = None,
        content_type: str = "VIDEO",
        chapters: Optional[List[Dict[str, Any]]] = None,
        glossary: Optional[List[Dict[str, Any]]] = None,
        questions: Optional[List[Dict[str, Any]]] = None,
        language: str = "English",
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
        VIDEO_WIDTH = 1920
        VIDEO_HEIGHT = 1080
        
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
            "CONVERSATION": "user_driven"
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
            "CONVERSATION": "exchange"
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
                
                timeline_entries.append(clean_entry)
            
            content_max_end = 0.0
            
        else:
            # Standard Time-Driven Logic (Video)
            for entry in html_segments:
                start = int(entry.get("index", len(timeline_entries) + 1))
                
                # Original times from the content
                original_in_time = float(entry.get("start", 0))
                original_exit_time = float(entry.get("end", 0))
                
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
                timeline_entries.append(timeline_entry)
                
                # Track the maximum end time for content
                content_max_end = max(content_max_end, adjusted_exit_time)
        
        # If no content entries, use a minimal duration
        if content_max_end <= content_starts_at:
            content_max_end = content_starts_at + 1.0
        
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
        }
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
        
        # First try to get from stored branding config (works within same pipeline run)
        if hasattr(self, '_current_branding') and self._current_branding:
            intro_config = self._current_branding.get("intro", {})
            if intro_config.get("enabled", False):
                audio_delay = float(intro_config.get("duration_seconds", 0.0))
                print(f"   🎵 Audio will start at {audio_delay}s (from branding config)")
        
        # Fallback: check branding_meta.json file (for resumed runs)
        if audio_delay == 0.0:
            branding_meta_path = run_dir / "branding_meta.json"
            if branding_meta_path.exists():
                try:
                    branding_meta = json.loads(branding_meta_path.read_text())
                    audio_delay = float(branding_meta.get("intro_duration_seconds", 0.0))
                    print(f"   🎵 Audio will start at {audio_delay}s (from branding_meta.json)")
                except Exception as e:
                    print(f"   ⚠️ Could not load branding metadata: {e}")
        
        cmd = [
            sys.executable,
            str(GENERATE_VIDEO_SCRIPT),
            str(audio_path),
            str(timeline_path),
            str(output_video),
            "--video-options",
            str(DEFAULT_VIDEO_OPTIONS),
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


