"""
AI Video Generation Service.
Wraps the ai-video-gen pipeline and provides stage-based generation.
"""
from __future__ import annotations

import asyncio
import json
import os
import queue as _queue
import re
import shutil
import sys
import tempfile
import time
from pathlib import Path
from typing import Optional, Dict, Any, AsyncIterator, List
from uuid import uuid4

from ..repositories.ai_video_repository import AiVideoRepository
from .s3_service import S3Service
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..models.ai_token_usage import ApiProvider, RequestType


# TTS unit cost — currently a single rate across providers; if you add per-provider
# TTS billing, move this to the DB the way LLM/image rates already live there.
_TTS_COST_PER_1K_CHARS_USD: float = 0.30  # ElevenLabs standard rate

# Image price is sourced from ai_models.image_price_per_unit (V221+). This default
# applies only if the configured image model is missing from the registry.
_IMAGE_COST_USD_FALLBACK: float = 0.04


def _lookup_image_unit_price(db: Session, image_model_id: Optional[str]) -> float:
    """Resolve per-image USD cost from ai_models, falling back to the constant."""
    if not image_model_id:
        return _IMAGE_COST_USD_FALLBACK
    try:
        row = db.execute(
            text(
                "SELECT image_price_per_unit FROM ai_models "
                "WHERE model_id = :m AND is_active = TRUE LIMIT 1"
            ),
            {"m": image_model_id},
        ).fetchone()
        if row and row.image_price_per_unit is not None:
            return float(row.image_price_per_unit)
    except Exception:
        pass
    return _IMAGE_COST_USD_FALLBACK


# Image generation model used by the video pipeline (OpenRouter route).
_VIDEO_IMAGE_MODEL_ID: str = "bytedance-seed/seedream-4.5"


def _estimate_video_cost_usd(
    db: Session,
    model: Optional[str],
    prompt_tokens: int,
    completion_tokens: int,
    image_count: int,
    tts_character_count: int,
) -> Optional[float]:
    """
    Estimate USD cost for a video generation run by sourcing rates from the
    ai_models table (single source of truth). Returns None if the LLM model is
    unknown — caller should treat that as "estimate unavailable" rather than $0.
    """
    if not model:
        return None
    try:
        row = db.execute(
            text(
                "SELECT input_price_per_1m, output_price_per_1m, is_free "
                "FROM ai_models WHERE model_id = :m AND is_active = TRUE LIMIT 1"
            ),
            {"m": model},
        ).fetchone()
    except Exception:
        return None
    if not row:
        return None
    input_rate = 0.0 if row.is_free else float(row.input_price_per_1m or 0)
    output_rate = 0.0 if row.is_free else float(row.output_price_per_1m or 0)
    llm_cost = (prompt_tokens / 1_000_000) * input_rate + (completion_tokens / 1_000_000) * output_rate
    img_cost = image_count * _lookup_image_unit_price(db, _VIDEO_IMAGE_MODEL_ID)
    tts_cost = (tts_character_count / 1000) * _TTS_COST_PER_1K_CHARS_USD
    return round(llm_cost + img_cost + tts_cost, 4)



