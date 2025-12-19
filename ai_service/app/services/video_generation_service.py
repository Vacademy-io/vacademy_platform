"""
AI Video Generation Service.
Wraps the ai-video-gen pipeline and provides stage-based generation.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Optional, Dict, Any, AsyncIterator
from uuid import uuid4

from ..repositories.ai_video_repository import AiVideoRepository
from .s3_service import S3Service


class VideoGenerationService:
    """
    Service for AI video generation with stage-based control.
    Supports generating up to specific stages and resuming from checkpoints.
    """
    
    # Stage order for progression
    STAGES = ["PENDING", "SCRIPT", "TTS", "WORDS", "HTML", "RENDER"]
    
    def __init__(
        self,
        repository: Optional[AiVideoRepository] = None,
        s3_service: Optional[S3Service] = None
    ):
        """Initialize video generation service."""
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info("[VideoGenService] Initializing video generation service")
        
        self.repository = repository or AiVideoRepository()
        self.s3_service = s3_service or S3Service()
        
        # Path to ai-video-gen-main directory
        self.video_gen_root = Path(__file__).parent.parent / "ai-video-gen-main"
        
        logger.info(f"[VideoGenService] Looking for ai-video-gen-main at: {self.video_gen_root}")
        logger.info(f"[VideoGenService] Path exists: {self.video_gen_root.exists()}")
        
        # Ensure the video generation code exists
        if not self.video_gen_root.exists():
            logger.error(f"[VideoGenService] ai-video-gen-main NOT FOUND at {self.video_gen_root}")
            raise RuntimeError(
                f"AI video generation code not found at {self.video_gen_root}. "
                "Please ensure ai-video-gen-main directory is present."
            )
        
        # Pre-download NLTK data if needed (prevents blocking during video generation)
        logger.info("[VideoGenService] Pre-downloading NLTK data...")
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
            logger.info("[VideoGenService] NLTK data pre-downloaded successfully")
        except Exception as e:
            logger.warning(f"[VideoGenService] Failed to pre-download NLTK data: {e}. Will download on first use.")
        
        logger.info("[VideoGenService] Video generation service initialized successfully")
    
    async def generate_till_stage(
        self,
        video_id: str,
        prompt: str,
        target_stage: str,
        language: str = "English",
        captions_enabled: bool = True,
        html_quality: str = "advanced",
        resume: bool = False
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        Generate video up to a specific stage with SSE progress updates.
        
        Args:
            video_id: Unique video identifier
            prompt: Text prompt for video generation
            target_stage: Target stage (SCRIPT, TTS, WORDS, HTML, RENDER)
            language: Language for video content
            resume: Whether to resume from existing progress
            
        Yields:
            SSE events with progress updates
        """
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"[VideoGenService] generate_till_stage called with video_id={video_id}, target={target_stage}, resume={resume}")
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
            video_record = self.repository.create(
                video_id=video_id,
                prompt=prompt,
                language=language
            )
            yield {
                "type": "progress",
                "stage": "PENDING",
                "message": "Video generation initialized",
                "video_id": video_id,
                "percentage": 0
            }
        
        # Determine starting stage
        if resume:
            start_stage_idx = self.STAGES.index(video_record.current_stage)
            # If already at or past target, just return current state
            if start_stage_idx >= self.STAGES.index(target_stage):
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
                    target_stage_idx=target_stage_idx
                ):
                    # If we get an error event, log it and check if we should stop
                    if event.get("type") == "error":
                        logger.error(f"[VideoGenService] Error event received: {event.get('message', 'Unknown error')}")
                        yield event
                        # Don't continue after error
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
        target_stage_idx: int
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
        gemini_key = settings.gemini_api_key
        
        # API keys loaded from environment (not logging to avoid exposing key status)
        
        if not openrouter_key:
            error_msg = "OPENROUTER_API_KEY not set in environment. Please add it to your .env.stage file."
            logger.error(f"[VideoGenService] {error_msg}")
            raise ValueError(error_msg)
        
        pipeline = VideoGenerationPipeline(
            openrouter_key=openrouter_key,
            gemini_image_key=gemini_key or "",  # Pass Gemini key for image generation
            runs_dir=work_dir.parent
        )
        
        # Map stage indices to pipeline stage names and file keys
        stage_config = {
            1: {"name": "script", "file_key": "script", "file_name": "script.txt"},
            2: {"name": "tts", "file_key": "audio", "file_name": "narration.mp3"},
            3: {"name": "words", "file_key": "words", "file_name": "narration.words.json"},
            4: {"name": "html", "file_key": "timeline", "file_name": "time_based_frame.json"},
            5: {"name": "render", "file_key": "video", "file_name": "output.mp4"}
        }
        
        # Determine start_from and stop_at parameters
        start_from = stage_config[start_stage_idx]["name"]
        stop_at = stage_config[target_stage_idx]["name"]  # Stop at target stage (e.g., "html")
        
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
        
        # Run pipeline and handle partial failures gracefully
        loop = asyncio.get_event_loop()
        outputs = None
        pipeline_error = None
        
        try:
            # Run pipeline in thread pool with stop_at to prevent rendering
            logger.info(f"[VideoGenService] Running pipeline: start_from={start_from}, stop_at={stop_at}, language={language}, captions={captions_enabled}, html_quality={html_quality}")
            with ThreadPoolExecutor() as executor:
                outputs = await loop.run_in_executor(
                    executor,
                    pipeline.run,
                    prompt,  # base_prompt
                    video_id,  # run_name
                    None,  # resume_run
                    start_from,  # start_from
                    stop_at,  # stop_at - stops at target stage (e.g., "html" to skip render)
                    language,  # language
                    captions_enabled,  # show_captions
                    html_quality  # html_quality
                )
            logger.info(f"[VideoGenService] Pipeline completed successfully")
        except Exception as e:
            import traceback
            pipeline_error = str(e)
            error_traceback = traceback.format_exc()
            logger.error(f"[VideoGenService] Pipeline failed: {pipeline_error}")
            logger.error(f"[VideoGenService] Full traceback:\n{error_traceback}")
            # Don't raise yet - try to recover partial files
        
        # Map of expected files for each stage
        file_map = {
            "script": [("script_path", "script", "script.txt")],
            "tts": [("audio_path", "audio", "narration.mp3")],
            "words": [
                ("words_json", "words", "narration.words.json"),
                (None, "alignment", "alignment.json")  # alignment.json (not in outputs dict)
            ],
            "html": [
                (None, "generated_images", "generated_images"),  # Directory - process FIRST to build image mapping
                ("timeline_json", "timeline", "time_based_frame.json")  # Process AFTER images to update URLs
            ],
            "render": [("video_path", "video", "output.mp4")]
        }
        
        # Pipeline creates run_dir at runs_dir / video_id
        # Since runs_dir = work_dir.parent and work_dir = temp_dir / video_id,
        # the actual run_dir should be: work_dir.parent / video_id = temp_dir / video_id = work_dir
        # But check both possibilities due to potential double nesting
        possible_dirs = [
            work_dir,  # Direct work_dir
            work_dir.parent / video_id,  # runs_dir / video_id
            work_dir / video_id,  # In case of double nesting
        ]
        
        run_dir = None
        for possible_dir in possible_dirs:
            if possible_dir.exists():
                # Verify it has expected files
                if (possible_dir / "script.txt").exists() or (possible_dir / "narration.mp3").exists():
                    run_dir = possible_dir
                    logger.info(f"[VideoGenService] Found run_dir: {run_dir}")
                    break
        
        if not run_dir:
            # Default to work_dir if none found
            run_dir = work_dir
            logger.warning(f"[VideoGenService] Could not find run_dir, using default: {run_dir}")
        
        # Also check if outputs contain file paths to locate run_dir
        if not run_dir.exists() and outputs:
            for key, value in outputs.items():
                if value and isinstance(value, (str, Path)):
                    try:
                        # Use raw string to avoid regex escape issues
                        path_str = str(value).replace('\\', '/')  # Normalize path separators
                        potential_dir = Path(value).parent
                        if potential_dir.exists():
                            # Check if video_id is in the path (normalized)
                            path_str_normalized = str(potential_dir).replace('\\', '/')
                            if video_id in path_str_normalized:
                                run_dir = potential_dir
                                logger.info(f"[VideoGenService] Found run_dir from output {key}: {run_dir}")
                                break
                    except Exception as e:
                        logger.warning(f"[VideoGenService] Could not parse path from {key}: {e}")
        
        logger.info(f"[VideoGenService] Checking for generated files in {run_dir} (exists: {run_dir.exists()})")
        
        # List all files in run_dir if it exists (for debugging)
        if run_dir.exists():
            try:
                all_files = list(run_dir.glob("*"))
                logger.info(f"[VideoGenService] Found {len(all_files)} files in run_dir: {[f.name for f in all_files]}")
            except Exception as e:
                logger.warning(f"[VideoGenService] Could not list files in {run_dir}: {e}")
        
        # Process each stage and upload whatever files exist
        # Store image path mapping for updating time_based_frame.json
        image_path_mapping = {}  # Maps local file paths to S3 URLs
        
        for stage_idx in range(start_stage_idx, target_stage_idx + 1):
            stage_name = self.STAGES[stage_idx]
            config = stage_config[stage_idx]
            percentage = 5 + int((stage_idx - start_stage_idx + 1) * percentage_per_stage)
            
            files_to_check = file_map.get(config["name"], [])
            uploaded_files = {}
            stage_has_files = False
            
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
                                                
                                                # Update image URLs in HTML
                                                updated_count = 0
                                                total_entries = len(timeline_data)
                                                
                                                for entry_idx, entry in enumerate(timeline_data):
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
                                                        file_url_pattern = r'src=["\'](file://[^"\']+)["\']'
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
                                                    logger.warning(f"[VideoGenService] ⚠️  No image references were updated in {file_name}. Check image_path_mapping and HTML content.")
                                                    # Log sample of what's in the mapping for debugging
                                                    if image_path_mapping:
                                                        sample_keys = list(image_path_mapping.keys())[:3]
                                                        logger.debug(f"[VideoGenService] Sample image_path_mapping keys: {sample_keys}")
                                                        # Check if HTML contains any file:// URLs
                                                        file_urls_in_html = re.findall(r'src=["\'](file://[^"\']+)["\']', timeline_data[0].get("html", ""))
                                                        if file_urls_in_html:
                                                            logger.debug(f"[VideoGenService] Found file:// URLs in HTML: {file_urls_in_html[:3]}")
                                            except Exception as e:
                                                logger.warning(f"[VideoGenService] Failed to update image URLs in {file_name}: {e}. Uploading original file.", exc_info=True)
                                        else:
                                            logger.info(f"[VideoGenService] No image mappings found, skipping URL update in {file_name}")
                                    
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
                                        if "server closed the connection" in str(db_error) or "OperationalError" in str(type(db_error).__name__):
                                            if retry < max_db_retries - 1:
                                                logger.warning(f"[VideoGenService] Database connection error (attempt {retry + 1}/{max_db_retries}): {db_error}. Retrying...")
                                                import time
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
                                logger.error(f"[VideoGenService] Failed to upload {file_key}: {e}", exc_info=True)
                    except Exception as e:
                        logger.warning(f"[VideoGenService] Could not process file path {file_path}: {e}")
            
            if stage_has_files:
                # Update stage status
                self.repository.update_stage(
                    video_id=video_id,
                    stage=stage_name,
                    status="COMPLETED"
                )
                
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

