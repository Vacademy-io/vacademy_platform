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
from typing import Any, Dict, List, Optional, Sequence, Tuple

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
    )
except ImportError:
    # Fallback or error if not found. But since we just created it, it should be fine.
    # We will raise to ensure the user knows something is wrong.
    raise RuntimeError("Could not import prompts.py. Ensure it exists in the same directory.")

DEFAULT_OPENROUTER_KEY = os.environ.get("OPENROUTER_API_KEY", "")
DEFAULT_GEMINI_IMAGE_KEY = os.environ.get("GEMINI_API_KEY", "")

VOICE_MAPPING = {
    "english": "en-US-AriaNeural",
    "hindi": "hi-IN-SwaraNeural",
    "spanish": "es-ES-ElviraNeural",
    "french": "fr-FR-DeniseNeural",
    "german": "de-DE-KatjaNeural",
    "japanese": "ja-JP-NanamiNeural",
    "chinese": "zh-CN-XiaoxiaoNeural",
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
    Handles common JSON errors like mismatched quotes.
    """
    # 1. Try stripping code fences first
    text = raw.strip()
    # Regex to capture content inside ```json ... ``` or just ``` ... ```
    # Non-greedy match for the content inside
    fence_match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1)
    
    # Helper function to fix common JSON errors
    def fix_json_errors(json_str: str) -> str:
        """Fix common JSON syntax errors."""
        # Fix mismatched quotes: 'key": -> "key":
        # Pattern matches: 'summary": (single quote start, word, double quote and colon)
        # Use regular string for replacement to properly escape quotes
        json_str = re.sub(r"'(\w+)\":", '"\\1":', json_str)
        # Also fix: 'key': -> "key": (single quotes around key)
        json_str = re.sub(r"'(\w+)':", '"\\1":', json_str)
        # Fix trailing commas before closing braces/brackets
        json_str = re.sub(r',\s*}', '}', json_str)
        json_str = re.sub(r',\s*]', ']', json_str)
        return json_str
    
    # Try parsing with error fixes
    try:
        fixed_text = fix_json_errors(text)
        return json.loads(fixed_text)
    except json.JSONDecodeError:
        pass

    # 2. If that failed, try to find the largest brace-enclosed string
    # We'll search for the first '{' and the last '}'
    start_idx = raw.find('{')
    end_idx = raw.rfind('}')
    
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        candidate = raw[start_idx : end_idx + 1]
        try:
            fixed_candidate = fix_json_errors(candidate)
            return json.loads(fixed_candidate)
        except json.JSONDecodeError as e:
            # Try more aggressive fixes
            try:
                # Fix single quotes around keys (mismatched quotes)
                fixed_candidate = re.sub(r"'(\w+)\":", '"\\1":', candidate)
                fixed_candidate = re.sub(r":\s*'([^']*)'", ': "\\1"', fixed_candidate)
                # Fix trailing commas
                fixed_candidate = re.sub(r',\s*}', '}', fixed_candidate)
                fixed_candidate = re.sub(r',\s*]', ']', fixed_candidate)
                return json.loads(fixed_candidate)
            except json.JSONDecodeError:
                pass

    # 4. Try finding ALL brace pairs and decoding them, taking the first valid one
    # This helps if there are multiple JSON blocks or nested confusion
    for match in re.finditer(r"(\{.*\})", raw, re.DOTALL):
        try:
            fixed_match = fix_json_errors(match.group(1))
            return json.loads(fixed_match)
        except json.JSONDecodeError:
            continue
            
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
    ) -> str:
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
                    return data["choices"][0]["message"]["content"]
            except urllib.error.HTTPError as exc:
                detail = exc.read().decode("utf-8", errors="ignore")
                last_error = RuntimeError(f"OpenRouter request failed with {model_to_use}: {exc.code} {exc.reason}\n{detail}")
                # If this is not the last model, continue to next
                if model_to_use != models_to_try[-1]:
                    continue
                # Last model failed, raise the error
                raise last_error from exc
            except urllib.error.URLError as exc:
                last_error = RuntimeError(f"OpenRouter request error with {model_to_use}: {exc.reason}")
                # If this is not the last model, continue to next
                if model_to_use != models_to_try[-1]:
                    continue
                # Last model failed, raise the error
                raise last_error from exc
        
        # Should never reach here, but just in case
        if last_error:
            raise last_error
        raise RuntimeError("No models available to try")

        data = json.loads(raw)
        return data["choices"][0]["message"]["content"]


class GoogleCloudTTSClient:
    def __init__(self, credentials_path: str):
        self.credentials_path = credentials_path

    @retry_with_backoff(max_retries=3, initial_delay=1.0)
    def synthesize(self, text: str, output_path: Path, raw_json_path: Path) -> None:
        try:
            from google.cloud import texttospeech
            from google.oauth2 import service_account
        except ImportError:
            raise RuntimeError("google-cloud-texttospeech not installed. Run `pip install google-cloud-texttospeech`.")

        print(f"🔑 Using Service Account: {self.credentials_path}")
        credentials = service_account.Credentials.from_service_account_file(self.credentials_path)
        client = texttospeech.TextToSpeechClient(credentials=credentials)

        input_text = texttospeech.SynthesisInput(text=text)
        voice = texttospeech.VoiceSelectionParams(
            language_code="en-US",
            name="en-US-Journey-F"
        )
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3
        )

        response = client.synthesize_speech(
            input=input_text, voice=voice, audio_config=audio_config
        )

        # Save audio
        output_path.write_bytes(response.audio_content)
        
        # Generate mock timestamps (linear interpolation)
        self._generate_mock_timestamps(text, raw_json_path)

    def _generate_mock_timestamps(self, text: str, raw_json_path: Path) -> None:
        # Linear interpolation for timestamps (approx 16 chars/sec)
        chars = list(text)
        starts = []
        ends = []
        t = 0.0
        step = 0.06 
        for c in chars:
            starts.append(round(t, 3))
            t += step
            ends.append(round(t, 3))
            
        mock_response = {
            "alignment": {
                "characters": chars,
                "character_start_times_seconds": starts,
                "character_end_times_seconds": ends
            }
        }
        raw_json_path.write_text(json.dumps(mock_response, indent=2))


class VideoGenerationPipeline:
    STAGE_ORDER = ("script", "tts", "words", "html", "render")
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
    ) -> Dict[str, Any]:
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
        
        # Store parameters for use in pipeline stages
        self._current_language = language
        self._current_show_captions = show_captions
        self._current_html_quality = html_quality
        self._current_background_type = background_type
        
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
        do_render = stage_idx <= self.STAGE_INDEX["render"] and self.STAGE_INDEX["render"] < stop_idx

        script_path = run_dir / "script.txt"
        response_json = run_dir / "narration_raw.json"
        audio_path = run_dir / "narration.mp3"
        words_json = run_dir / "narration.words.json"
        words_csv = run_dir / "narration.words.csv"
        alignment_json = run_dir / "alignment.json"
        timeline_path = run_dir / "time_based_frame.json"

        if do_script:
            if not base_prompt or not base_prompt.strip():
                raise ValueError("A prompt is required when starting from the script stage.")
            print(f"📝 Drafting refined script ({run_dir.name}) ...")
            script_plan = self._draft_script(base_prompt, run_dir, language=language)
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

        if do_tts:
            # print("🗣️  Synthesizing narration ...") # Already printed in method
            tts_outputs = self._synthesize_voice(script_plan["script_path"], run_dir, language=language)
        else:
            self._require_file(response_json, "narration_raw.json (ElevenLabs response)")
            self._require_file(audio_path, "narration.mp3 (decoded audio)")
            tts_outputs = {"response_json": response_json, "audio_path": audio_path}

        if do_words:
            print("🔤 Deriving word timings ...")
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

        if do_html:
            print("🎨 Designing Visual Style Guide ...")
            style_guide = self._generate_style_guide(script_plan["script_text"], run_dir, background_type=background_type)
            
            print("🧠 Building minute-level segments ...")
            segments = self._segment_words(words)
            if not segments:
                raise RuntimeError("Failed to derive segments from narration.")
            print(f"🎨 Generating {len(segments)} HTML overlay sets via OpenRouter ...")
            html_segments = self._generate_html_segments(segments, style_guide, script_plan.get("plan"), run_dir, language=language)
            
            print("🖼️  Generating AI images for visual assets ...")
            html_segments = self._process_generated_images(html_segments, run_dir)
            
            print("🧾 Writing timeline JSON ...")
            timeline_path = self._write_timeline(html_segments, run_dir)
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
            
            # Check for avatar generation
            avatar_video = None
            if DEFAULT_VIDEO_OPTIONS.exists():
                try:
                    opts = json.loads(DEFAULT_VIDEO_OPTIONS.read_text())
                    avatar_video = self._generate_avatar(tts_outputs["audio_path"], run_dir, opts)
                except Exception as e:
                    print(f"⚠️ Avatar generation skipped due to error: {e}")


            video_path = self._render_video(
                audio_path=tts_outputs["audio_path"],
                timeline_path=timeline_path,
                words_json_path=word_outputs["words_json"],
                run_dir=run_dir,
                avatar_video_path=avatar_video,
                show_captions=show_captions,
                background_color=render_bg_color,
            )
        else:
            video_path = None

        return {
            "run_dir": run_dir,
            "script_path": script_plan["script_path"],
            "voice_json": tts_outputs["response_json"],
            "audio_path": tts_outputs["audio_path"],
            "words_json": word_outputs["words_json"],
            "words_csv": word_outputs.get("words_csv", words_csv),
            "alignment_json": word_outputs.get("alignment_json", alignment_json),
            "timeline_json": timeline_path,
            "video_path": video_path,
        }

    # --- Script generation -------------------------------------------------
    def _draft_script(self, base_prompt: str, run_dir: Path, language: str = "English") -> Dict[str, Any]:
        system_prompt = SCRIPT_SYSTEM_PROMPT
        user_prompt = SCRIPT_USER_PROMPT_TEMPLATE.format(base_prompt=base_prompt.strip(), language=language).strip()

        raw = self.script_client.chat(
            messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
            temperature=0.5,
            max_tokens=12000,
        )
        data = _extract_json_blob(raw)
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

        plan_path = run_dir / "script_plan.json"
        plan_path.write_text(json.dumps(data, indent=2))
        script_path = run_dir / "script.txt"
        script_path.write_text(script_text + "\n")
        return {"plan": data, "script_path": script_path, "script_text": script_text}

    # --- Google TTS bridge -------------------------------------------------
    # --- Edge TTS bridge (Free, Timed) -------------------------------------------------
    @retry_with_backoff(max_retries=3, initial_delay=2.0)
    def _synthesize_voice(self, script_path: Path, run_dir: Path, language: str = "English") -> Dict[str, Any]:
        print("🗣️  Synthesizing narration (EdgeTTS) ...")
        
        # Ensure local deps are available
        if str(LOCAL_DEPS_DIR) not in sys.path:
            sys.path.insert(0, str(LOCAL_DEPS_DIR))
            
        import asyncio
        import edge_tts
        from edge_tts import submaker
        
        response_json = run_dir / "narration_raw.json"
        audio_path = run_dir / "narration.mp3"
        script_text = script_path.read_text().strip()
        voice = VOICE_MAPPING.get(language.lower(), "en-US-AriaNeural") 
        print(f"    🗣️  Voice: {voice} (Language: {language})")
        
        async def _run_tts():
            communicate = edge_tts.Communicate(script_text, voice)
            
            # We will perform a TWO-PASS or single-pass-with-subs approach? 
            # stream() is easiest for single pass, but if it fails, we need subs.
            # Let's try to capture Subs directly if available?
            # Actually, `communicate.stream()` produces `type="WordBoundary"`.
            # If that fails, `submaker` is needed?
            
            # Simple approach: AriaNeural generally works. 
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
                communicate_retry = edge_tts.Communicate(script_text, voice)
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
            if credentials_path.exists():
                print("    🔄 Falling back to Google Cloud TTS...")
                try:
                    gc_client = GoogleCloudTTSClient(str(credentials_path))
                    # Note: GoogleCloudTTSClient currently hardcodes en-US-Journey-F
                    gc_client.synthesize(script_text, audio_path, response_json)
                except Exception as e2:
                    print(f"    ❌ Google TTS Fallback also failed: {e2}")
                    raise e  # Raise original EdgeTTS error if fallback fails
            else:
                print("    ❌ No google_credentials.json found for fallback.")
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
    def _generate_style_guide(self, script_text: str, run_dir: Path, background_type: str = "black") -> Dict[str, Any]:
        """
        Generate a style guide based on background_type (white or black).
        Uses predefined presets to ensure proper color contrast.
        """
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
        
        # Save for inspection
        (run_dir / "style_guide.json").write_text(json.dumps(style_guide, indent=2))
        print(f"🎨 Using {background_type.upper()} background theme")
        print(f"   Text color: {preset['text']} | SVG stroke: {preset['svg_stroke']} | Annotation: {preset['annotation_color']}")
        return style_guide

    # --- Segmentation + HTML ----------------------------------------------
    @staticmethod
    def _load_words(words_path: Path) -> List[Dict[str, Any]]:
        return json.loads(words_path.read_text())

    @staticmethod
    def _segment_words(words: List[Dict[str, Any]], window: float = 60.0) -> List[Dict[str, Any]]:
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

    def _generate_html_segments(self, segments: List[Dict[str, Any]], style_guide: Dict[str, Any], script_plan: Optional[Dict[str, Any]], run_dir: Path, language: str = "English") -> List[Dict[str, Any]]:
        def task(seg: Dict[str, Any]) -> List[Dict[str, Any]]:
            # Flatten style guide for prompt
            palette = style_guide.get("palette", {})
            background_type = style_guide.get("background_type", "black")
            
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
            
            style_context = (
                f"🎨 **COLOR RULES (CRITICAL - FOLLOW EXACTLY)**:\n"
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
                f"\n**MERMAID DIAGRAMS**:\n"
                f"```\n"
                f"{mermaid_classdef}\n"
                f"```\n"
                f"\n**ROUGH NOTATION** (for annotations):\n"
                f"```javascript\n"
                f"RoughNotation.annotate(element, {{type: 'underline', color: '{palette.get('annotation_color')}'}}).show();\n"
                f"```\n"
            )

            # Extract relevant visual ideas from beat outline if available
            beat_context = ""
            if script_plan and "beat_outline" in script_plan:
                beat_context = "\nVISUAL IDEAS FROM SCRIPT:\n"
                for beat in script_plan["beat_outline"]:
                    if beat.get("visual_idea"):
                        beat_context += f"- {beat.get('label')}: {beat.get('visual_idea')}\n"
                beat_context += "(Use these ideas if they match the current narration text)\n"

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
            
            user_prompt = HTML_GENERATION_USER_PROMPT_TEMPLATE.format(
                index=seg["index"],
                start=seg["start"],
                end=seg["end"],
                text=seg["text"],
                style_context=style_context,
                beat_context=beat_context,
                safe_area=HTML_GENERATION_SAFE_AREA,
                language=language,
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
                    raw = self.html_client.chat(
                        messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
                        temperature=0.7,  # Lower temperature for more consistent JSON output
                        max_tokens=12000,
                    )
                    data = self._parse_html_response(raw, seg, run_dir)
                    shot_entries = self._expand_shots(seg, data)
                    if not shot_entries:
                        raise RuntimeError(f"HTML model did not return any usable shots for segment {seg.get('index')}.")
                    base_start = float(seg["start"])
                    base_end = float(seg["end"])
                    self._ensure_segment_coverage(shot_entries, seg, base_start, base_end)
                    self._apply_layout_to_entries(shot_entries, seg)
                    return shot_entries
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
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(4, len(segments) or 1)) as executor:
            future_map = {executor.submit(task, seg): seg for seg in segments}
            for future in concurrent.futures.as_completed(future_map):
                seg = future_map[future]
                result_entries = future.result()
                results.extend(result_entries)
        results.sort(key=lambda item: item["start"])
        return results

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
            
            fallback = self._fallback_html_payload(raw)
            if fallback:
                print(
                    f"⚠️  Using fallback markup for segment {seg.get('index')}."
                )
                return fallback
            raise RuntimeError(
                f"Unable to parse HTML JSON for segment {seg.get('index')} (raw saved to {debug_path})"
            )

    def _fallback_html_payload(self, raw: str) -> Dict[str, Any]:
        stripped = self._strip_code_fences(raw)
        if stripped.startswith("{") and stripped.rstrip().endswith("}"):
            try:
                data = json.loads(stripped)
                if isinstance(data, dict) and "html" in data:
                    return data
            except json.JSONDecodeError:
                pass
        if "<" not in stripped or ">" not in stripped:
            return {}
        html = stripped
        return {
            "shots": [
                {
                    "offsetSeconds": 0,
                    "durationSeconds": 999,
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
        """
        if not html:
            return ""
            
        # 1. Fix Mermaid arrows (naive global replace is risky but usually safe for arrows)
        # We target specific unicode arrows often used by LLMs
        # Right arrow
        html = re.sub(r'([=-])\s*[→⇒]\s*', r'\1->', html)  # e.g., -→ to -->
        html = re.sub(r'[→⇒]>', '-->', html)               # e.g., →> to -->
        html = html.replace('→', '-->')
        html = html.replace('⇒', '==>')
        
        # 2. Fix "In In In" garbage
        # Regex to match lines that are mostly "In" repeated
        # pattern: line start, (In\s+){3,}, line end
        def clean_garbage(match):
            line = match.group(0)
            # If line is > 50% "In ", nuke it
            if line.count("In ") / max(1, len(line)/3) > 0.5:
                return ""
            return line

        # Apply to text content nodes? Hard with regex.
        # Let's just target obvious patterns in the string regardless of tags for now.
        # "In In In In"
        # 2. Fix "In In In" garbage
        html = re.sub(r'(?:\bIn\s+){3,}\bIn', '', html)
        
        # 3. Sanitize attribute artifacts: class="]mermaid[" -> class="mermaid"
        html = re.sub(r'=(["\'])\](.*?)\[\1', r'=\1\2\1', html)

        # 4. Remove potentially dangerous/garbage non-ascii characters
        # But keep common useful ones like smart quotes if possible? 
        # Actually, for correctness in code/Mermaid, strict ASCII is safer.
        # Ideally we allow UTF-8 but LLM outputting corrupted ligatures is the issue.
        # Let's strip non-ascii.
        html = re.sub(r'[^\x00-\x7F]+', ' ', html)
        
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

        return html 
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

            pass

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
        return max(0.25, duration)

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

    def _ensure_fonts(self, html: str) -> str:
        # Get colors based on background_type
        bg_type = getattr(self, '_current_background_type', 'white')
        preset = BACKGROUND_PRESETS.get(bg_type, BACKGROUND_PRESETS["white"])
        
        text_color = preset["text"]
        text_secondary = preset["text_secondary"]
        primary_color = preset["primary"]
        accent_color = preset["accent"]
        
        # Common educational styles (Highlighting, Markers)
        global_css = f"""<style>
            @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;900&family=Inter:wght@400;600&family=Fira+Code&display=swap');
            
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

    def _process_generated_images(self, html_segments: List[Dict[str, Any]], run_dir: Path) -> List[Dict[str, Any]]:
        """
        Scan generated HTML for <img data-img-prompt="..."> tags, generate images via Gemini,
        save them to disk, and update the src attribute.
        """
        images_dir = run_dir / "generated_images"
        images_dir.mkdir(parents=True, exist_ok=True)
        
        # Check if Gemini API key is available
        if not self.gemini_image_api_key:
            print("    ⚠️  No Gemini API key configured. Skipping image generation.")
            return html_segments
        
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
            for match in matches:
                full_tag = match.group(1)
                prompt = match.group(3)
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
            return html_segments

        print(f"    Found {len(tasks)} images to generate from {segments_with_images} segments.")
        
        def process_image_task(task):
            prompt = task["prompt"]
            idx = task["seg_idx"]
            
            # Generate
            print(f"    🎨 Generating image {idx}: {prompt[:50]}...")
            image_bytes = self._call_image_generation_llm(prompt)
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
                    "filename": filename
                }
            except Exception as e:
                print(f"    ❌ Failed to save image {filename}: {e}")
                return None

        replacements = {}
        successful_generations = 0
        failed_generations = 0
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            futures = [executor.submit(process_image_task, t) for t in tasks]
            for f in concurrent.futures.as_completed(futures):
                res = f.result()
                if res:
                    successful_generations += 1
                    entry_id = res["entry_id"]
                    if entry_id not in replacements:
                        replacements[entry_id] = []
                    replacements[entry_id].append(res)
                else:
                    failed_generations += 1
        
        print(f"    📊 Image generation summary: {successful_generations} successful, {failed_generations} failed out of {len(tasks)} total")
        
        if successful_generations == 0:
            print("    ⚠️  No images were successfully generated. HTML will retain placeholder images.")
            return html_segments
        
        # Apply replacements - use a more robust matching strategy
        replacements_applied = 0
        for entry in html_segments:
            entry_id = id(entry)
            html = entry.get("html", "")
            original_html = html
            
            if entry_id in replacements:
                for rep in replacements[entry_id]:
                    old_tag = rep["full_tag"]
                    # Convert path to string and normalize for file:// URL (use forward slashes)
                    path_str = str(rep['new_src']).replace('\\', '/')  # Normalize Windows paths to forward slashes
                    new_src = f"file://{path_str}"
                    
                    # Strategy 1: Direct tag replacement (most reliable)
                    if old_tag in html:
                        # Replace src attribute in the tag
                        new_tag = re.sub(r'src=["\'][^"\']*["\']', f'src="{new_src}"', old_tag)
                        html = html.replace(old_tag, new_tag)
                        replacements_applied += 1
                        print(f"    ✅ Replaced image tag in entry {entry_id}: {old_tag[:50]}... -> {new_src[:50]}...")
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
                                print(f"    ✅ Replaced image tag by prompt match: {prompt_value[:30]}... -> {new_src[:50]}...")
            
            if html != original_html:
                entry["html"] = html
        
        print(f"    📝 Applied {replacements_applied} image replacements to HTML segments")
        return html_segments

    @retry_with_backoff(max_retries=3, initial_delay=1.0)
    def _call_image_generation_llm(self, prompt: str, width: int = 1920, height: int = 1080) -> Optional[bytes]:
        """
        Generate image using Google Generative AI (Gemini).
        """
        try:
            if not self.gemini_image_api_key:
                print(f"    ⚠️ No Gemini API key for images. Cannot generate: {prompt[:50]}...")
                return None
                
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key={self.gemini_image_api_key}"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "imageConfig": {"aspectRatio": "16:9"},
                    "responseModalities": ["IMAGE"]
                }
            }
            
            req = urllib.request.Request(
                url, 
                data=json.dumps(payload).encode("utf-8"), 
                headers=headers, 
                method="POST"
            )
            
            with urllib.request.urlopen(req, timeout=60) as response:
                if response.status != 200:
                    print(f"Gemini API error: {response.status}")
                    return None
                raw = response.read().decode("utf-8")
                data = json.loads(raw)

            # Check for inlineData
            # 1. Direct inlineData (rare for this endpoint structure but checked in snippet)
            if "inlineData" in data:
                b64 = data["inlineData"].get("data")
                if b64:
                    return base64.b64decode(b64)
            
            # 2. Candidates
            if "candidates" in data and data["candidates"]:
                candidate = data["candidates"][0]
                if "content" in candidate and "parts" in candidate["content"]:
                    for part in candidate["content"]["parts"]:
                        if "inlineData" in part:
                            b64 = part["inlineData"].get("data")
                            if b64:
                                return base64.b64decode(b64)
            
            return None

        except Exception as e:
            print(f"    ❌ Gemini image generation exception for prompt '{prompt[:50]}...': {str(e)}")
            import traceback
            print(f"    📋 Error details: {traceback.format_exc()[:500]}")  # Limit traceback length
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
    def _write_timeline(html_segments: List[Dict[str, Any]], run_dir: Path) -> Path:
        timeline_entries: List[Dict[str, Any]] = []
        for entry in html_segments:
            start = int(entry.get("index", len(timeline_entries) + 1))
            timeline_entry = {
                "inTime": float(entry["start"]),
                "exitTime": float(entry["end"]),
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
            timeline_entries.append(timeline_entry)
        timeline_path = run_dir / "time_based_frame.json"
        timeline_path.write_text(json.dumps(timeline_entries, indent=2))
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
            "--show-branding",
            "--branding-json",
            str(DEFAULT_BRANDING),
            "--frames-dir",
            str(frames_dir),
            "--background",
            background_color,
        ]
        if show_captions:
            cmd.append("--show-captions")
        if avatar_video_path:
            cmd.extend(["--avatar-video", str(avatar_video_path)])
            
        subprocess.run(cmd, check=True, cwd=REPO_ROOT)
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