class VideoGenerationService:
    """
    Service for AI video generation with stage-based control.
    Supports generating up to specific stages and resuming from checkpoints.
    """
    
    # Stage order for progression
    STAGES = ["PENDING", "SCRIPT", "TTS", "WORDS", "HTML", "AVATAR", "RENDER"]
    
    def __init__(
        self,
        repository: Optional[AiVideoRepository] = None,
        s3_service: Optional[S3Service] = None
    ):
        """Initialize video generation service."""
        import logging
        logger = logging.getLogger(__name__)
        
        self.repository = repository or AiVideoRepository()
        self.s3_service = s3_service or S3Service()
        
        # Path to ai-video-gen-main directory
        self.video_gen_root = Path(__file__).parent.parent / "ai-video-gen-main"
        
        # Ensure the video generation code exists
        if not self.video_gen_root.exists():
            logger.error(f"[VideoGenService] ai-video-gen-main NOT FOUND at {self.video_gen_root}")
            raise RuntimeError(
                f"AI video generation code not found at {self.video_gen_root}. "
                "Please ensure ai-video-gen-main directory is present."
            )
        
        # Pre-download NLTK data if needed (prevents blocking during video generation)
        try:
            import nltk
            import ssl
            # Disable SSL verification for NLTK downloads (common issue on Windows)
            try:
                _create_unverified_https_context = ssl._create_unverified_context
            except AttributeError:
                pass
            else:
                ssl._create_default_https_context = _create_unverified_https_context
            
            # Download required NLTK data silently
            nltk.download('averaged_perceptron_tagger', quiet=True)
            nltk.download('cmudict', quiet=True)
        except Exception as e:
            logger.warning(f"[VideoGenService] Failed to pre-download NLTK data: {e}. Will download on first use.")
    
    async def generate_till_stage(
        self,
        video_id: str,
        prompt: str,
        target_stage: str,
        language: str = "English",
        captions_enabled: bool = True,
        html_quality: str = "advanced",
        resume: bool = False,
        model: Optional[str] = None,
        target_audience: str = "General/Adult",
        target_duration: str = "2-3 minutes",
        voice_gender: str = "female",
        tts_provider: str = "standard",
        voice_id: Optional[str] = None,
        content_type: str = "VIDEO",
        db_session: Optional[Session] = None,
        institute_id: Optional[str] = None,
        user_id: Optional[str] = None,
        generate_avatar: bool = False,
        avatar_image_url: Optional[str] = None,
        quality_tier: str = "ultra",
        reference_files: Optional[list] = None,
        orientation: str = "landscape",
        visual_style: str = "standard",
        sound_effects_enabled: bool = True,
        input_video_id: Optional[str] = None,
        input_video_ids: Optional[list] = None,
        input_video_audio: Optional[str] = None,
        mute_tts_on_source_clips: bool = False,
        background_music_enabled: Optional[bool] = None,
        background_music_volume: Optional[float] = None,
        sub_shots_enabled: bool = False,
        routing_overrides: Optional[Dict[str, Any]] = None,
        host: Optional[Any] = None,
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        Generate video up to a specific stage with SSE progress updates.

        Args:
            video_id: Unique video identifier
            prompt: Text prompt for video generation
            target_stage: Target stage (SCRIPT, TTS, WORDS, HTML, RENDER)
            language: Language for video content
            resume: Whether to resume from existing progress
            target_audience: Target audience for age-appropriate content
            target_duration: Target video duration (e.g., '5 minutes')
            content_type: Type of content (VIDEO, QUIZ, STORYBOOK, etc.)
            quality_tier: Quality tier (free, standard, premium, ultra)
            orientation: Video orientation ('landscape' or 'portrait')
            voice_id: Specific voice ID for premium TTS

        Yields:
            SSE events with progress updates
        """
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"[VideoGenService] generate_till_stage called with video_id={video_id}, target={target_stage}, content_type={content_type}, resume={resume}")
        logger.info(f"[VideoGenService] Prompt: {prompt[:100]}...")
        
        # Validate target stage
        if target_stage not in self.STAGES:
            error_msg = f"Invalid target stage: {target_stage}. Must be one of {self.STAGES}"
            logger.error(f"[VideoGenService] {error_msg}")
            yield {
                "type": "error",
                "message": error_msg
            }
            return

        # Tier-gate the Host feature BEFORE creating any DB record / charging
        # credits. Mirrors the early-fail UX of stage validation above.
        if host is not None and not resume:
            try:
                from .host_planner_service import make_host_plan, HostFeatureError
                from ..config import get_settings as _get_settings
                _settings = _get_settings()
                _early_host_plan = make_host_plan(
                    host,
                    quality_tier=quality_tier,
                    fal_api_key=getattr(_settings, "fal_api_key", None) or "",
                )
                # New host pipeline supersedes the legacy single-PiP avatar.
                # If both `host.type=avatar` and `generate_avatar=true` are set,
                # the new per-shot host already covers the on-screen narrator —
                # running EchoMimic on top would produce a redundant corner PiP.
                # Suppress the legacy path here (mutate the local kwarg) so the
                # rest of the pipeline only sees the new host configuration.
                if _early_host_plan.is_avatar() and generate_avatar:
                    logger.info(
                        "[VideoGenService] host.type=avatar is set — suppressing legacy "
                        "generate_avatar=true (PiP) to avoid double-rendering the host."
                    )
                    generate_avatar = False
            except HostFeatureError as he:
                logger.warning(f"[VideoGenService] Host validation failed: {he}")
                yield {"type": "error", "message": str(he)}
                return

        # Get or create video record
        video_record = self.repository.get_by_video_id(video_id)
        
        if not video_record:
            if resume:
                yield {
                    "type": "error",
                    "message": f"Cannot resume: video_id {video_id} not found"
                }
                return
            
            # Create new record
            gen_metadata = {}
            if institute_id:
                gen_metadata["institute_id"] = institute_id
            if user_id:
                gen_metadata["user_id"] = user_id
            if orientation and orientation != "landscape":
                gen_metadata["orientation"] = orientation
            # Persist visual_style mode so history, resume, and frame regeneration
            # can look up which pipeline mode the video was originally generated with.
            if visual_style and visual_style != "standard":
                gen_metadata["visual_style"] = visual_style
            if quality_tier and quality_tier != "ultra":
                gen_metadata["quality_tier"] = quality_tier
            # Normalize: singular → list (backward compat)
            if input_video_id and not input_video_ids:
                input_video_ids = [input_video_id]
            if input_video_ids:
                gen_metadata["input_video_ids"] = input_video_ids
                gen_metadata["input_video_id"] = input_video_ids[0]  # compat
            if input_video_audio:
                gen_metadata["input_video_audio"] = input_video_audio
            gen_metadata["mute_tts_on_source_clips"] = bool(mute_tts_on_source_clips)
            if background_music_enabled is not None:
                gen_metadata["background_music_enabled"] = bool(background_music_enabled)
            if background_music_volume is not None:
                gen_metadata["background_music_volume"] = float(background_music_volume)
            if sub_shots_enabled:
                gen_metadata["sub_shots_enabled"] = True
            # Persist the TTS voice knobs so per-sentence re-narration in the
            # editor can reproduce the same voice without the user having to
            # re-supply them. Defaults are skipped to keep the row small.
            if voice_gender and voice_gender != "female":
                gen_metadata["voice_gender"] = voice_gender
            if tts_provider and tts_provider != "standard":
                gen_metadata["tts_provider"] = tts_provider
            if voice_id:
                gen_metadata["voice_id"] = voice_id

            video_record = self.repository.create(
                video_id=video_id,
                prompt=prompt,
                language=language,
                content_type=content_type,
                metadata=gen_metadata
            )
            yield {
                "type": "progress",
                "stage": "PENDING",
                "message": f"{content_type} generation initialized",
                "video_id": video_id,
                "content_type": content_type,
                "percentage": 0
            }
        
        # Determine starting stage
        if resume:
            # Start from the stage AFTER the current completed one
            start_stage_idx = self.STAGES.index(video_record.current_stage) + 1
            # If already at or past target, just return current state
            if start_stage_idx > self.STAGES.index(target_stage):
                yield {
                    "type": "info",
                    "message": f"Video already at stage {video_record.current_stage}",
                    "video_id": video_id,
                    "current_stage": video_record.current_stage,
                    "files": video_record.s3_urls
                }
                return
        else:
            start_stage_idx = 1  # Start from SCRIPT
        
        target_stage_idx = self.STAGES.index(target_stage)
        
        # Create temporary working directory
        with tempfile.TemporaryDirectory() as temp_dir:
            work_dir = Path(temp_dir) / video_id
            work_dir.mkdir(parents=True, exist_ok=True)
            
            try:
                # Run pipeline stages
                async for event in self._run_pipeline_stages(
                    video_id=video_id,
                    prompt=prompt,
                    language=language,
                    captions_enabled=captions_enabled,
                    html_quality=html_quality,
                    work_dir=work_dir,
                    start_stage_idx=start_stage_idx,
                    target_stage_idx=target_stage_idx,
                    model=model,
                    target_audience=target_audience,
                    target_duration=target_duration,
                    voice_gender=voice_gender,
                    tts_provider=tts_provider,
                    voice_id=voice_id,
                    content_type=content_type,
                    db_session=db_session,
                    institute_id=institute_id,
                    user_id=user_id,
                    generate_avatar=generate_avatar,
                    avatar_image_url=avatar_image_url,
                    quality_tier=quality_tier,
                    reference_files=reference_files,
                    orientation=orientation,
                    visual_style=visual_style,
                    sound_effects_enabled=sound_effects_enabled,
                    input_video_ids=input_video_ids,
                    input_video_audio=input_video_audio,
                    mute_tts_on_source_clips=mute_tts_on_source_clips,
                    background_music_enabled=background_music_enabled,
                    background_music_volume=background_music_volume,
                    sub_shots_enabled=sub_shots_enabled,
                    routing_overrides=routing_overrides,
                    host=host,
                ):
                    # If we get an error event, refund credits and stop
                    if event.get("type") == "error":
                        logger.error(f"[VideoGenService] Error event received: {event.get('message', 'Unknown error')}")
                        # Refund all credits charged for this failed video
                        if institute_id and db_session:
                            try:
                                from .token_usage_service import TokenUsageService
                                TokenUsageService(db_session).refund_video_credits(video_id, institute_id)
                            except Exception as refund_err:
                                logger.error(f"[VideoGenService] Failed to refund credits for video {video_id}: {refund_err}")
                        yield event
                        return
                    yield event
                
                # Final completion event
                video_record = self.repository.get_by_video_id(video_id)
                if video_record and video_record.status != "FAILED":
                    yield {
                        "type": "completed",
                        "message": f"Generation completed up to {target_stage}",
                        "video_id": video_id,
                        "current_stage": video_record.current_stage,
                        "files": video_record.s3_urls,
                        "file_ids": video_record.file_ids,
                        "percentage": 100
                    }
            
            except Exception as e:
                import traceback
                error_traceback = traceback.format_exc()
                error_msg = str(e)
                logger.error(f"[VideoGenService] Exception in generate_till_stage: {error_msg}")
                logger.error(f"[VideoGenService] Full traceback:\n{error_traceback}")
                
                # Mark as failed
                self.repository.mark_failed(
                    video_id=video_id,
                    error_message=error_msg
                )
                # Refund all credits charged for this failed video
                if institute_id and db_session:
                    try:
                        from .token_usage_service import TokenUsageService
                        TokenUsageService(db_session).refund_video_credits(video_id, institute_id)
                    except Exception as refund_err:
                        logger.error(f"[VideoGenService] Failed to refund credits for video {video_id}: {refund_err}")
                yield {
                    "type": "error",
                    "message": f"Generation failed: {error_msg}",
                    "video_id": video_id
                }
    
    async def _run_pipeline_stages(
        self,
        video_id: str,
        prompt: str,
        language: str,
        captions_enabled: bool,
        html_quality: str,
        work_dir: Path,
        start_stage_idx: int,
        target_stage_idx: int,
        model: Optional[str] = None,
        target_audience: str = "General/Adult",
        target_duration: str = "2-3 minutes",
        voice_gender: str = "female",
        tts_provider: str = "standard",
        voice_id: Optional[str] = None,
        content_type: str = "VIDEO",
        db_session: Optional[Session] = None,
        institute_id: Optional[str] = None,
        user_id: Optional[str] = None,
        generate_avatar: bool = False,
        avatar_image_url: Optional[str] = None,
        quality_tier: str = "ultra",
        reference_files: Optional[list] = None,
        orientation: str = "landscape",
        visual_style: str = "standard",
        sound_effects_enabled: bool = True,
        input_video_ids: Optional[list] = None,
        input_video_audio: Optional[str] = None,
        mute_tts_on_source_clips: bool = False,
        background_music_enabled: Optional[bool] = None,
        background_music_volume: Optional[float] = None,
        sub_shots_enabled: bool = False,
        routing_overrides: Optional[Dict[str, Any]] = None,
        host: Optional[Any] = None,
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        Run the video generation pipeline stages with real-time DB updates.

        Yields:
            Progress events for each stage
        """
        import asyncio
        from concurrent.futures import ThreadPoolExecutor
        
        # Import the automation pipeline
        sys.path.insert(0, str(self.video_gen_root))
        
        try:
            from automation_pipeline import VideoGenerationPipeline
        except ImportError as e:
            raise RuntimeError(f"Failed to import video generation pipeline: {e}")
        
        # Initialize pipeline - get API key from settings
        import logging
        logger = logging.getLogger(__name__)
        
        from ..config import get_settings
        settings = get_settings()
        openrouter_key = settings.openrouter_api_key

        if not openrouter_key:
            error_msg = "OPENROUTER_API_KEY not set in environment. Please add it to your .env.stage file."
            logger.error(f"[VideoGenService] {error_msg}")
            raise ValueError(error_msg)

        # Prepare pipeline arguments. Image generation now runs through OpenRouter
        # (bytedance-seed/seedream-4.5); stock photos/videos come from Pexels and Pixabay.
        pipeline_args = {
            "openrouter_key": openrouter_key,
            "pexels_api_keys": settings.pexels_api_keys or "",
            "pixabay_api_keys": settings.pixabay_api_keys or "",
            "runs_dir": work_dir.parent,
            "quality_tier": quality_tier,
        }

        # Resolve model: use explicit model, or pick from DB based on defaults
        resolved_model = model
        if not resolved_model:
            try:
                from ..services.ai_models_service import AIModelsService
                if db_session:
                    resolved_model = AIModelsService(db_session).get_models_for_use_case("video").default_model_id
                    logger.info(f"[VideoGenService] Auto-selected default model '{resolved_model}' for video generation")
            except Exception as e:
                logger.warning(f"[VideoGenService] Failed to auto-select model from defaults: {e}")

        # Tier-aware model routing: free/standard/premium use a cheap flash model for
        # script + shot HTML; ultra/super_ultra keep the full resolved model for everything.
        _TIER_FLASH_MODEL = "google/gemini-3-flash-preview"
        _FLASH_TIERS = {"free", "standard", "premium"}

        if resolved_model:
            if quality_tier in _FLASH_TIERS:
                # Director (premium) stays on resolved_model — only script + shots use flash
                pipeline_args["script_model"] = _TIER_FLASH_MODEL
                pipeline_args["html_model"]   = _TIER_FLASH_MODEL
            else:
                pipeline_args["script_model"] = resolved_model
                pipeline_args["html_model"]   = resolved_model

        pipeline = VideoGenerationPipeline(**pipeline_args)
        
        # Fetch branding and style configuration from institute settings
        branding_config = None
        style_config = None
        if institute_id and db_session:
            try:
                from .institute_settings_service import InstituteSettingsService
                settings_service = InstituteSettingsService(db_session)
                branding_result = settings_service.get_video_branding(institute_id)
                branding_config = branding_result.get("branding")
                if branding_result.get("has_custom_branding"):
                    logger.info(f"[VideoGenService] Using custom branding for institute {institute_id}")
                else:
                    logger.info(f"[VideoGenService] Using default Vacademy branding for institute {institute_id}")
                style_result = settings_service.get_video_style(institute_id)
                # Only apply style overrides when the org has explicitly saved a custom style.
                # Passing default values would silently override pipeline presets (e.g. accent
                # colors, fonts) even when the org never touched the settings.
                if style_result.get("has_custom_style"):
                    style_config = style_result.get("style")
                    logger.info(f"[VideoGenService] Using custom video style for institute {institute_id}")
                else:
                    logger.info(f"[VideoGenService] No custom video style for institute {institute_id}, using pipeline defaults")
            except Exception as e:
                logger.warning(f"[VideoGenService] Could not fetch branding/style config: {e}. Using defaults.")
        
        # Map stage indices to pipeline stage names and file keys
        stage_config = {
            1: {"name": "script", "file_key": "script", "file_name": "script.txt"},
            2: {"name": "tts", "file_key": "audio", "file_name": "narration.mp3"},
            3: {"name": "words", "file_key": "words", "file_name": "narration.words.json"},
            4: {"name": "html", "file_key": "timeline", "file_name": "time_based_frame.json"},
            5: {"name": "avatar", "file_key": "avatar", "file_name": "avatar_video.mp4"},
            6: {"name": "render", "file_key": "video", "file_name": "output.mp4"}
        }
        
        # Determine start_from and stop_at parameters
        # When resuming, start_from should be the stage we're resuming FROM (which we've already completed)
        # The pipeline will skip that stage and continue to the next one
        start_from = stage_config[start_stage_idx]["name"]
        stop_at = stage_config[target_stage_idx]["name"]  # Stop at target stage (e.g., "html")
        
        # Special handling: if we're resuming from SCRIPT and want to generate TTS,
        # we need to ensure script.txt exists in the run directory
        # The pipeline's logic: if start_from="script", it skips script generation and requires script.txt
        # Then it checks if do_tts is True (which it should be if stop_at is after tts)
        # If do_tts is True, it generates TTS; if False, it requires narration_raw.json
        # So the issue might be that do_tts is incorrectly False
        # Let's ensure the pipeline understands we want to generate TTS by checking the logic
        logger.info(f"[VideoGenService] Pipeline stage mapping: start_from={start_from} (stage_idx={start_stage_idx}), stop_at={stop_at} (stage_idx={target_stage_idx})")
        
        # Validate parameters before calling pipeline
        if html_quality not in ["classic", "advanced"]:
            logger.warning(f"[VideoGenService] Invalid html_quality '{html_quality}', defaulting to 'advanced'")
            html_quality = "advanced"
        
        # Ensure language is a string
        if not isinstance(language, str):
            language = str(language) if language else "English"
        
        # Ensure captions_enabled is a boolean
        if not isinstance(captions_enabled, bool):
            captions_enabled = bool(captions_enabled)
        
        logger.info(f"[VideoGenService] Validated parameters: start_from={start_from}, stop_at={stop_at}, language={language}, captions={captions_enabled}, html_quality={html_quality}")
        
        # If resuming, download required files from S3 to work directory
        # The pipeline expects files from previous stages to exist in the run directory
        # Pipeline creates run_dir at runs_dir / video_id, where runs_dir = work_dir.parent
        # So run_dir = work_dir.parent / video_id
        video_record = self.repository.get_by_video_id(video_id)
        if video_record and start_stage_idx >= 1:  # Resuming from SCRIPT or later
            logger.info(f"[VideoGenService] Resuming from stage {start_stage_idx}, downloading required files from S3...")
            
            # Pipeline creates run_dir at work_dir.parent / video_id
            # Create it here to ensure files are in the right place
            run_dir = work_dir.parent / video_id
            run_dir.mkdir(parents=True, exist_ok=True)
            logger.info(f"[VideoGenService] Using run_dir: {run_dir}")
            
            # Always need script.txt if resuming from SCRIPT or later (pipeline skips script generation when resuming)
            if start_stage_idx >= 1:  # SCRIPT, TTS, WORDS, HTML, or RENDER
                script_url = video_record.s3_urls.get("script")
                if script_url:
                    script_path = run_dir / "script.txt"
                    if not script_path.exists():
                        logger.info(f"[VideoGenService] Downloading script.txt from S3...")
                        if self.s3_service.download_file(script_url, script_path):
                            logger.info(f"[VideoGenService] Successfully downloaded script.txt")
                        else:
                            logger.warning(f"[VideoGenService] Failed to download script.txt from {script_url}")

                # Also pull `script_plan.json` (internal — not stored in DB
                # s3_urls). Without this, the resume path loads `plan_data = {}`
                # and the Director skips with "missing script or beat outline".
                # The plan is uploaded by the SCRIPT stage; we reconstruct the
                # public S3 URL from convention.
                try:
                    from ..config import get_settings
                    settings = get_settings()
                    bucket = settings.aws_bucket_name or settings.aws_s3_public_bucket
                    plan_key = f"ai-videos/{video_id}/script/script_plan.json"
                    plan_url = f"https://{bucket}.s3.amazonaws.com/{plan_key}"
                    plan_local = run_dir / "script_plan.json"
                    if not plan_local.exists():
                        logger.info(f"[VideoGenService] Attempting to download script_plan.json from S3...")
                        if self.s3_service.download_file(plan_url, plan_local):
                            logger.info(f"[VideoGenService] Successfully downloaded script_plan.json")
                        else:
                            logger.info(
                                f"[VideoGenService] script_plan.json not found in S3 "
                                f"(legacy run? Director will use a synthesized fallback beat)"
                            )
                except Exception as e:
                    logger.warning(f"[VideoGenService] Could not download script_plan.json: {e}")
            
            # Need narration_raw.json and narration.mp3 if resuming from WORDS or later
            if start_stage_idx >= 3:  # WORDS, HTML, or RENDER
                # Note: narration_raw.json might not be in S3 yet (it's an intermediate file)
                # We'll try to download it, but if it doesn't exist, the pipeline should generate TTS
                audio_url = video_record.s3_urls.get("audio")
                if audio_url:
                    audio_path = run_dir / "narration.mp3"
                    if not audio_path.exists():
                        logger.info(f"[VideoGenService] Downloading narration.mp3 from S3...")
                        if self.s3_service.download_file(audio_url, audio_path):
                            logger.info(f"[VideoGenService] Successfully downloaded narration.mp3")
                        else:
                            logger.warning(f"[VideoGenService] Failed to download narration.mp3 from {audio_url}")
                
                # Try to download narration_raw.json if it exists in S3
                # This file is saved during TTS generation but might not be in S3 yet
                # We'll construct the S3 key and try to download it
                try:
                    from ..config import get_settings
                    settings = get_settings()
                    bucket = settings.aws_bucket_name or settings.aws_s3_public_bucket
                    narration_raw_key = f"ai-videos/{video_id}/audio/narration_raw.json"
                    narration_raw_url = f"https://{bucket}.s3.amazonaws.com/{narration_raw_key}"
                    narration_raw_path = run_dir / "narration_raw.json"
                    if not narration_raw_path.exists():
                        logger.info(f"[VideoGenService] Attempting to download narration_raw.json from S3...")
                        if self.s3_service.download_file(narration_raw_url, narration_raw_path):
                            logger.info(f"[VideoGenService] Successfully downloaded narration_raw.json")
                        else:
                            logger.info(f"[VideoGenService] narration_raw.json not found in S3 (this is OK if TTS needs to be regenerated)")
                except Exception as e:
                    logger.warning(f"[VideoGenService] Could not download narration_raw.json: {e}")
            
            # Need words files if resuming from HTML or later
            if start_stage_idx >= 4:  # HTML or RENDER
                words_url = video_record.s3_urls.get("words")
                if words_url:
                    words_path = run_dir / "narration.words.json"
                    if not words_path.exists():
                        logger.info(f"[VideoGenService] Downloading narration.words.json from S3...")
                        if self.s3_service.download_file(words_url, words_path):
                            logger.info(f"[VideoGenService] Successfully downloaded narration.words.json")

                # Download shot checkpoints for intra-HTML-stage resume (director plan + per-shot cache)
                try:
                    from ..config import get_settings as _get_settings_ckpt
                    _ckpt_settings = _get_settings_ckpt()
                    _ckpt_bucket = _ckpt_settings.aws_bucket_name or _ckpt_settings.aws_s3_public_bucket
                    _ckpt_prefix = f"ai-videos/{video_id}/checkpoints"
                    _ckpt_base_url = f"https://{_ckpt_bucket}.s3.amazonaws.com/{_ckpt_prefix}"

                    # style_guide.json
                    _sg_local = run_dir / "style_guide.json"
                    if not _sg_local.exists():
                        self.s3_service.download_file(f"{_ckpt_base_url}/style_guide.json", _sg_local)

                    # director_plan.json
                    _dp_local = run_dir / "director_plan.json"
                    if not _dp_local.exists():
                        self.s3_service.download_file(f"{_ckpt_base_url}/director_plan.json", _dp_local)

                    # Per-shot cache files (shot_000.json … shot_NNN.json)
                    _shot_cache_local = run_dir / "shot_cache"
                    _shot_cache_local.mkdir(exist_ok=True)
                    _downloaded_shots = 0
                    for _shot_idx in range(200):  # max 200 shots
                        _sc_key = f"{_ckpt_base_url}/shot_cache/shot_{_shot_idx:03d}.json"
                        _sc_local = _shot_cache_local / f"shot_{_shot_idx:03d}.json"
                        if _sc_local.exists():
                            _downloaded_shots += 1
                            continue
                        if not self.s3_service.download_file(_sc_key, _sc_local):
                            break  # No more shot cache files
                        _downloaded_shots += 1
                    if _downloaded_shots:
                        logger.info(f"[VideoGenService] Downloaded {_downloaded_shots} shot checkpoints for {video_id}")
                except Exception as _ckpt_dl_err:
                    logger.info(f"[VideoGenService] No shot checkpoints found or download failed (new run): {_ckpt_dl_err}")

            # Need branding_meta.json for render stage (audio delay)
            if start_stage_idx >= 5:  # RENDER
                branding_meta_url = video_record.s3_urls.get("branding_meta")
                if branding_meta_url:
                    branding_meta_path = run_dir / "branding_meta.json"
                    if not branding_meta_path.exists():
                        logger.info(f"[VideoGenService] Downloading branding_meta.json from S3...")
                        if self.s3_service.download_file(branding_meta_url, branding_meta_path):
                            logger.info(f"[VideoGenService] Successfully downloaded branding_meta.json")
        
        # ── Intent router + Video-type classifier — pre-script preamble ──
        # Both run once per fresh video (gate <=1 because new videos start at
        # stage_idx=1 — PENDING is never entered, so ==0 would dead-code these).
        # They share inputs and have no mutual dependency, so we fan them out
        # in parallel and pay only the slower call's wall-clock.
        from ..schemas.routing import HostPlan, RoutingPlan, VideoTypePlan
        routing_plan = RoutingPlan()  # safe default
        video_type_plan = VideoTypePlan()  # safe default ("explainer", education)
        host_plan = HostPlan(enabled=False)  # safe default
        if start_stage_idx <= 1 and prompt:
            try:
                import asyncio as _asyncio
                from .intent_router_service import IntentRouterService, apply_overrides
                from .video_type_classifier_service import (
                    VideoTypeClassifierService,
                    apply_user_override as apply_video_type_override,
                )
                from .web_content_capture_service import extract_urls
                urls_found = extract_urls(prompt, max_urls=5)
                router_svc = IntentRouterService(openrouter_key=openrouter_key)
                type_svc = VideoTypeClassifierService(openrouter_key=openrouter_key)

                # User can pre-pick a type via routing_overrides.video_type — wins
                # over LLM classification (mirrors how tool overrides work today).
                user_type_override = None
                if isinstance(routing_overrides, dict):
                    user_type_override = routing_overrides.get("video_type")

                routing_plan, video_type_plan = await _asyncio.gather(
                    router_svc.route(
                        prompt=prompt,
                        input_video_count=len(input_video_ids or []),
                        attached_file_count=len(reference_files or []),
                        urls_in_prompt=urls_found,
                        orientation=orientation,
                        content_type=content_type,
                    ),
                    type_svc.classify(
                        prompt=prompt,
                        input_video_count=len(input_video_ids or []),
                        attached_file_count=len(reference_files or []),
                        urls_in_prompt=urls_found,
                        orientation=orientation,
                        content_type=content_type,
                        target_duration=target_duration,
                    ),
                )
                routing_plan = apply_overrides(routing_plan, routing_overrides)
                video_type_plan = apply_video_type_override(video_type_plan, user_type_override)
                (run_dir / "routing_plan.json").write_text(
                    routing_plan.model_dump_json(indent=2), encoding="utf-8"
                )
                (run_dir / "video_type.json").write_text(
                    video_type_plan.model_dump_json(indent=2), encoding="utf-8"
                )
                logger.info(f"[VideoGenService] Routing plan: {routing_plan.explanation}")
                logger.info(
                    f"[VideoGenService] Video type: {video_type_plan.type} "
                    f"(cadence={video_type_plan.cadence_hint}, "
                    f"conf={video_type_plan.confidence:.2f}) — {video_type_plan.reason}"
                )

                # Host plan (no LLM call — pure validation + normalisation).
                # Tier-gate already passed at the top of generate_till_stage,
                # so any failure here is a programmer error and we re-raise.
                if host is not None:
                    try:
                        from .host_planner_service import make_host_plan
                        from ..config import get_settings as _get_settings_inner
                        host_plan = make_host_plan(
                            host,
                            quality_tier=quality_tier,
                            fal_api_key=getattr(_get_settings_inner(), "fal_api_key", None) or "",
                        )
                        (run_dir / "host_plan.json").write_text(
                            host_plan.model_dump_json(indent=2), encoding="utf-8"
                        )
                        if host_plan.enabled:
                            _hp_summary = (
                                f"avatar model={host_plan.avatar.avatar_model} q={host_plan.avatar.quality}"
                                if host_plan.is_avatar() and host_plan.avatar
                                else (
                                    f"raw input_videos={len(host_plan.raw.input_video_ids) if host_plan.raw else 0}"
                                    if host_plan.is_raw()
                                    else "(unknown)"
                                )
                            )
                            logger.info(
                                f"[VideoGenService] Host plan: type={host_plan.type} "
                                f"pct={host_plan.host_in_video_percentage}% — {_hp_summary}"
                            )
                    except Exception as he:
                        logger.warning(f"[VideoGenService] Host plan failed (non-fatal): {he}")
            except Exception as e:
                logger.warning(f"[VideoGenService] Pre-script preamble failed (non-fatal): {e}")
        else:
            cached_plan = run_dir / "routing_plan.json"
            if cached_plan.exists():
                try:
                    routing_plan = RoutingPlan.model_validate_json(cached_plan.read_text(encoding="utf-8"))
                except Exception as e:
                    logger.warning(f"[VideoGenService] Cached routing plan unreadable: {e}")
            cached_type = run_dir / "video_type.json"
            if cached_type.exists():
                try:
                    video_type_plan = VideoTypePlan.model_validate_json(cached_type.read_text(encoding="utf-8"))
                except Exception as e:
                    logger.warning(f"[VideoGenService] Cached video_type unreadable: {e}")
            cached_host = run_dir / "host_plan.json"
            if cached_host.exists():
                try:
                    host_plan = HostPlan.model_validate_json(cached_host.read_text(encoding="utf-8"))
                except Exception as e:
                    logger.warning(f"[VideoGenService] Cached host_plan unreadable: {e}")

        # ── Web capture (only if router enabled scrape_url) ──
        # Artifacts are captured into _scrape_artifacts so we can persist them
        # to extra_metadata.intent_outcomes for later quality analysis (e.g.
        # the Telangana run where scrape returned thin content).
        captured_text_context = ""
        _scrape_artifacts: Optional[Dict[str, Any]] = None
        if start_stage_idx <= 1 and prompt and routing_plan.is_tool_enabled("scrape_url"):
            try:
                from .web_content_capture_service import WebContentCaptureService, extract_urls
                urls = extract_urls(prompt, max_urls=2)
                if urls:
                    logger.info(f"[VideoGenService] scrape_url enabled — capturing {len(urls)} URL(s): {urls}")
                    capture_svc = WebContentCaptureService(s3_service=self.s3_service)
                    captured_files, captured_text_context = await capture_svc.capture_urls(urls, run_dir)
                    if captured_files:
                        reference_files = (reference_files or []) + captured_files
                        logger.info(
                            f"[VideoGenService] Web capture added {len(captured_files)} "
                            f"reference files, {len(captured_text_context)} chars text"
                        )
                    # Snapshot for analysis. Cap text at 4000 chars to keep the
                    # metadata column lean while still preserving enough excerpt
                    # to judge whether the scrape captured the article body.
                    _captured_files_safe = captured_files if isinstance(captured_files, list) else []
                    _scrape_artifacts = {
                        "urls_attempted": urls,
                        "files_captured": _captured_files_safe,
                        "files_count": len(_captured_files_safe),
                        "screenshot_count": sum(1 for f in _captured_files_safe if "screenshot" in (f.get("name") or "")),
                        "inline_image_count": sum(1 for f in _captured_files_safe if "screenshot" not in (f.get("name") or "")),
                        "text_chars": len(captured_text_context or ""),
                        "text_excerpt": (captured_text_context or "")[:4000],
                    }
            except Exception as e:
                logger.warning(f"[VideoGenService] Web capture failed (non-fatal): {e}")
                _scrape_artifacts = {"error": str(e)}

        # ── Web search (only if router enabled web_search) ──
        searched_text_context = ""
        _search_artifacts: Optional[Dict[str, Any]] = None
        if start_stage_idx <= 1 and routing_plan.is_tool_enabled("web_search"):
            try:
                ws_tool = routing_plan.get_tool("web_search")
                query = (ws_tool.params or {}).get("query", "") if ws_tool else ""
                if query:
                    from .web_search_service import WebSearchService, format_search_for_context
                    logger.info(f"[VideoGenService] web_search enabled — query={query!r}")
                    search_svc = WebSearchService(openrouter_key=openrouter_key)
                    result = await search_svc.search(query)
                    searched_text_context = format_search_for_context(result)
                    # Snapshot. Cap synthesized answer at 2000 chars; sources
                    # are already small (host+url+empty snippet).
                    _ans = (result.get("answer") or "") if isinstance(result, dict) else ""
                    _src = result.get("sources") if isinstance(result, dict) else []
                    _search_artifacts = {
                        "query": query,
                        "answer": _ans[:2000],
                        "answer_chars": len(_ans),
                        "sources": _src or [],
                        "sources_count": len(_src or []),
                    }
            except Exception as e:
                logger.warning(f"[VideoGenService] Web search failed (non-fatal): {e}")
                _search_artifacts = {"error": str(e)}

        # ── Resolve mute_tts_on_source_clips from routing plan ──
        # apply_overrides() has already merged any user toggle into routing_plan.config,
        # so it represents the final user+router decision. The legacy kwarg can only force ON
        # (its default is False, indistinguishable from "not set"); the plan wins otherwise.
        if routing_plan.config.mute_tts_on_source_clips and not mute_tts_on_source_clips:
            mute_tts_on_source_clips = True
            logger.info("[VideoGenService] mute_tts_on_source_clips=true per routing plan")

        # ── Persist user_selections + intent_outcomes to extra_metadata ──
        # Snapshot of what the user asked for + what the pre-script preamble
        # decided on their behalf, INCLUDING the raw artifacts produced by
        # scrape_url and web_search. Lets history, debugging, and quality
        # analysis reproduce the exact context the pipeline ran with — without
        # poking at run_dir/*.json files. Only persists for fresh runs (resume
        # paths read the cached run_dir/*.json instead and skip re-classification).
        if start_stage_idx <= 1:
            try:
                _vrec = self.repository.get_by_video_id(video_id)
                _emeta = (_vrec.extra_metadata or {}) if _vrec else {}
                _emeta["user_selections"] = {
                    "prompt": prompt,
                    "content_type": content_type,
                    "quality_tier": quality_tier,
                    "model": model,
                    "target_duration": target_duration,
                    "target_audience": target_audience,
                    "orientation": orientation,
                    "language": language,
                    "voice_gender": voice_gender,
                    "tts_provider": tts_provider,
                    "voice_id": voice_id,
                    "html_quality": html_quality,
                    "captions_enabled": captions_enabled,
                    "generate_avatar": generate_avatar,
                    "avatar_image_url": avatar_image_url,
                    "sound_effects_enabled": sound_effects_enabled,
                    "background_music_enabled": background_music_enabled,
                    "background_music_volume": background_music_volume,
                    "sub_shots_enabled": sub_shots_enabled,
                    "mute_tts_on_source_clips_kwarg": mute_tts_on_source_clips,
                    "input_video_ids": input_video_ids,
                    "input_video_audio": input_video_audio,
                    "reference_files_count": len(reference_files or []),
                    "routing_overrides": routing_overrides,
                }
                _emeta["intent_outcomes"] = {
                    "video_type": video_type_plan.model_dump(),
                    "routing_plan": routing_plan.model_dump(),
                    "tools_enabled": [
                        t.name for t in routing_plan.tools if t.enabled
                    ],
                    "scrape_url_artifacts": _scrape_artifacts,
                    "web_search_artifacts": _search_artifacts,
                }
                # Host snapshot. Inputs come from the HostPlan (post-tier-gate);
                # outputs (per-shot avatar URLs, fal job ids, total seconds) are
                # written by the AvatarBatch sub-stage during HTML generation.
                if host_plan and host_plan.enabled:
                    _hp_dump = host_plan.model_dump()
                    _existing_host = _emeta.get("host") or {}
                    _emeta["host"] = {
                        **_hp_dump,
                        # Preserve any outputs already written by an earlier
                        # AvatarBatch run (resume safety).
                        "outputs": _existing_host.get("outputs", {
                            "host_shot_indices": [],
                            "host_shot_count": 0,
                            "total_host_seconds": 0.0,
                            "shot_artifacts": [],
                            "errors": [],
                        }),
                        "estimated_cost_usd": _existing_host.get("estimated_cost_usd"),
                    }
                self.repository.update_metadata(video_id, _emeta)
            except Exception as _e:
                logger.warning(f"[VideoGenService] Failed to persist selections/outcomes: {_e}")

        # ── Process reference files (images/PDFs) ──
        reference_context = None
        if reference_files:
            try:
                from .reference_file_service import ReferenceFileService
                ref_svc = ReferenceFileService(
                    openrouter_key=openrouter_key,
                    s3_service=self.s3_service,
                )
                # Try cached first (for resume)
                reference_context = ReferenceFileService.load_cached(run_dir)
                if reference_context:
                    logger.info(f"[VideoGenService] Loaded cached reference context from {run_dir}")
                else:
                    logger.info(f"[VideoGenService] Processing {len(reference_files)} reference files...")
                    reference_context = ref_svc.process(reference_files, run_dir)
                    logger.info(
                        f"[VideoGenService] Reference context ready: "
                        f"{len(reference_context.text_context)} chars text, "
                        f"{len(reference_context.embeddable_images)} images"
                    )
            except Exception as e:
                logger.warning(f"[VideoGenService] Reference file processing failed (non-fatal): {e}")
                reference_context = None

        # ── Merge captured page text + web search results into ReferenceContext ──
        extra_text_blocks = [b for b in (captured_text_context, searched_text_context) if b]
        if extra_text_blocks:
            extra_text = "\n\n".join(extra_text_blocks)
            if reference_context:
                reference_context.text_context = (
                    (reference_context.text_context + "\n\n" + extra_text)
                    if reference_context.text_context else extra_text
                )
            else:
                from .reference_file_service import ReferenceContext
                reference_context = ReferenceContext(text_context=extra_text)

        # ── Load indexed input video contexts (if provided) ──
        input_video_contexts = None
        logger.info(f"[VideoGenService] input_video_ids={input_video_ids}, input_video_audio={input_video_audio}")
        if input_video_ids:
            try:
                import json as _json
                from ..repositories.ai_input_video_repository import AiInputVideoRepository
                iv_repo = AiInputVideoRepository(session=db_session)
                iv_records = iv_repo.get_by_ids(input_video_ids)
                logger.info(f"[VideoGenService] Found {len(iv_records)}/{len(input_video_ids)} input videos")

                loaded_contexts = []
                source_video_urls = []
                for idx, iv_record in enumerate(iv_records):
                    if iv_record.status != "COMPLETED" or not iv_record.context_json_url:
                        logger.warning(f"[VideoGenService] Input video {iv_record.id} skipped "
                                       f"(status={iv_record.status})")
                        continue

                    # Download video_context.json
                    context_path = run_dir / f"input_video_context_{idx}.json"
                    if not context_path.exists():
                        context_path.parent.mkdir(parents=True, exist_ok=True)
                        _ctx_url = iv_record.context_json_url
                        _downloaded = False
                        for _bkt in ["vacademy-media-storage", "vacademy-media-storage-public"]:
                            if _bkt in _ctx_url:
                                try:
                                    _parts = _ctx_url.split(f"{_bkt}.s3.amazonaws.com/")
                                    if len(_parts) == 2:
                                        self.s3_service.s3_client.download_file(
                                            _bkt, _parts[1], str(context_path)
                                        )
                                        _downloaded = True
                                        break
                                except Exception:
                                    continue
                        if not _downloaded:
                            import httpx
                            resp = httpx.get(_ctx_url, timeout=60)
                            resp.raise_for_status()
                            context_path.write_bytes(resp.content)

                    # Resolve audio preference
                    _audio_pref = input_video_audio
                    if not _audio_pref:
                        if len(input_video_ids) > 1:
                            _audio_pref = "tts"  # multi-source always TTS
                        else:
                            _audio_pref = "original" if iv_record.mode == "podcast" else "tts"

                    _iv_assets = iv_record.assets_urls or {}
                    ctx = {
                        "index": idx,
                        "context": _json.loads(context_path.read_text()),
                        "source_url": iv_record.source_url,
                        "source_public_url": _iv_assets.get("source_video", ""),
                        "assets_urls": _iv_assets,
                        "input_video_id": str(iv_record.id),
                        "name": iv_record.name or f"Video {idx}",
                        "duration_seconds": iv_record.duration_seconds,
                        "mode": iv_record.mode,
                        "audio_preference": _audio_pref,
                    }
                    loaded_contexts.append(ctx)
                    source_video_urls.append(iv_record.source_url)
                    logger.info(f"[VideoGenService] Loaded input video [{idx}]: "
                                f"{iv_record.name} ({iv_record.duration_seconds:.1f}s, mode={iv_record.mode})")

                if loaded_contexts:
                    input_video_contexts = loaded_contexts
                    # Store in metadata for render endpoint
                    try:
                        video_record = self.repository.get_by_video_id(video_id)
                        if video_record:
                            existing_meta = video_record.extra_metadata or {}
                            existing_meta["source_video_urls"] = source_video_urls
                            existing_meta["input_video_ids"] = input_video_ids
                            # Backward compat: keep singular for old render path
                            existing_meta["source_video_url"] = source_video_urls[0]
                            existing_meta["input_video_id"] = input_video_ids[0]
                            self.repository.update_metadata(video_id, existing_meta)
                    except Exception:
                        pass  # non-fatal
            except Exception as e:
                logger.warning(f"[VideoGenService] Input video context loading failed (non-fatal): {e}")
                input_video_contexts = None

        # Calculate percentage per stage
        total_stages = target_stage_idx - start_stage_idx + 1
        percentage_per_stage = 80 / total_stages if total_stages > 0 else 80  # Save 20% for final processing

        # Update status to IN_PROGRESS at starting stage
        self.repository.update_stage(video_id, self.STAGES[start_stage_idx], "IN_PROGRESS")
        
        yield {
            "type": "progress",
            "stage": self.STAGES[start_stage_idx],
            "message": f"Starting generation from {start_from}",
            "percentage": 5,
            "video_id": video_id
        }
        
        # Setup for pipeline execution
        import asyncio
        import functools
        from concurrent.futures import ThreadPoolExecutor
        
        loop = asyncio.get_event_loop()
        pipeline_error = None
        
        # Map of expected files for each stage
        # Format: (output_key_from_pipeline, file_key_for_db_s3, file_name)
        # file_key is used as the key in s3_urls and file_ids in the database
        file_map = {
            # `script.txt` goes into the DB s3_urls (consumers ask for it).
            # `script_plan.json` is internal — uploaded for resume capability so
            # later stages (TTS/WORDS/HTML) can rehydrate the structured plan
            # (beat_outline, subject_domain, visual_style, key_terms, etc.).
            # Without this, resume at HTML loses the plan and the Director skips.
            "script": [
                ("script_path", "script", "script.txt"),
                (None, None, "script_plan.json"),  # internal — see download path
            ],
            "tts": [
                ("audio_path", "audio", "narration.mp3"),
                # narration_raw.json is uploaded to S3 for resume capability but stored separately
                # We use "audio" stage but different handling to avoid overwriting narration.mp3
                (None, None, "narration_raw.json")  # Upload but don't store in main s3_urls (internal file)
            ],
            "words": [
                ("words_json", "words", "narration.words.json"),
                (None, "alignment", "alignment.json")  # alignment.json (not in outputs dict)
            ],
            "html": [
                (None, "generated_images", "generated_images"),  # Directory - process FIRST to build image mapping
                (None, "branding_meta", "branding_meta.json"),  # Branding metadata for audio delay
                ("timeline_json", "timeline", "time_based_frame.json"),  # Process AFTER images to update URLs
                ("audio_path", "audio", "narration.mp3"),  # Re-upload if audio was mixed with source clips
                ("words_json", "words", "narration.words.json"),  # Re-upload if words were filtered
            ],
            "avatar": [("avatar_video_path", "avatar", "avatar_video.mp4")],
            "render": [("video_path", "video", "output.mp4")]
        }
        
        # Store image path mapping across stages (needed for html stage)
        image_path_mapping = {}  # Maps local file paths to S3 URLs
        
        # Iterate through stages individually
        for stage_idx in range(start_stage_idx, target_stage_idx + 1):
            if pipeline_error:
                logger.warning(f"[VideoGenService] Stopping stage loop due to error in previous stage")
                break

            stage_name = self.STAGES[stage_idx]
            config = stage_config[stage_idx]
            stage_pipeline_name = config["name"]
            
            # Yield progress at start of stage
            # Calculate percentage for start of this stage
            percentage = 5 + int((stage_idx - start_stage_idx) * percentage_per_stage)
            
            # Descriptive message: for HTML stage with Director enabled, show "Planning shots..."
            if stage_pipeline_name == "html" and quality_tier in ("premium", "ultra", "super_ultra"):
                _stage_message = "Planning shots & creating visuals..."
            else:
                _stage_message = f"Processing stage: {stage_pipeline_name.upper()}"

            yield {
                "type": "progress",
                "stage": stage_name,
                "message": _stage_message,
                "percentage": percentage,
                "video_id": video_id
            }
            
            outputs = None
            run_dir = work_dir # Default
            
            try:
                logger.info(f"[VideoGenService] Running pipeline stage: {stage_pipeline_name} (idx {stage_idx})")
                
                # For AVATAR stage: write audio S3 URL hint file so pipeline can pass it to RunPod
                if stage_pipeline_name == "avatar":
                    video_record = self.repository.get_by_video_id(video_id)
                    if video_record:
                        audio_s3_url = video_record.s3_urls.get("audio", "")
                        if audio_s3_url:
                            audio_url_file = run_dir / "audio_s3_url.txt"
                            audio_url_file.write_text(audio_s3_url)
                            logger.info(f"[VideoGenService] Wrote audio S3 URL hint for avatar stage: {audio_s3_url}")
                        else:
                            logger.warning("[VideoGenService] No audio S3 URL found for avatar stage")

                # Derive dimensions from orientation
                _vid_width = 1080 if orientation == "portrait" else 1920
                _vid_height = 1920 if orientation == "portrait" else 1080

                # Thread-safe queue: pipeline thread puts events; async loop drains them
                _prog_queue: _queue.Queue = _queue.Queue()

                def _progress_cb(event: Dict[str, Any]) -> None:
                    _prog_queue.put_nowait(event)

                pipeline_run = functools.partial(
                    pipeline.run,
                    base_prompt=prompt,
                    run_name=video_id,
                    resume_run=None,
                    start_from=stage_pipeline_name,
                    stop_at=stage_pipeline_name,
                    language=language,
                    show_captions=captions_enabled,
                    html_quality=html_quality,
                    target_audience=target_audience,
                    target_duration=target_duration,
                    voice_gender=voice_gender,
                    tts_provider=tts_provider,
                    voice_id=voice_id,
                    branding_config=branding_config,
                    style_config=style_config,
                    content_type=content_type,
                    generate_avatar=generate_avatar,
                    avatar_image_url=avatar_image_url,
                    reference_context=reference_context.to_dict() if reference_context else None,
                    video_width=_vid_width,
                    video_height=_vid_height,
                    visual_style=visual_style,
                    sound_effects_enabled=sound_effects_enabled,
                    input_video_contexts=input_video_contexts,
                    mute_tts_on_source_clips=mute_tts_on_source_clips,
                    background_music_enabled=background_music_enabled,
                    background_music_volume=background_music_volume,
                    sub_shots_enabled=sub_shots_enabled,
                    routing_plan=routing_plan.model_dump() if routing_plan else None,
                    video_type_plan=video_type_plan.model_dump() if video_type_plan else None,
                    host_plan=host_plan.model_dump() if host_plan else None,
                    progress_callback=_progress_cb,
                )

                # Run pipeline in thread while draining the progress queue in the
                # async event loop so sub-stage events reach the SSE client in real time.
                with ThreadPoolExecutor() as executor:
                    _pipeline_future = loop.run_in_executor(executor, pipeline_run)
                    while not _pipeline_future.done():
                        # Drain all queued events without blocking the event loop
                        _drained: List[Dict[str, Any]] = []
                        while not _prog_queue.empty():
                            try:
                                _drained.append(_prog_queue.get_nowait())
                            except _queue.Empty:
                                break
                        for _ev in _drained:
                            # Attach video_id so the FE can correlate without extra state
                            _ev.setdefault("video_id", video_id)
                            # Persist latest generation_progress to DB metadata so
                            # GET /status also reflects sub-stage detail
                            if _ev.get("type") in (
                                "sub_stage", "shot_done", "shot_error"
                            ):
                                try:
                                    self.repository.update_generation_progress(video_id, _ev)
                                except Exception:
                                    pass
                            yield _ev
                        await asyncio.sleep(0.25)
                    # Drain any remaining events after the future completes
                    while not _prog_queue.empty():
                        try:
                            _ev = _prog_queue.get_nowait()
                            _ev.setdefault("video_id", video_id)
                            if _ev.get("type") in (
                                "sub_stage", "shot_done", "shot_error"
                            ):
                                try:
                                    self.repository.update_generation_progress(video_id, _ev)
                                except Exception:
                                    pass
                            yield _ev
                        except _queue.Empty:
                            break
                    outputs = await _pipeline_future
                
                # Record token usage per stage
                if outputs and "token_usage" in outputs and db_session:
                    try:
                        from .token_usage_service import TokenUsageService
                        usage = outputs["token_usage"]
                        has_tokens = usage.get("total_tokens", 0) > 0
                        has_images = usage.get("image_count", 0) > 0
                        has_tts = usage.get("tts_character_count", 0) > 0
                        has_stock = usage.get("stock_count", 0) > 0
                        
                        if has_tokens or has_images or has_tts or has_stock:
                            token_service = TokenUsageService(db_session)
                            provider = ApiProvider.OPENAI
                            if resolved_model and "gemini" in resolved_model.lower():
                                provider = ApiProvider.GEMINI
                                
                            # Deduct for LLM tokens (video request type)
                            if has_tokens:
                                token_service.record_usage_and_deduct_credits(
                                    api_provider=provider,
                                    prompt_tokens=usage.get("prompt_tokens", 0),
                                    completion_tokens=usage.get("completion_tokens", 0),
                                    total_tokens=usage.get("total_tokens", 0),
                                    request_type=RequestType.VIDEO,
                                    institute_id=institute_id,
                                    user_id=user_id,
                                    model=resolved_model or "video-gen-pipeline",
                                    metadata={
                                        "video_id": video_id,
                                        "image_count": usage.get("image_count", 0),
                                        "stage": stage_pipeline_name
                                    },
                                    batch_id=video_id,
                                )
                                logger.info(f"[VideoGenService] Recorded token usage for stage {stage_pipeline_name}: {usage.get('total_tokens')} tokens")

                            # Deduct separately for images generated in this stage
                            _image_count = usage.get("image_count", 0)
                            if _image_count > 0:
                                for _ in range(_image_count):
                                    token_service.record_usage_and_deduct_credits(
                                        api_provider=ApiProvider.GEMINI,
                                        prompt_tokens=0,
                                        completion_tokens=0,
                                        total_tokens=0,
                                        request_type=RequestType.IMAGE,
                                        institute_id=institute_id,
                                        user_id=user_id,
                                        model=resolved_model or "gemini-image-gen",
                                        metadata={"video_id": video_id, "stage": stage_pipeline_name},
                                        batch_id=video_id,
                                    )
                                logger.info(f"[VideoGenService] Deducted credits for {_image_count} images in stage {stage_pipeline_name}")

                            # Deduct separately for stock images & videos
                            _stock_count = usage.get("stock_count", 0)
                            if _stock_count > 0:
                                for _ in range(_stock_count):
                                    token_service.record_usage_and_deduct_credits(
                                        api_provider=ApiProvider.OPENAI,
                                        prompt_tokens=0,
                                        completion_tokens=0,
                                        total_tokens=0,
                                        request_type=RequestType.STOCK,
                                        institute_id=institute_id,
                                        user_id=user_id,
                                        model="pexels-stock-api",
                                        metadata={"video_id": video_id, "stage": stage_pipeline_name},
                                        batch_id=video_id,
                                    )
                                logger.info(f"[VideoGenService] Deducted credits for {_stock_count} stock media insertions in stage {stage_pipeline_name}")

                            # Deduct separately for TTS characters
                            # Use premium pricing (2x) for premium/google/sarvam providers
                            _tts_chars = usage.get("tts_character_count", 0)
                            _is_premium_tts = tts_provider in ("premium", "google", "sarvam")
                            if _tts_chars > 0:
                                _tts_model = "edge-tts"
                                if _is_premium_tts:
                                    # Resolve actual provider: premium + Indian lang → sarvam, else google
                                    _INDIAN = {"hindi", "bengali", "tamil", "telugu", "marathi", "kannada",
                                               "gujarati", "malayalam", "punjabi", "odia", "english (india)"}
                                    _resolved = tts_provider
                                    if tts_provider == "premium":
                                        _resolved = "sarvam" if language.lower().strip() in _INDIAN else "google"
                                    _tts_model = "sarvam-bulbul-v3" if _resolved == "sarvam" else "google-cloud-tts"
                                token_service.record_usage_and_deduct_credits(
                                    api_provider=ApiProvider.GOOGLE_TTS,
                                    prompt_tokens=0,
                                    completion_tokens=0,
                                    total_tokens=0,
                                    request_type=RequestType.TTS_PREMIUM if _is_premium_tts else RequestType.TTS,
                                    institute_id=institute_id,
                                    user_id=user_id,
                                    model=_tts_model,
                                    character_count=_tts_chars,
                                    metadata={"video_id": video_id, "stage": stage_pipeline_name, "tts_provider": tts_provider},
                                    batch_id=video_id,
                                )
                                logger.info(f"[VideoGenService] Deducted {'premium ' if _is_premium_tts else ''}TTS credits for {_tts_chars} chars in stage {stage_pipeline_name}")
                    except Exception as e:
                        logger.warning(f"[VideoGenService] Failed to record token usage: {e}")

                # Persist full token/cost breakdown into video metadata so it's
                # queryable without joining ai_token_usage (used by FE cost display)
                if outputs and "token_usage" in outputs and db_session:
                    try:
                        _usage = outputs["token_usage"]
                        if _usage.get("total_tokens", 0) > 0:
                            from datetime import datetime as _dt
                            _est_cost = _estimate_video_cost_usd(
                                db_session,
                                _usage.get("model"),
                                _usage.get("prompt_tokens", 0),
                                _usage.get("completion_tokens", 0),
                                _usage.get("image_count", 0),
                                _usage.get("tts_character_count", 0),
                            )
                            _video_rec = self.repository.get_by_video_id(video_id)
                            _existing_meta = (_video_rec.extra_metadata or {}) if _video_rec else {}
                            _existing_meta["token_usage"] = {
                                "prompt_tokens": _usage.get("prompt_tokens", 0),
                                "completion_tokens": _usage.get("completion_tokens", 0),
                                "total_tokens": _usage.get("total_tokens", 0),
                                "image_count": _usage.get("image_count", 0),
                                "tts_character_count": _usage.get("tts_character_count", 0),
                                "stock_count": _usage.get("stock_count", 0),
                                "estimated_cost_usd": _est_cost,
                                "model": _usage.get("model"),
                                "recorded_at": _dt.utcnow().isoformat(),
                            }
                            self.repository.update_metadata(video_id, _existing_meta)
                            _cost_str = f"${_est_cost:.4f}" if _est_cost is not None else "unavailable (model not in ai_models)"
                            logger.info(f"[VideoGenService] Saved token_usage to metadata for {video_id}: est. {_cost_str}")
                    except Exception as _me:
                        logger.warning(f"[VideoGenService] Failed to save token_usage to metadata: {_me}")

                if outputs and "run_dir" in outputs:
                    run_dir = outputs["run_dir"]

                # ── Merge host_outputs.json (written by AvatarBatch) into extra_metadata.host ──
                # AvatarBatch persists per-shot artifacts to run_dir/host_outputs.json
                # during the HTML stage. We pull it forward into extra_metadata.host.outputs
                # so analysis / debugging / cost reconciliation can read the full picture
                # without inspecting the run dir. We ALSO deduct credits for the avatar
                # work here, because the standard token-usage deduction loop only knows
                # about LLM tokens / images / stock / TTS — fal.ai per-second avatar and
                # the per-shot Seedream identity images are separate billable units.
                if stage_pipeline_name == "html" and run_dir:
                    _host_out_file = run_dir / "host_outputs.json"
                    if _host_out_file.exists():
                        try:
                            import json as _json_h
                            _host_outputs = _json_h.loads(_host_out_file.read_text(encoding="utf-8"))
                            _vrec_h = self.repository.get_by_video_id(video_id)
                            _emeta_h = (_vrec_h.extra_metadata or {}) if _vrec_h else {}
                            _host_block = _emeta_h.get("host") or {}
                            _host_block["outputs"] = _host_outputs
                            _emeta_h["host"] = _host_block
                            self.repository.update_metadata(video_id, _emeta_h)
                            logger.info(
                                f"[VideoGenService] Merged host_outputs.json into extra_metadata.host.outputs "
                                f"({_host_outputs.get('host_shot_count', 0)} shots, "
                                f"{_host_outputs.get('total_host_seconds', 0):.1f}s)"
                            )

                            # ── Deduct credits for avatar-host work ──
                            # Two separate units:
                            #   1. RequestType.IMAGE — per-shot Seedream identity image
                            #      (one per completed avatar shot). Same rate as any
                            #      other AI image generation.
                            #   2. RequestType.AVATAR_VIDEO — total_host_seconds at the
                            #      avatar model's video_price_per_second.
                            #
                            # Resume-safe: each shot artifact gets a `deducted_at`
                            # timestamp once charged. On resume, we skip artifacts
                            # that already carry one — otherwise a partial AvatarBatch
                            # run that resumes would double-bill the user for the
                            # shots that completed in the prior attempt.
                            if institute_id and db_session:
                                try:
                                    from datetime import datetime as _dt_dh
                                    _all_artifacts = list(_host_outputs.get("shot_artifacts") or [])
                                    _completed_shots = [
                                        a for a in _all_artifacts
                                        if a.get("status") == "completed"
                                    ]
                                    _undeducted_completed = [
                                        a for a in _completed_shots
                                        if not a.get("deducted_at")
                                    ]
                                    _undeducted_seconds = int(round(sum(
                                        float(a.get("duration_s_actual") or a.get("duration_s") or 0)
                                        for a in _undeducted_completed
                                    )))
                                    _host_model = (
                                        (_host_block.get("avatar") or {}).get("avatar_model")
                                        or "fal-ai/kling-video/ai-avatar/v2/standard"
                                    )

                                    if not _undeducted_completed and not _undeducted_seconds:
                                        logger.info(
                                            "[VideoGenService] Host credits already deducted "
                                            "in a prior run — skipping (resume idempotency)."
                                        )
                                    else:
                                        _ts = TokenUsageService(db_session)
                                        _now_iso = _dt_dh.utcnow().isoformat()

                                        # Per-shot Seedream identity image
                                        for _shot_art in _undeducted_completed:
                                            _ts.record_usage_and_deduct_credits(
                                                api_provider=ApiProvider.GEMINI,
                                                prompt_tokens=0,
                                                completion_tokens=0,
                                                total_tokens=0,
                                                request_type=RequestType.IMAGE,
                                                institute_id=institute_id,
                                                user_id=user_id,
                                                model="bytedance-seed/seedream-4.5",
                                                metadata={
                                                    "video_id": video_id,
                                                    "stage": "html",
                                                    "purpose": "host_avatar_identity",
                                                    "shot_index": _shot_art.get("shot_index"),
                                                },
                                                batch_id=video_id,
                                            )
                                            _shot_art["deducted_at"] = _now_iso
                                        # Avatar video seconds — single charge per dedup-run
                                        if _undeducted_seconds > 0:
                                            _ts.record_usage_and_deduct_credits(
                                                api_provider=ApiProvider.OPENAI,
                                                prompt_tokens=0,
                                                completion_tokens=0,
                                                total_tokens=0,
                                                request_type=RequestType.AVATAR_VIDEO,
                                                institute_id=institute_id,
                                                user_id=user_id,
                                                model=_host_model,
                                                metadata={
                                                    "video_id": video_id,
                                                    "stage": "html",
                                                    "host_shot_count": len(_undeducted_completed),
                                                    "quality": (_host_block.get("avatar") or {}).get("quality"),
                                                },
                                                seconds=_undeducted_seconds,
                                                batch_id=video_id,
                                            )

                                        # Persist deducted_at stamps back into extra_metadata.
                                        # _host_block["outputs"] points at the same dict we
                                        # just mutated, so re-saving is sufficient.
                                        _host_block["outputs"]["shot_artifacts"] = _all_artifacts
                                        _emeta_h["host"] = _host_block
                                        self.repository.update_metadata(video_id, _emeta_h)

                                        logger.info(
                                            f"[VideoGenService] Deducted host credits: "
                                            f"{len(_undeducted_completed)} identity images + "
                                            f"{_undeducted_seconds}s of {_host_model}"
                                        )
                                except Exception as _hd_err:
                                    logger.warning(
                                        f"[VideoGenService] Failed to deduct host credits: {_hd_err}"
                                    )
                        except Exception as _hm_err:
                            logger.warning(f"[VideoGenService] Failed to merge host_outputs.json: {_hm_err}")

                # ── Validate required outputs for this stage ──
                # If the pipeline returned but critical output files are missing,
                # treat it as a stage failure instead of silently continuing.
                _required_outputs = {
                    "script": ["script_path"],
                    "tts": ["audio_path"],
                    "words": ["words_json"],
                    "html": ["timeline_json"],
                    "avatar": ["avatar_video_path"],
                    "render": ["video_path"],
                }
                _expected = _required_outputs.get(stage_pipeline_name, [])
                _missing = [k for k in _expected if not outputs or not outputs.get(k)]
                if _missing and not pipeline_error:
                    pipeline_error = (
                        f"Stage '{stage_pipeline_name}' finished but missing required outputs: "
                        f"{_missing}. The stage may have failed silently."
                    )
                    logger.error(f"[VideoGenService] {pipeline_error}")

            except Exception as e:
                import traceback
                pipeline_error = str(e)
                error_traceback = traceback.format_exc()
                logger.error(f"[VideoGenService] Stage {stage_pipeline_name} failed: {pipeline_error}")
                logger.error(f"[VideoGenService] Traceback: {error_traceback}")
                # Loop continues to try to save partial files

            # For the avatar stage: _generate_avatar_runpod() submitted the RunPod job and
            # wrote its ID to runpod_job_id.txt, then returned immediately (no blocking wait).
            # Poll RunPod here using asyncio.sleep() so the event loop stays free between polls.
            if stage_pipeline_name == "avatar":
                runpod_job_id_file = run_dir / "runpod_job_id.txt"
                if runpod_job_id_file.exists():
                    runpod_job_id = runpod_job_id_file.read_text().strip()
                    if runpod_job_id:
                        yield {
                            "type": "progress",
                            "stage": "AVATAR",
                            "message": "Avatar job submitted — waiting for RunPod inference...",
                            "video_id": video_id,
                            "percentage": 20,
                        }
                        import requests as _requests
                        from .avatar_service import get_avatar_provider
                        from ..config import get_settings as _get_settings
                        _settings = _get_settings()
                        avatar_provider = get_avatar_provider(
                            provider="runpod",
                            api_key=_settings.runpod_api_key,
                            endpoint_id=_settings.runpod_endpoint_id,
                        )
                        deadline = time.time() + 3600  # 60-min timeout (cold start + chunked inference)
                        avatar_succeeded = False
                        while time.time() < deadline:
                            await asyncio.sleep(10)
                            rp = avatar_provider.check_status(runpod_job_id)
                            rp_status = rp["status"]
                            pct = rp.get("progress", 0)
                            stage_msg = rp.get("stage", "")
                            yield {
                                "type": "progress",
                                "stage": "AVATAR",
                                "message": f"Avatar: {stage_msg or f'{pct}% complete'}",
                                "video_id": video_id,
                                "percentage": 20 + int(pct * 0.65),  # 20-85 range
                            }
                            if rp_status == "COMPLETED":
                                video_url = rp.get("video_url", "")
                                logger.info(f"[VideoGenService] Avatar job complete: {video_url}")
                                resp = _requests.get(video_url, timeout=120)
                                resp.raise_for_status()
                                avatar_path = run_dir / "avatar_video.mp4"
                                avatar_path.write_bytes(resp.content)
                                logger.info(f"[VideoGenService] Avatar video downloaded: {avatar_path}")
                                avatar_succeeded = True
                                break
                            elif rp_status == "FAILED":
                                logger.error(f"[VideoGenService] RunPod avatar job failed: {rp.get('error')}")
                                break
                        if not avatar_succeeded:
                            logger.error(f"[VideoGenService] Avatar polling timed out/failed for RunPod job {runpod_job_id}")

            # Recalculate percentage for file processing (slightly higher)
            percentage = 5 + int((stage_idx - start_stage_idx + 1) * percentage_per_stage)
            
            uploaded_files = {}
            stage_has_files = False
            files_to_check = file_map.get(config["name"], [])
            
            for output_key, file_key, file_name in files_to_check:
                # Try to get from outputs first, then check directory
                file_path = None
                if output_key and outputs and output_key in outputs:
                    try:
                        file_path = Path(str(outputs[output_key]))
                    except Exception as e:
                        logger.warning(f"[VideoGenService] Could not parse output path for {output_key}: {e}")
                
                # If not in outputs, check run directory
                if not file_path or not file_path.exists():
                    potential_path = run_dir / file_name
                    if potential_path.exists():
                        file_path = potential_path
                    else:
                        # Try case-insensitive search
                        try:
                            for f in run_dir.glob("*"):
                                if f.name.lower() == file_name.lower():
                                    file_path = f
                                    logger.info(f"[VideoGenService] Found {file_name} via case-insensitive search: {file_path}")
                                    break
                        except Exception as e:
                            logger.warning(f"[VideoGenService] Could not search for {file_name}: {e}")
                
                # Special handling: if generated_images directory doesn't exist, log and skip
                if not file_path and file_key == "generated_images":
                    logger.info(f"[VideoGenService] generated_images directory not found in {run_dir}. This is normal if no images were generated. Skipping...")
                    continue
                
                if file_path:
                    # Convert to Path object and check existence safely
                    try:
                        file_path_obj = Path(str(file_path))
                        if file_path_obj.exists():
                            stage_has_files = True
                            try:
                                # Check if it's a directory (for generated_images)
                                if file_path_obj.is_dir():
                                    # Check if directory has any files before uploading
                                    files_in_dir = list(file_path_obj.rglob("*"))
                                    file_count = sum(1 for f in files_in_dir if f.is_file())
                                    
                                    if file_count == 0:
                                        logger.warning(f"[VideoGenService] Directory {file_key} exists but is empty: {file_path_obj}")
                                        # Skip empty directory but mark stage as having files (directory exists)
                                        continue
                                    
                                    logger.info(f"[VideoGenService] Uploading directory {file_key} from {file_path_obj} ({file_count} files)...")
                                    s3_urls = self.s3_service.upload_video_directory(
                                        directory_path=file_path_obj,
                                        video_id=video_id,
                                        stage=file_key
                                    )
                                    
                                    if not s3_urls:
                                        logger.warning(f"[VideoGenService] No files were uploaded from {file_key} directory")
                                        continue
                                    
                                    # Build mapping of local paths to S3 URLs for image replacement
                                    if file_key == "generated_images":
                                        logger.info(f"[VideoGenService] Building image path mapping from {len(s3_urls)} uploaded images...")
                                        # Build a mapping by relative path for more accurate matching
                                        s3_url_by_relative_path = {}
                                        s3_url_by_filename = {}
                                        
                                        for s3_url in s3_urls:
                                            # Extract relative path from S3 URL
                                            # Format: https://bucket.s3.amazonaws.com/ai-videos/{video_id}/generated_images/{relative_path}
                                            parts = s3_url.split(f"/generated_images/")
                                            if len(parts) == 2:
                                                relative_path = parts[1]
                                                s3_url_by_relative_path[relative_path] = s3_url
                                                # Also index by filename for fallback matching
                                                filename = relative_path.split('/')[-1]
                                                s3_url_by_filename[filename] = s3_url
                                        
                                        logger.info(f"[VideoGenService] Indexed {len(s3_url_by_relative_path)} images by path, {len(s3_url_by_filename)} by filename")
                                        
                                        for local_file in file_path_obj.rglob("*"):
                                            if local_file.is_file():
                                                relative_path = local_file.relative_to(file_path_obj).as_posix()
                                                filename = local_file.name
                                                
                                                # Try to find S3 URL by relative path first (most accurate)
                                                s3_url = s3_url_by_relative_path.get(relative_path)
                                                if not s3_url:
                                                    # Fallback: match by filename
                                                    s3_url = s3_url_by_filename.get(filename)
                                                
                                                if s3_url:
                                                    # Store multiple path formats for flexible matching
                                                    local_abs_path = str(local_file.absolute()).replace('\\', '/')
                                                    local_file_path = f"file://{local_abs_path}"
                                                    local_file_path_alt = f"file:///{local_abs_path}"  # Alternative format (Windows)
                                                    local_file_path_alt2 = f"file://{local_abs_path.replace('C:', '')}"  # Another Windows variant
                                                    
                                                    # Store all possible path formats
                                                    image_path_mapping[local_file_path] = s3_url
                                                    image_path_mapping[local_file_path_alt] = s3_url
                                                    image_path_mapping[local_file_path_alt2] = s3_url
                                                    image_path_mapping[local_file.name] = s3_url  # Just filename
                                                    image_path_mapping[relative_path] = s3_url  # Relative path
                                                    image_path_mapping[str(local_file.absolute())] = s3_url  # Absolute path without file://
                                                    
                                                    logger.info(f"[VideoGenService] ✅ Mapped image: {filename} -> {s3_url}")
                                                    logger.debug(f"[VideoGenService]   - Local paths mapped: {local_file_path}, {local_file_path_alt}, {relative_path}")
                                                else:
                                                    logger.warning(f"[VideoGenService] ⚠️  Could not find S3 URL for {local_file.name} (relative: {relative_path})")
                                        
                                        logger.info(f"[VideoGenService] ✅ Built image mapping with {len(image_path_mapping)} entries (ready for URL replacement)")
                                    
                                    # Store the base URL (directory path) and list of uploaded files
                                    # Use the first file's URL to construct base directory URL
                                    if s3_urls:
                                        # Extract base URL from first file URL
                                        first_url = s3_urls[0]
                                        # Remove filename to get directory URL
                                        base_url = "/".join(first_url.split("/")[:-1]) + "/"
                                    else:
                                        # Fallback if no files uploaded
                                        from ..config import get_settings
                                        settings = get_settings()
                                        bucket = settings.aws_bucket_name or settings.aws_s3_public_bucket
                                        base_url = f"https://{bucket}.s3.amazonaws.com/ai-videos/{video_id}/{file_key}/"
                                    
                                    file_id = f"{video_id}-{file_key}"
                                    uploaded_files[file_key] = {
                                        "file_id": file_id,
                                        "s3_url": base_url,  # Base directory URL
                                        "files": s3_urls  # List of individual file URLs
                                    }
                                    logger.info(f"[VideoGenService] Uploaded {len(s3_urls)} files in {file_key} directory")
                                else:
                                    # Regular file upload
                                    # Special handling for time_based_frame.json - update image URLs before upload
                                    if file_key == "timeline" and file_name == "time_based_frame.json":
                                        if image_path_mapping:
                                            logger.info(f"[VideoGenService] Updating image URLs in {file_name} before upload (found {len(image_path_mapping)} image mappings)...")
                                            try:
                                                # Read the timeline JSON
                                                timeline_content = file_path_obj.read_text(encoding='utf-8')
                                                timeline_data = json.loads(timeline_content)
                                                
                                                # Handle both new format (dict with meta + entries) and old format (flat list)
                                                if isinstance(timeline_data, dict) and "entries" in timeline_data:
                                                    # New format: { "meta": {...}, "entries": [...] }
                                                    entries_list = timeline_data["entries"]
                                                    is_new_format = True
                                                    logger.info(f"[VideoGenService] Detected new timeline format with meta + entries")
                                                else:
                                                    # Old format: flat list of entries
                                                    entries_list = timeline_data
                                                    is_new_format = False
                                                    logger.info(f"[VideoGenService] Detected old timeline format (flat list)")
                                                
                                                # Update image URLs in HTML
                                                updated_count = 0
                                                total_entries = len(entries_list)
                                                
                                                for entry_idx, entry in enumerate(entries_list):
                                                    html = entry.get("html", "")
                                                    if html:
                                                        original_html = html
                                                        entry_updated = False
                                                        
                                                        # Strategy 1: Direct string replacement for all mapped paths
                                                        for local_path, s3_url in image_path_mapping.items():
                                                            # Try direct replacement (handles file:// URLs and filenames)
                                                            if local_path in html:
                                                                html = html.replace(local_path, s3_url)
                                                                updated_count += 1
                                                                entry_updated = True
                                                                logger.debug(f"[VideoGenService] Replaced {local_path} with {s3_url} in entry {entry_idx}")
                                                        
                                                        # Strategy 2: Regex replacement for src attributes (more robust)
                                                        # Find all img tags with src attributes
                                                        img_pattern = r'<img[^>]+src=["\']([^"\']+)["\'][^>]*>'
                                                        img_matches = list(re.finditer(img_pattern, html))
                                                        
                                                        for match in img_matches:
                                                            src_value = match.group(1)
                                                            matched_s3_url = None
                                                            
                                                            # Try to match against all path formats in mapping
                                                            for local_path, s3_url in image_path_mapping.items():
                                                                # Normalize paths for comparison
                                                                src_normalized = src_value.replace('\\', '/').lower()
                                                                local_normalized = local_path.replace('\\', '/').lower()
                                                                
                                                                # Check various matching strategies
                                                                if (local_normalized in src_normalized or 
                                                                    src_normalized.endswith(local_normalized.split('/')[-1]) or  # Filename match
                                                                    (local_path.startswith("file://") and src_normalized.endswith(local_normalized.replace("file://", "").split('/')[-1]))):
                                                                    matched_s3_url = s3_url
                                                                    break
                                                            
                                                            if matched_s3_url:
                                                                # Replace the src attribute value
                                                                old_src_attr = f'src="{src_value}"'
                                                                new_src_attr = f'src="{matched_s3_url}"'
                                                                html = html.replace(old_src_attr, new_src_attr)
                                                                updated_count += 1
                                                                entry_updated = True
                                                                logger.debug(f"[VideoGenService] Replaced src {src_value} with {matched_s3_url} in entry {entry_idx}")
                                                        
                                                        # Strategy 3: Regex replace file:// paths in src attributes (fallback)
                                                        file_url_pattern = r'src=["\']?(file://[^"\'\s]+)["\']?'
                                                        def replace_file_url(m):
                                                            src_path = m.group(1)
                                                            src_normalized = src_path.replace('\\', '/').lower()
                                                            # Try to find matching S3 URL by filename or path
                                                            for local_path, s3_url in image_path_mapping.items():
                                                                local_normalized = local_path.replace('\\', '/').lower()
                                                                # Match by filename or full path
                                                                if (local_normalized in src_normalized or 
                                                                    src_normalized.endswith(local_normalized.split('/')[-1])):
                                                                    return f'src="{s3_url}"'
                                                            return m.group(0)  # No match, keep original
                                                        
                                                        new_html = re.sub(file_url_pattern, replace_file_url, html)
                                                        if new_html != html:
                                                            html = new_html
                                                            updated_count += 1
                                                            entry_updated = True
                                                        
                                                        if entry_updated:
                                                            entry["html"] = html
                                                            logger.info(f"[VideoGenService] Updated HTML in timeline entry {entry_idx}")
                                                
                                                # Write updated timeline back to file
                                                if updated_count > 0:
                                                    file_path_obj.write_text(json.dumps(timeline_data, indent=2), encoding='utf-8')
                                                    logger.info(f"[VideoGenService] ✅ Updated {updated_count} image references in {file_name} across {total_entries} entries")
                                                else:
                                                    # Detect any unresolved local refs across ALL entries.
                                                    # An unresolved ref is an <img src> that is NOT a data: URI,
                                                    # NOT http(s)://, and didn't get matched by the swap above.
                                                    # That would indicate a bare-filename or file:// path the
                                                    # post-upload swap should have rewritten but didn't —
                                                    # warn so the gap shows up.
                                                    unresolved: list[str] = []
                                                    for entry in entries_list:
                                                        html_e = entry.get("html", "")
                                                        for m in re.finditer(r'<img[^>]+src=["\']([^"\']+)["\']', html_e):
                                                            src = m.group(1)
                                                            if src.startswith(("data:", "http://", "https://")):
                                                                continue
                                                            unresolved.append(src)
                                                    if unresolved:
                                                        logger.warning(
                                                            f"[VideoGenService] ⚠️  {len(unresolved)} unresolved local image ref(s) in {file_name}: "
                                                            f"{unresolved[:3]}. Check image_path_mapping coverage."
                                                        )
                                                        if image_path_mapping:
                                                            sample_keys = list(image_path_mapping.keys())[:3]
                                                            logger.debug(f"[VideoGenService] Sample image_path_mapping keys: {sample_keys}")
                                                    else:
                                                        logger.info(f"[VideoGenService] ℹ️  All <img> sources in {file_name} are base64-embedded or already on S3 — no swap needed")
                                            except Exception as e:
                                                logger.warning(f"[VideoGenService] Failed to update image URLs in {file_name}: {e}. Uploading original file.", exc_info=True)
                                        else:
                                            logger.info(f"[VideoGenService] No image mappings found, skipping URL update in {file_name}")
                                    
                                    # Handle files that should be uploaded but not stored in main s3_urls.
                                    # Internal files use the current pipeline stage as their S3 subdir
                                    # (e.g. script_plan.json → ai-videos/<vid>/script/) so the resume-time
                                    # download path can find them by convention.
                                    # Backwards compat: narration_raw.json keeps its hardcoded "audio"
                                    # subdir because the existing download path at line 631 looks there.
                                    if file_key is None:
                                        _internal_stage = "audio" if file_name == "narration_raw.json" else stage_pipeline_name
                                        logger.info(f"[VideoGenService] Uploading internal file {file_name} to S3 stage='{_internal_stage}' (not storing in DB)...")
                                        s3_url = self.s3_service.upload_video_file(
                                            file_path=file_path_obj,
                                            video_id=video_id,
                                            stage=_internal_stage
                                        )
                                        logger.info(f"[VideoGenService] Uploaded internal file {file_name}: {s3_url} (not stored in DB)")
                                        continue  # Skip DB update for internal files
                                    
                                    logger.info(f"[VideoGenService] Uploading {file_key} from {file_path_obj}...")
                                    s3_url = self.s3_service.upload_video_file(
                                        file_path=file_path_obj,
                                        video_id=video_id,
                                        stage=file_key
                                    )
                                    file_id = f"{video_id}-{file_key}"
                                    uploaded_files[file_key] = {"file_id": file_id, "s3_url": s3_url}
                                    logger.info(f"[VideoGenService] Uploaded {file_key}: {s3_url}")
                                
                                # Update DB with this file/directory IMMEDIATELY (with retry for connection errors)
                                # Skip if file_key is None (internal files)
                                if file_key is None:
                                    continue
                                    
                                max_db_retries = 3
                                db_updated = False
                                for retry in range(max_db_retries):
                                    try:
                                        updated_record = self.repository.update_files(
                                            video_id=video_id,
                                            file_ids={file_key: file_id},
                                            s3_urls={file_key: uploaded_files[file_key]["s3_url"]}
                                        )
                                        db_updated = True
                                        break
                                    except Exception as db_error:
                                        _db_err_str = str(db_error).lower()
                                        _db_err_type = type(db_error).__name__
                                        _is_conn_err = (
                                            "server closed the connection" in _db_err_str
                                            or "ssl connection has been closed" in _db_err_str
                                            or "connection was reset" in _db_err_str
                                            or "broken pipe" in _db_err_str
                                            or "OperationalError" in _db_err_type
                                            or "PendingRollbackError" in _db_err_type
                                            or "InterfaceError" in _db_err_type
                                        )
                                        if _is_conn_err:
                                            if retry < max_db_retries - 1:
                                                logger.warning(f"[VideoGenService] Database connection error (attempt {retry + 1}/{max_db_retries}): {db_error}. Retrying...")
                                                time.sleep(1)  # Wait 1 second before retry
                                                continue
                                            else:
                                                logger.error(f"[VideoGenService] Database connection failed after {max_db_retries} attempts: {db_error}")
                                                # Continue processing even if DB update fails
                                                break
                                        else:
                                            # Non-connection error, don't retry
                                            logger.error(f"[VideoGenService] Database update failed: {db_error}")
                                            raise
                                
                                if db_updated:
                                    logger.info(f"[VideoGenService] DB updated for {file_key}. File IDs in DB: {list(updated_record.file_ids.keys()) if updated_record else 'N/A'}, S3 URLs: {list(updated_record.s3_urls.keys()) if updated_record else 'N/A'}")
                                else:
                                    logger.warning(f"[VideoGenService] DB update skipped for {file_key} due to connection issues, but file was uploaded to S3")
                                if updated_record:
                                    # Read fresh from DB to verify update
                                    fresh_record = self.repository.get_by_video_id(video_id)
                                    if fresh_record:
                                        logger.info(f"[VideoGenService] DB updated for {file_key}. File IDs in DB: {list(fresh_record.file_ids.keys()) if fresh_record.file_ids else []}, S3 URLs: {list(fresh_record.s3_urls.keys()) if fresh_record.s3_urls else []}")
                                    else:
                                        logger.warning(f"[VideoGenService] Could not verify DB update for {file_key}")
                                else:
                                    logger.warning(f"[VideoGenService] DB update returned None for {file_key}")
                            except Exception as e:
                                file_identifier = file_key if file_key else file_name
                                logger.error(f"[VideoGenService] Failed to upload {file_identifier}: {e}", exc_info=True)
                    except Exception as e:
                        logger.warning(f"[VideoGenService] Could not process file path {file_path}: {e}")
            
            if stage_has_files:
                # After HTML stage: upload shot checkpoints to S3 so a retry can resume
                # from the last saved shot without re-running Director or completed shots.
                if stage_pipeline_name == "html":
                    try:
                        _ckpt_files = []
                        _dir_plan = run_dir / "director_plan.json"
                        if _dir_plan.exists():
                            _ckpt_files.append((_dir_plan, f"ai-videos/{video_id}/checkpoints/director_plan.json"))
                        _shot_cache_dir = run_dir / "shot_cache"
                        if _shot_cache_dir.exists():
                            for _sc_file in sorted(_shot_cache_dir.glob("shot_*.json")):
                                _ckpt_files.append((_sc_file, f"ai-videos/{video_id}/checkpoints/shot_cache/{_sc_file.name}"))
                        _sg_file = run_dir / "style_guide.json"
                        if _sg_file.exists():
                            _ckpt_files.append((_sg_file, f"ai-videos/{video_id}/checkpoints/style_guide.json"))
                        for _f, _key in _ckpt_files:
                            self.s3_service.upload_file(_f, s3_key=_key, content_type="application/json")
                        if _ckpt_files:
                            logger.info(f"[VideoGenService] Uploaded {len(_ckpt_files)} checkpoint files to S3 for {video_id}")
                    except Exception as _ckpt_err:
                        logger.warning(f"[VideoGenService] Failed to upload checkpoints to S3: {_ckpt_err}")

                # Update stage status — wrap in try/except so a stale-session error
                # doesn't abort the entire pipeline after files were already uploaded.
                try:
                    self.repository.update_stage(
                        video_id=video_id,
                        stage=stage_name,
                        status="COMPLETED"
                    )
                except Exception as stage_update_err:
                    logger.error(
                        f"[VideoGenService] Failed to update stage {stage_name} in DB: {stage_update_err}. "
                        "Files may have been uploaded but stage is not marked complete.",
                        exc_info=True
                    )

                # After HTML stage: build per-sentence audio clips from the
                # already-uploaded narration.mp3 + words.json so the editor's
                # script tab has them. Best-effort; never fail the video
                # because clip building failed — sentences[] is purely additive.
                if stage_pipeline_name == "html":
                    self._build_sentence_clips_safe(video_id)

                logger.info(f"[VideoGenService] Stage {stage_name} completed. Uploaded {len(uploaded_files)} files.")
                
                yield {
                    "type": "progress",
                    "stage": stage_name,
                    "message": f"Completed {stage_name}",
                    "percentage": percentage,
                    "video_id": video_id,
                    "files": uploaded_files
                }
            else:
                # Stage didn't produce files - log but continue checking next stages
                # (earlier stages might have completed even if later ones failed)
                logger.info(f"[VideoGenService] Stage {stage_name} did not produce files (may have failed or not reached)")
                # Don't break - continue checking remaining stages for partial results
        
        # Final verification: log what's actually in the database
        final_record = self.repository.get_by_video_id(video_id)
        if final_record:
            logger.info(f"[VideoGenService] Final DB state for {video_id}:")
            logger.info(f"  - Stage: {final_record.current_stage}, Status: {final_record.status}")
            logger.info(f"  - File IDs: {list(final_record.file_ids.keys()) if final_record.file_ids else []}")
            logger.info(f"  - S3 URLs: {list(final_record.s3_urls.keys()) if final_record.s3_urls else []}")
        else:
            logger.warning(f"[VideoGenService] No record found in DB for {video_id}")
        
        # If pipeline had error, mark as failed
        if pipeline_error:
            logger.error(f"[VideoGenService] Pipeline error: {pipeline_error}")
            video_record = self.repository.get_by_video_id(video_id)
            if video_record:
                # Update error message but keep current stage
                self.repository.mark_failed(
                    video_id=video_id,
                    error_message=pipeline_error,
                    current_stage=video_record.current_stage  # Keep the last completed stage
                )
            else:
                # No record exists, create failed record
                self.repository.mark_failed(
                    video_id=video_id,
                    error_message=pipeline_error
                )
            
            yield {
                "type": "error",
                "message": f"Video generation encountered an error: {pipeline_error}. Partial files may have been saved.",
                "video_id": video_id,
                "error_details": pipeline_error,
                "stage": video_record.current_stage if video_record else "PENDING"
            }
    
    # Note: _process_pipeline_outputs is now handled inline in _run_pipeline_stages
    # for real-time database updates at each stage

    def _build_sentence_clips_safe(self, video_id: str) -> None:
        """Best-effort: build per-sentence audio clips and patch them into
        the video's timeline JSON. Called once per video after the HTML
        stage uploads finish.

        Swallows all errors and logs them — sentences[] is purely additive
        for the editor's script tab; a failure here must never break video
        generation. Skips silently if the render server isn't configured.
        """
        import logging
        logger = logging.getLogger(__name__)
        try:
            from ..config import get_settings
            from .render_service import RenderService
            from .sentence_clip_service import SentenceClipService

            settings = get_settings()
            if not settings.render_server_url:
                logger.info(
                    "[VideoGenService] Skipping sentence-clip build for %s — render server not configured",
                    video_id,
                )
                return

            svc = SentenceClipService(
                s3_service=self.s3_service,
                render_service=RenderService(
                    render_server_url=settings.render_server_url,
                    render_key=settings.render_server_key,
                ),
                repository=self.repository,
                video_gen_root=self.video_gen_root,
            )
            result = svc.build_for_video(video_id)
            if result.ok:
                logger.info(
                    "[VideoGenService] Built %d sentence clip(s) for %s",
                    result.count, video_id,
                )
            else:
                logger.info(
                    "[VideoGenService] Sentence-clip build skipped for %s: %s",
                    video_id, result.skipped_reason,
                )
        except Exception as exc:
            logger.warning(
                "[VideoGenService] Sentence-clip build failed for %s: %s",
                video_id, exc, exc_info=True,
            )

    def get_video_status(self, video_id: str) -> Optional[Dict[str, Any]]:
        """
        Get current status of video generation.
        
        Args:
            video_id: Video identifier
            
        Returns:
            Video status dictionary or None if not found
        """
        video_record = self.repository.get_by_video_id(video_id)
        if not video_record:
            return None
        
        return video_record.to_dict()


    def _build_regen_context(
        self,
        timeline_data: Any,
        frame_index: int,
        timeline_meta: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Extract run-level + neighbour-level context for the frame-regen LLM.

        Returns a dict with:
          - palette, style_guide, shot_pack (run-level, from timeline meta)
          - target_shot_type (from the frame's _shot_type, when present)
          - neighbour_shots (list of {position, shot_type, narration, visual_desc} for
            up to 2 prev + 2 next shots)

        Empty / missing fields degrade gracefully — old timelines (pre-2026-05)
        without `_narration_excerpt` or `meta.shot_pack` simply yield an empty
        context dict and the regen prompt falls back to the legacy minimal form.
        """
        meta = timeline_meta or {}
        if not isinstance(meta, dict):
            meta = {}

        # Normalize to entries list
        entries = (
            timeline_data["entries"]
            if isinstance(timeline_data, dict) and "entries" in timeline_data
            else timeline_data
        )
        if not isinstance(entries, list):
            entries = []

        ctx: Dict[str, Any] = {}
        palette = meta.get("palette") if isinstance(meta.get("palette"), dict) else None
        if palette:
            ctx["palette"] = palette
        style_guide = meta.get("style_guide") if isinstance(meta.get("style_guide"), dict) else None
        if style_guide:
            ctx["style_guide"] = style_guide
        shot_pack = meta.get("shot_pack") if isinstance(meta.get("shot_pack"), dict) else None
        if shot_pack:
            ctx["shot_pack"] = shot_pack
        ctx["dimensions"] = meta.get("dimensions") or {"width": 1920, "height": 1080}

        # Target shot's stash fields (kept in published timeline since 2026-05)
        if 0 <= frame_index < len(entries):
            target = entries[frame_index]
            ctx["target_shot_type"] = target.get("_shot_type") or ""
            ctx["target_narration"] = target.get("_narration_excerpt") or ""
            ctx["target_visual_description"] = target.get("_visual_description") or ""
            ctx["target_template_id"] = target.get("_template_id") or ""

        # Window of up to 2 prev + 2 next shots — gives the LLM continuity
        # signal without ballooning the prompt.
        neighbours: List[Dict[str, Any]] = []
        for offset in (-2, -1, 1, 2):
            j = frame_index + offset
            if 0 <= j < len(entries) and j != frame_index:
                e = entries[j]
                neighbours.append({
                    "position": "prev" if offset < 0 else "next",
                    "offset": offset,
                    "shot_type": e.get("_shot_type") or "",
                    "narration": (e.get("_narration_excerpt") or "")[:160],
                    "visual_desc": (e.get("_visual_description") or "")[:160],
                })
        if neighbours:
            ctx["neighbours"] = neighbours

        return ctx

    def _build_regen_prompt(
        self,
        context: Dict[str, Any],
        original_html: str,
        user_prompt: str,
    ) -> tuple[str, str]:
        """Build the (system, user) prompt pair for frame regeneration.

        Composes run-level brand context + neighbour summary + skill catalog
        into the system prompt so the regenerated shot stays consistent with
        the rest of the timeline. Falls back to the legacy minimal prompt
        when context is empty (old timelines).
        """
        import json as _json

        # If we have no run context at all (legacy timeline), use the original
        # minimal prompt — never regress.
        if not context.get("palette") and not context.get("shot_pack"):
            system = (
                "You are an expert HTML/CSS developer for educational videos. "
                "Modify the provided HTML frame based on the user's request.\n\n"
                "RULES:\n"
                "1. Keep the HTML structure valid and responsive.\n"
                "2. PRESERVE all existing image tags <img src='...'> exactly. "
                "Do not change image sources.\n"
                "3. Apply requested text or CSS changes.\n"
                "4. Return ONLY the new HTML code. No markdown, no explanations."
            )
            user = (
                f"ORIGINAL HTML:\n{original_html}\n\n"
                f"USER INSTRUCTION:\n{user_prompt}\n\nGenerate the updated HTML:"
            )
            return system, user

        # Rich context path — build a designer-grade system prompt
        sections: List[str] = []
        sections.append(
            "You are the editor for an existing AI-generated educational video. "
            "A specific frame needs to be modified. The rest of the timeline is "
            "FROZEN — your edit must look stylistically continuous with its "
            "neighbours. Use the run's brand tokens, motion strategy, and "
            "neighbour context below to stay on-brand."
        )

        sections.append("\n## RUN CONTEXT (do not violate)")

        palette = context.get("palette") or {}
        if palette:
            sections.append(
                "\n**Brand palette** (use the CSS variables, not raw hex):\n"
                f"  --brand-primary: {palette.get('primary', '?')}\n"
                f"  --brand-accent: {palette.get('accent', '?')}\n"
                f"  --brand-text: {palette.get('text', '?')}\n"
                f"  --brand-text-secondary: {palette.get('text_secondary', '?')}\n"
                f"  --brand-bg: {palette.get('background', '?')}"
            )

        sg = context.get("style_guide") or {}
        if sg:
            sections.append(
                "\n**Run style guide**:\n"
                f"  Background type: {sg.get('background_type') or 'n/a'}\n"
                f"  Layout theme:    {sg.get('layout_theme') or 'n/a'}\n"
                f"  Motion strategy: {sg.get('motion_strategy') or 'n/a'}"
            )

        sp = context.get("shot_pack") or {}
        if sp:
            # Compact serialization — JSON is fine; the LLM reads it
            sections.append(
                "\n**Shot pack — single source of design truth for this video** "
                "(use these tokens verbatim):\n```json\n"
                + _json.dumps(sp, indent=2, ensure_ascii=False)
                + "\n```\n"
                "Rules:\n"
                "- COLORS: use only color_tokens CSS vars (var(--brand-primary) etc.). Never hardcode brand hex.\n"
                "- TYPOGRAPHY: use font_scale values. Never invent your own size.\n"
                "- SPACING: use spacing tokens; safe_area for outer padding.\n"
                "- EASES: use ease tokens in GSAP tweens."
            )

        target_shot_type = context.get("target_shot_type", "")
        target_narration = context.get("target_narration", "")
        target_visual = context.get("target_visual_description", "")
        target_template = context.get("target_template_id", "")
        if target_shot_type or target_narration or target_visual or target_template:
            sections.append("\n## TARGET FRAME (the one being edited)")
            if target_shot_type:
                sections.append(f"  Shot type: {target_shot_type}")
            if target_template:
                sections.append(
                    f"  Originally rendered from template: `{target_template}`. "
                    "Your edit can stay template-shaped or break free — your call, "
                    "but visual consistency with the rest of the timeline is non-negotiable."
                )
            if target_narration:
                sections.append(f"  Narration excerpt: \"{target_narration[:280]}\"")
            if target_visual:
                sections.append(f"  Original visual direction: \"{target_visual[:240]}\"")

        neighbours = context.get("neighbours") or []
        if neighbours:
            sections.append("\n## NEIGHBOURING SHOTS (for continuity reference)")
            for n in neighbours:
                label = "Previous" if n["position"] == "prev" else "Next"
                shot_type = n.get("shot_type") or "?"
                narr = n.get("narration") or ""
                vis = n.get("visual_desc") or ""
                line = f"- {label} (offset {n['offset']:+d}, {shot_type}):"
                if narr:
                    line += f" narration=\"{narr}\""
                if vis:
                    line += f" visual=\"{vis}\""
                sections.append(line)
            sections.append(
                "\nDo NOT redesign — your edit should feel like the same designer "
                "produced the surrounding shots."
            )

        # Skill catalog — only when we know the target shot type and the registry imports
        if target_shot_type:
            try:
                if str(self.video_gen_root) not in sys.path:
                    sys.path.insert(0, str(self.video_gen_root))
                from skill_registry import build_catalog_for_shot  # type: ignore
                # Use ultra catalog as a reasonable upper bound; the regen LLM
                # can reach for any skill the original run could have.
                canvas = "portrait" if (
                    int(context.get("dimensions", {}).get("width", 1920))
                    < int(context.get("dimensions", {}).get("height", 1080))
                ) else "landscape"
                catalog = build_catalog_for_shot(target_shot_type, "ultra", canvas)
                if catalog and catalog.strip():
                    sections.append("\n## SKILL CATALOG (drop <skill> tags as needed)")
                    sections.append(catalog)
            except Exception:
                pass  # registry import / catalog build is best-effort

        sections.append(
            "\n## OUTPUT RULES\n"
            "1. PRESERVE existing `<img src=\"...\">` tags exactly — do not change image URLs.\n"
            "2. PRESERVE `data-img-prompt`, `data-video-query`, and `data-subject-id` attributes — "
            "they drive downstream image/video selection.\n"
            "3. Use the brand CSS variables from RUN CONTEXT — never hardcode brand colors.\n"
            "4. Reuse the shot pack's font_scale and spacing tokens — never pick your own.\n"
            "5. Keep the outer wrapper as `<div id=\"shot-root\" style=\"position:relative;width:100%;height:100%;overflow:hidden\">…</div>`.\n"
            "6. Use named GSAP eases (power3.out / back.out / expo.out) — never `linear` unless intentional.\n"
            "7. Never use `setTimeout`. Use `gsap.delayedCall` or tween `delay:` values.\n"
            "8. Never wrap inline scripts in `window.addEventListener('load', …)` — won't fire in the render server's shadow DOM.\n"
            "9. Return ONLY the new HTML code. No markdown fences, no commentary."
        )

        system = "\n".join(sections)
        user = (
            f"ORIGINAL HTML:\n{original_html}\n\n"
            f"USER INSTRUCTION:\n{user_prompt}\n\n"
            f"Return the updated HTML with the run context honored."
        )
        return system, user

    async def regenerate_video_frame(
        self,
        video_id: str,
        timestamp: float,
        user_prompt: str,
        db_session: Optional[Session] = None,
        institute_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Regenerate HTML content for a specific frame based on user prompt.
        
        Args:
            video_id: Video identifier
            timestamp: Timestamp in seconds to identify the frame
            user_prompt: User's instruction for modification
            
        Returns:
            Dict containing original_html and new_html
        """
        import logging
        logger = logging.getLogger(__name__)
        
        # 1. Get video status to find timeline URL
        status = self.get_video_status(video_id)
        if not status or "timeline" not in status.get("s3_urls", {}):
            raise ValueError(f"Timeline not found for video {video_id}. Generate HTML stage first.")
            
        timeline_url = status["s3_urls"]["timeline"]
        
        # 2. Download and parse timeline
        with tempfile.TemporaryDirectory() as temp_dir:
            timeline_path = Path(temp_dir) / "time_based_frame.json"
            if not self.s3_service.download_file(timeline_url, timeline_path):
                raise RuntimeError("Failed to download timeline file")
                
            raw = json.loads(timeline_path.read_text(encoding='utf-8'))

            # Handle both timeline formats:
            #   plain array: [{...}, ...]
            #   wrapped:     {"entries": [...], "meta": {...}}
            timeline_data = raw["entries"] if isinstance(raw, dict) and "entries" in raw else raw

            # 3. Find the target frame by index (when timestamp is an int index)
            #    or by time range using inTime/exitTime (or legacy start_time/end_time).
            target_frame = None
            frame_index = -1

            # Accept both int and float whole numbers as direct frame indices
            is_index = (
                isinstance(timestamp, (int, float))
                and float(timestamp) == float(int(timestamp))
                and 0 <= int(timestamp) < len(timeline_data)
            )
            if is_index:
                idx = int(timestamp)
                target_frame = timeline_data[idx]
                frame_index = idx
            else:
                # Find frame where inTime <= timestamp < exitTime
                for idx, frame in enumerate(timeline_data):
                    start = float(
                        frame.get("inTime") or frame.get("start_time") or frame.get("start") or 0
                    )
                    end = float(
                        frame.get("exitTime") or frame.get("end_time") or frame.get("end") or 99999
                    )
                    if start <= timestamp < end:
                        target_frame = frame
                        frame_index = idx
                        break

            if not target_frame:
                # Fallback to last frame
                if timeline_data:
                    target_frame = timeline_data[-1]
                    frame_index = len(timeline_data) - 1
                else:
                    raise ValueError("Empty timeline")
            
            original_html = target_frame.get("html", "")

            # 4. Build run-context-aware regen prompt. Reads palette / style_guide
            #    / shot_pack from timeline meta and pulls neighbour shots'
            #    narration_excerpt + visual_description so the regenerated frame
            #    stays stylistically continuous with the rest of the timeline.
            #    Falls back to a minimal prompt for legacy timelines that don't
            #    carry these fields.
            timeline_meta = (
                raw["meta"] if isinstance(raw, dict) and isinstance(raw.get("meta"), dict) else {}
            )
            regen_context = self._build_regen_context(timeline_data, frame_index, timeline_meta)
            system_prompt, user_message = self._build_regen_prompt(
                regen_context, original_html, user_prompt
            )

            # 5. Call LLM to regenerate HTML
            from ..config import get_settings

            import requests
            settings = get_settings()
            
            if not settings.openrouter_api_key:
                raise ValueError("OpenRouter API key not configured")
                
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.openrouter_api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://vacademy.io",
                },
                json={
                    "model": settings.llm_default_model or "openai/gpt-4o",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message}
                    ],
                    "temperature": 0.7
                },
                timeout=90  # M27: increased from 30s — LLM cold-start can take 60-90s
            )

            if response.status_code != 200:
                logger.error(f"LLM Error: {response.text}")
                raise RuntimeError("Failed to regenerate HTML via AI")
                
            new_html = response.json()["choices"][0]["message"]["content"].strip()

            # Extract HTML from markdown code fence if the LLM wrapped its response.
            # Handles both ```html ... ``` and ``` ... ``` anywhere in the response.
            fence_match = re.search(r'```(?:html)?\s*\n?([\s\S]*?)\n?\s*```', new_html, re.IGNORECASE)
            if fence_match:
                new_html = fence_match.group(1).strip()
            else:
                new_html = new_html.strip()
            
            return {
                "video_id": video_id,
                "frame_index": frame_index,
                "timestamp": timestamp,
                "original_html": original_html,
                "new_html": new_html
            }

    async def update_video_frame(
        self,
        video_id: str,
        frame_index: int,
        new_html: str,
        in_time: float | None = None,
        exit_time: float | None = None,
        z: int | None = None,
        entry_id: str | None = None,
    ) -> Dict[str, Any]:
        """
        Update a specific frame's HTML in the timeline and save back to S3.
        
        Args:
            video_id: Video identifier
            frame_index: Index of the frame to update
            new_html: The valid HTML content
            
        Returns:
            Success status
        """
        import logging
        logger = logging.getLogger(__name__)
        
        status = self.get_video_status(video_id)
        if not status or "timeline" not in status.get("s3_urls", {}):
            raise ValueError(f"Timeline not found for video {video_id}")
            
        timeline_url = status["s3_urls"]["timeline"]
        
        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = Path(temp_dir) / "time_based_frame.json"
            
            # Download
            if not self.s3_service.download_file(timeline_url, file_path):
                raise RuntimeError("Failed to download timeline file")
            
            # Read
            data = json.loads(file_path.read_text(encoding='utf-8'))

            # Handle both timeline formats:
            #   - plain array:              [{"html": ...}, ...]
            #   - wrapped object:           {"entries": [...], "meta": {...}}
            entries = data["entries"] if isinstance(data, dict) and "entries" in data else data

            # Update
            if frame_index < 0 or frame_index >= len(entries):
                raise IndexError(f"Frame index {frame_index} out of range (0-{len(entries)-1})")

            entry = entries[frame_index]
            if entry_id is not None and entry.get("id") != entry_id:
                logger.warning(
                    "update_video_frame: entry_id mismatch at index %d "
                    "(expected %s, got %s) — proceeding by index",
                    frame_index, entry_id, entry.get("id"),
                )
            entry["html"] = new_html
            if in_time is not None:
                entry["inTime"] = in_time
            if exit_time is not None:
                entry["exitTime"] = exit_time
            if z is not None:
                entry["z"] = z

            # Write (data already points to the modified entries when wrapped)
            file_path.write_text(json.dumps(data, indent=2), encoding='utf-8')
            
            # Upload back
            # We use upload_file directly to S3
            # We need to constructing the S3 key again or reuse internal logic
            # S3Service.upload_file expects a key.
            # TIMELINE URL: https://bucket.s3.amazonaws.com/ai-videos/{video_id}/timeline/time_based_frame.json
            # KEY: ai-videos/{video_id}/timeline/time_based_frame.json
            
            from ..config import get_settings
            settings = get_settings()
            bucket = settings.aws_bucket_name
            
            # Extract key from URL
            # simplistic extraction: find "ai-videos/..."
            if f"/{bucket}/" in timeline_url:
                # Path style
                key = timeline_url.split(f"/{bucket}/")[-1]
            elif f"{bucket}.s3" in timeline_url:
                # Virtual host style
                # URL: https://BUCKET.s3.region.amazonaws.com/KEY
                # We need to strip the domain part
                # Find first slash after domain
                match = re.search(r'\.com/(.+)$', timeline_url)
                if match:
                    key = match.group(1)
                else:
                     # Fallback manual construction
                     key = f"ai-videos/{video_id}/timeline/time_based_frame.json"
            else:
                 key = f"ai-videos/{video_id}/timeline/time_based_frame.json"
            
            # Upload
            try:
                self.s3_service.s3_client.upload_file(
                    str(file_path),
                    bucket,
                    key,
                    ExtraArgs={'ContentType': 'application/json'}
                )
                
                # Invalidate CloudFront? (Not handled here, assuming direct S3 usage or short TTL)
                
            except Exception as e:
                logger.error(f"Failed to upload updated timeline: {e}")
                raise RuntimeError(f"Failed to save changes to S3: {e}")
                
            return {
                "status": "success",
                "video_id": video_id,
                "updated_frame_index": frame_index,
                "message": "Frame updated successfully. Player should reflect changes immediately."
            }


    async def add_video_frame(
        self,
        video_id: str,
        html: str,
        in_time: Optional[float],
        exit_time: Optional[float],
        z: int = 0,
        entry_id: Optional[str] = None,
        html_start_x: Optional[int] = None,
        html_start_y: Optional[int] = None,
        html_end_x: Optional[int] = None,
        html_end_y: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Insert a new frame/entry into the video timeline and save back to S3.

        For time_driven videos: in_time and exit_time define when the frame appears.
        For user_driven videos: the frame is appended at the end of the entries array.

        If exit_time exceeds the current meta.total_duration, the meta is updated so
        the renderer extends the video accordingly.

        Returns the new entry's id and its position in the entries array.
        """
        import logging
        logger = logging.getLogger(__name__)

        if in_time is not None and exit_time is not None and in_time >= exit_time:
            raise ValueError(f"in_time ({in_time}) must be less than exit_time ({exit_time})")

        status = self.get_video_status(video_id)
        if not status or "timeline" not in status.get("s3_urls", {}):
            raise ValueError(f"Timeline not found for video {video_id}")

        timeline_url = status["s3_urls"]["timeline"]

        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = Path(temp_dir) / "time_based_frame.json"

            if not self.s3_service.download_file(timeline_url, file_path):
                raise RuntimeError("Failed to download timeline file")

            data = json.loads(file_path.read_text(encoding='utf-8'))

            # Handle both timeline formats
            is_wrapped = isinstance(data, dict) and "entries" in data
            entries = data["entries"] if is_wrapped else data
            meta = data.get("meta", {}) if is_wrapped else {}

            # Resolve default video dimensions from meta so position keys are always present
            _dims = meta.get("dimensions", {})
            _default_w = int(_dims.get("width", 1920))
            _default_h = int(_dims.get("height", 1080))

            # Build the new entry — always include position keys so _load_timeline validation passes
            new_id = entry_id or f"shot-{uuid4().hex[:8]}"
            _sx = html_start_x if html_start_x is not None else 0
            _sy = html_start_y if html_start_y is not None else 0
            _ex = html_end_x if html_end_x is not None else _default_w
            _ey = html_end_y if html_end_y is not None else _default_h
            new_entry: Dict[str, Any] = {
                "id": new_id,
                "html": html,
                "z": z,
                "htmlStartX": _sx,
                "htmlStartY": _sy,
                "htmlEndX": _ex,
                "htmlEndY": _ey,
            }

            if in_time is not None:
                new_entry["inTime"] = in_time
            if exit_time is not None:
                new_entry["exitTime"] = exit_time

            # Insert sorted by inTime so the timeline stays ordered (time_driven).
            # For user_driven (no inTime), simply append.
            if in_time is not None:
                insert_idx = len(entries)
                for i, e in enumerate(entries):
                    e_in = e.get("inTime", e.get("start", float("inf")))
                    if isinstance(e_in, (int, float)) and e_in > in_time:
                        insert_idx = i
                        break
                entries.insert(insert_idx, new_entry)
                frame_index = insert_idx
            else:
                entries.append(new_entry)
                frame_index = len(entries) - 1

            # Extend meta.total_duration if the new shot goes beyond it
            if exit_time is not None and is_wrapped:
                current_total = meta.get("total_duration") or 0
                if exit_time > current_total:
                    meta["total_duration"] = exit_time
                    data["meta"] = meta

            # Write back
            if is_wrapped:
                data["entries"] = entries
            else:
                data = entries

            file_path.write_text(json.dumps(data, indent=2), encoding='utf-8')

            # Extract S3 key (same logic as update_video_frame)
            from ..config import get_settings
            settings = get_settings()
            bucket = settings.aws_bucket_name

            if f"/{bucket}/" in timeline_url:
                key = timeline_url.split(f"/{bucket}/")[-1]
            elif f"{bucket}.s3" in timeline_url:
                match = re.search(r'\.com/(.+)$', timeline_url)
                key = match.group(1) if match else f"ai-videos/{video_id}/timeline/time_based_frame.json"
            else:
                key = f"ai-videos/{video_id}/timeline/time_based_frame.json"

            try:
                self.s3_service.s3_client.upload_file(
                    str(file_path),
                    bucket,
                    key,
                    ExtraArgs={'ContentType': 'application/json'}
                )
            except Exception as e:
                logger.error(f"Failed to upload updated timeline: {e}")
                raise RuntimeError(f"Failed to save new frame to S3: {e}")

            return {
                "status": "success",
                "video_id": video_id,
                "entry_id": new_id,
                "frame_index": frame_index,
                "message": "Frame added successfully.",
            }

    # ── Audio track helpers ──────────────────────────────────────────────────

    def _load_timeline(self, video_id: str, temp_dir: str):
        """Download timeline JSON and return (data, entries, meta, is_wrapped, key)."""
        import re as _re
        from ..config import get_settings
        import logging as _logging
        logger = _logging.getLogger(__name__)

        status = self.get_video_status(video_id)
        if not status or "timeline" not in status.get("s3_urls", {}):
            raise ValueError(f"Timeline not found for video {video_id}")

        timeline_url = status["s3_urls"]["timeline"]
        file_path = Path(temp_dir) / "time_based_frame.json"

        if not self.s3_service.download_file(timeline_url, file_path):
            raise RuntimeError("Failed to download timeline file")

        data = json.loads(file_path.read_text(encoding='utf-8'))
        is_wrapped = isinstance(data, dict) and "entries" in data
        entries = data["entries"] if is_wrapped else data
        meta = data.get("meta", {}) if is_wrapped else {}

        settings = get_settings()
        bucket = settings.aws_bucket_name
        if f"/{bucket}/" in timeline_url:
            key = timeline_url.split(f"/{bucket}/")[-1]
        elif f"{bucket}.s3" in timeline_url:
            match = _re.search(r'\.com/(.+)$', timeline_url)
            key = match.group(1) if match else f"ai-videos/{video_id}/timeline/time_based_frame.json"
        else:
            key = f"ai-videos/{video_id}/timeline/time_based_frame.json"

        return data, entries, meta, is_wrapped, key, file_path

    def _save_timeline(self, data, file_path: Path, bucket: str, key: str):
        """Serialize timeline data and upload to S3."""
        import logging as _logging
        logger = _logging.getLogger(__name__)
        file_path.write_text(json.dumps(data, indent=2), encoding='utf-8')
        try:
            self.s3_service.s3_client.upload_file(
                str(file_path), bucket, key,
                ExtraArgs={'ContentType': 'application/json'}
            )
        except Exception as e:
            logger.error(f"Failed to upload timeline: {e}")
            raise RuntimeError(f"Failed to save timeline to S3: {e}")

    async def add_audio_track(
        self,
        video_id: str,
        label: str,
        url: str,
        volume: float = 1.0,
        delay: float = 0.0,
        fade_in: float = 0.0,
        fade_out: float = 0.0,
        track_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Insert a new audio track into meta.audio_tracks and save back to S3."""
        from ..config import get_settings
        with tempfile.TemporaryDirectory() as temp_dir:
            data, entries, meta, is_wrapped, key, file_path = self._load_timeline(video_id, temp_dir)
            settings = get_settings()
            bucket = settings.aws_bucket_name

            new_id = track_id or f"track-{uuid4().hex[:8]}"
            new_track = {
                "id": new_id, "label": label, "url": url,
                "volume": volume, "delay": delay, "fadeIn": fade_in, "fadeOut": fade_out,
            }

            if is_wrapped:
                tracks = meta.get("audio_tracks", [])
                tracks.append(new_track)
                meta["audio_tracks"] = tracks
                data["meta"] = meta
            else:
                # Upgrade plain array to wrapped format so we can store meta
                data = {"entries": entries, "meta": {"audio_tracks": [new_track]}}

            self._save_timeline(data, file_path, bucket, key)
            return {"status": "success", "video_id": video_id, "track_id": new_id, "message": "Audio track added."}

    async def update_audio_track(
        self,
        video_id: str,
        track_id: str,
        label: Optional[str] = None,
        url: Optional[str] = None,
        volume: Optional[float] = None,
        delay: Optional[float] = None,
        fade_in: Optional[float] = None,
        fade_out: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Update an existing audio track in meta.audio_tracks."""
        from ..config import get_settings
        with tempfile.TemporaryDirectory() as temp_dir:
            data, entries, meta, is_wrapped, key, file_path = self._load_timeline(video_id, temp_dir)
            settings = get_settings()
            bucket = settings.aws_bucket_name

            if not is_wrapped:
                raise ValueError(f"Timeline for {video_id} has no meta section — track not found.")

            tracks = meta.get("audio_tracks", [])
            track = next((t for t in tracks if t.get("id") == track_id), None)
            if not track:
                raise ValueError(f"Audio track '{track_id}' not found in video '{video_id}'")

            if label is not None:
                track["label"] = label
            if url is not None:
                track["url"] = url
            if volume is not None:
                track["volume"] = volume
            if delay is not None:
                track["delay"] = delay
            if fade_in is not None:
                track["fadeIn"] = fade_in
            if fade_out is not None:
                track["fadeOut"] = fade_out

            data["meta"] = meta
            self._save_timeline(data, file_path, bucket, key)
            return {"status": "success", "video_id": video_id, "track_id": track_id, "message": "Audio track updated."}

    async def delete_audio_track(self, video_id: str, track_id: str) -> Dict[str, Any]:
        """Remove an audio track from meta.audio_tracks and save back to S3."""
        from ..config import get_settings
        with tempfile.TemporaryDirectory() as temp_dir:
            data, entries, meta, is_wrapped, key, file_path = self._load_timeline(video_id, temp_dir)
            settings = get_settings()
            bucket = settings.aws_bucket_name

            if not is_wrapped:
                raise ValueError(f"Timeline for {video_id} has no meta section — track not found.")

            tracks = meta.get("audio_tracks", [])
            new_tracks = [t for t in tracks if t.get("id") != track_id]
            if len(new_tracks) == len(tracks):
                raise ValueError(f"Audio track '{track_id}' not found in video '{video_id}'")

            meta["audio_tracks"] = new_tracks
            data["meta"] = meta
            self._save_timeline(data, file_path, bucket, key)
            return {"status": "success", "video_id": video_id, "track_id": track_id, "message": "Audio track deleted."}

    def get_institute_generations(self, institute_id: str, limit: int = 10, offset: int = 0) -> list[Dict[str, Any]]:
        """
        Get the last N content generations for an institute.

        Args:
            institute_id: Institute identifier
            limit: Maximum number of records to return
            offset: Number of records to skip (for pagination)

        Returns:
            List of video generation records as dictionaries
        """
        records = self.repository.get_history_by_institute(
            institute_id=institute_id,
            limit=limit,
            offset=offset
        )
        return [record.to_dict() for record in records]
