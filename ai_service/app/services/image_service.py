"""
Image generation and S3 upload service for course images.

This service handles:
1. Generating course banner and preview images based on course metadata
2. Uploading images to S3
3. Returning S3 URLs for the generated images
"""

from typing import Optional, Tuple, Dict
import logging
import time
import re
import asyncio
from io import BytesIO
import httpx
import json
from .image_prompts import (
    generate_banner_prompt,
    generate_preview_prompt,
    generate_media_prompt
)

logger = logging.getLogger(__name__)


class ImageGenerationService:
    """
    Service for generating and uploading course images.
    
    Currently supports placeholder functionality.
    To enable actual image generation:
    1. Integrate with an image generation API (e.g., DALL-E, Stable Diffusion, or Canvas-based generation)
    2. Configure S3 credentials in config.py
    3. Implement actual upload logic
    """

    def __init__(self, s3_client=None, s3_bucket: Optional[str] = None, gemini_api_key: Optional[str] = None, openrouter_api_key: Optional[str] = None, llm_model: Optional[str] = None):
        """
        Initialize the image generation service.

        Args:
            s3_client: Optional boto3 S3 client for uploads
            s3_bucket: S3 bucket name for storing generated images
            gemini_api_key: Google Generative AI API key for image generation
            openrouter_api_key: OpenRouter API key for keyword generation
            llm_model: LLM model name for keyword generation
        """
        self._s3_client = s3_client
        self._s3_bucket = s3_bucket
        self._gemini_api_key = gemini_api_key
        self._openrouter_api_key = openrouter_api_key
        self._llm_model = llm_model or "google/gemini-2.5-pro"

    async def generate_images(
        self,
        course_name: str,
        about_course: str,
        course_depth: int,
        image_style: str = "professional",
        gemini_key: Optional[str] = None
    ) -> Tuple[Optional[str], Optional[str], Optional[str], Dict[str, int]]:
        """
        Generate banner, preview, and media images for a course.
        
        Args:
            course_name: Name of the course
            about_course: Course description
            course_depth: Course hierarchy depth
            image_style: Style preference for images
            gemini_key: Optional Gemini API key (overrides instance default)
        
        Returns:
            Tuple of (banner_image_url, preview_image_url, media_image_url, total_usage_dict)
            Returns (None, None, None, empty_usage) if generation fails or S3 is not configured
            total_usage_dict contains aggregated token usage across all image generations
        """
        try:
            logger.info(f"Generating images for course: {course_name}")

            # If S3 is not configured, return None
            if not self._s3_client or not self._s3_bucket:
                logger.warning("S3 client or bucket not configured. Skipping image generation.")
                return None, None, None, {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
            
            total_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

            # Get optimal search keyword from LLM for image search
            try:
                base_search_query = await self._get_image_search_keyword(course_name, about_course)
            except Exception as e:
                logger.warning(f"Keyword generation failed: {str(e)}, using course name")
                base_search_query = course_name

            # Generate banner image using Gemini with individual timeout
            banner_prompt = generate_banner_prompt(
                course_name=course_name,
                base_search_query=base_search_query,
                about_course=about_course,
                image_style=image_style
            )
            try:
                banner_result = await asyncio.wait_for(
                    self._generate_and_upload_banner(
                        course_name=course_name,
                        prompt=banner_prompt,
                        gemini_key=gemini_key
                    ),
                    timeout=15.0  # 15 seconds for banner
                )
                banner_url, banner_usage = banner_result
                # Aggregate usage
                total_usage["prompt_tokens"] += banner_usage.get("prompt_tokens", 0)
                total_usage["completion_tokens"] += banner_usage.get("completion_tokens", 0)
                total_usage["total_tokens"] += banner_usage.get("total_tokens", 0)
            except asyncio.TimeoutError:
                logger.warning("Banner generation timed out")
                banner_url = None
            except Exception as e:
                logger.error(f"Banner generation failed: {str(e)}")
                banner_url = None

            # Generate preview image using Gemini with individual timeout (different prompt for variety)
            preview_prompt = generate_preview_prompt(
                course_name=course_name,
                base_search_query=base_search_query,
                about_course=about_course,
                image_style=image_style
            )
            try:
                preview_result = await asyncio.wait_for(
                    self._generate_and_upload_preview(
                        course_name=course_name,
                        prompt=preview_prompt,
                        gemini_key=gemini_key
                    ),
                    timeout=15.0  # 15 seconds for preview
                )
                preview_url, preview_usage = preview_result
                # Aggregate usage
                total_usage["prompt_tokens"] += preview_usage.get("prompt_tokens", 0)
                total_usage["completion_tokens"] += preview_usage.get("completion_tokens", 0)
                total_usage["total_tokens"] += preview_usage.get("total_tokens", 0)
            except asyncio.TimeoutError:
                logger.warning("Preview generation timed out")
                preview_url = None
            except Exception as e:
                logger.error(f"Preview generation failed: {str(e)}")
                preview_url = None

            # Generate media image using Gemini with individual timeout (different prompt for variety)
            media_prompt = generate_media_prompt(
                course_name=course_name,
                base_search_query=base_search_query,
                about_course=about_course,
                image_style=image_style
            )
            try:
                media_result = await asyncio.wait_for(
                    self._generate_and_upload_media(
                        course_name=course_name,
                        prompt=media_prompt,
                        gemini_key=gemini_key
                    ),
                    timeout=15.0  # 15 seconds for media
                )
                media_url, media_usage = media_result
                # Aggregate usage
                total_usage["prompt_tokens"] += media_usage.get("prompt_tokens", 0)
                total_usage["completion_tokens"] += media_usage.get("completion_tokens", 0)
                total_usage["total_tokens"] += media_usage.get("total_tokens", 0)
            except asyncio.TimeoutError:
                logger.warning("Media image generation timed out")
                media_url = None
            except Exception as e:
                logger.error(f"Media image generation failed: {str(e)}")
                media_url = None
            
            logger.info(f"Successfully generated images. Banner: {banner_url}, Preview: {preview_url}, Media: {media_url}")
            logger.info(f"Total token usage for images: {total_usage}")
            return banner_url, preview_url, media_url, total_usage
            
        except Exception as e:
            logger.error(f"Failed to generate images: {str(e)}")
            return None, None, None, {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

    def _slugify(self, text: str) -> str:
        """Convert text to slug format (lowercase, dashes)"""
        return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
    
    async def _generate_and_upload_banner(
        self,
        course_name: str,
        prompt: str,
        gemini_key: Optional[str] = None
    ) -> Tuple[Optional[str], Dict[str, int]]:
        """
        Generate banner image (16:9 aspect ratio) using Gemini and upload to S3.

        Args:
            course_name: Name of the course
            prompt: Image generation prompt
            gemini_key: Optional Gemini API key (overrides instance default)

        Returns:
            Tuple of (S3 URL, usage_dict) where usage_dict contains token usage
        """
        try:
            logger.debug(f"Generating banner for: {course_name}")

            # Generate image using Gemini
            image_data, usage_info = await self._call_image_generation_llm(prompt, 1200, 400, gemini_key=gemini_key)
            
            if not image_data:
                return None, usage_info

            # Upload to S3
            slugified = self._slugify(course_name)
            timestamp = int(time.time())
            filename = f"course-ai/course_banner_{slugified}_{timestamp}.jpg"

            self._s3_client.put_object(
                Bucket=self._s3_bucket,
                Key=filename,
                Body=image_data,
                ContentType='image/jpeg'
            )

            s3_url = f"https://{self._s3_bucket}.s3.amazonaws.com/{filename}"
            logger.info(f"Banner uploaded to S3: {s3_url}")

            return s3_url, usage_info
                
        except Exception as e:
            logger.error(f"Banner generation failed: {str(e)}")
            return None, {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

    async def _generate_and_upload_preview(
        self,
        course_name: str,
        prompt: str,
        gemini_key: Optional[str] = None
    ) -> Tuple[Optional[str], Dict[str, int]]:
        """
        Generate preview image (16:9 aspect ratio) using Gemini and upload to S3.

        Args:
            course_name: Name of the course
            prompt: Image generation prompt
            gemini_key: Optional Gemini API key (overrides instance default)

        Returns:
            Tuple of (S3 URL, usage_dict) where usage_dict contains token usage
        """
        try:
            logger.debug(f"Generating preview for: {course_name}")

            # Generate image using Gemini
            image_data, usage_info = await self._call_image_generation_llm(prompt, 400, 300, gemini_key=gemini_key)
            
            if not image_data:
                return None, usage_info

            # Upload to S3
            slugified = self._slugify(course_name)
            timestamp = int(time.time())
            filename = f"course-ai/course_preview_{slugified}_{timestamp}.jpg"

            self._s3_client.put_object(
                Bucket=self._s3_bucket,
                Key=filename,
                Body=image_data,
                ContentType='image/jpeg'
            )

            s3_url = f"https://{self._s3_bucket}.s3.amazonaws.com/{filename}"
            logger.info(f"Preview uploaded to S3: {s3_url}")

            return s3_url, usage_info
                
        except Exception as e:
            logger.error(f"Preview generation failed: {str(e)}")
            return None, {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

    async def _generate_and_upload_media(
        self,
        course_name: str,
        prompt: str,
        gemini_key: Optional[str] = None
    ) -> Tuple[Optional[str], Dict[str, int]]:
        """
        Generate media image (16:9 aspect ratio) using Gemini and upload to S3.

        Args:
            course_name: Name of the course
            prompt: Image generation prompt
            gemini_key: Optional Gemini API key (overrides instance default)

        Returns:
            Tuple of (S3 URL, usage_dict) where usage_dict contains token usage
        """
        try:
            logger.debug(f"Generating media image for: {course_name}")

            # Generate image using Gemini
            image_data, usage_info = await self._call_image_generation_llm(prompt, 800, 800, gemini_key=gemini_key)
            
            if not image_data:
                return None, usage_info

            # Upload to S3
            slugified = self._slugify(course_name)
            timestamp = int(time.time())
            filename = f"course-ai/course_media_{slugified}_{timestamp}.jpg"

            self._s3_client.put_object(
                Bucket=self._s3_bucket,
                Key=filename,
                Body=image_data,
                ContentType='image/jpeg'
            )

            s3_url = f"https://{self._s3_bucket}.s3.amazonaws.com/{filename}"
            logger.info(f"Media image uploaded to S3: {s3_url}")

            return s3_url, usage_info
                
        except Exception as e:
            logger.error(f"Media image generation failed: {str(e)}")
            return None, {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
    
    async def _call_image_generation_llm(
        self, 
        prompt: str, 
        width: int, 
        height: int, 
        gemini_key: Optional[str] = None
    ) -> Tuple[Optional[bytes], Dict[str, int]]:
        """
        Generate image using Google Generative AI (Gemini).

        Args:
            prompt: Image generation prompt
            width: Image width
            height: Image height
            gemini_key: Optional Gemini API key (overrides instance default)

        Returns:
            Tuple of (image_bytes, usage_dict) where usage_dict contains:
            - prompt_tokens: int
            - completion_tokens: int (usually 0 for image generation)
            - total_tokens: int
        """
        try:
            # Use provided key or fall back to instance default
            effective_key = gemini_key or self._gemini_api_key
            if not effective_key:
                return None, {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key={effective_key}",
                    headers={
                        "Content-Type": "application/json"
                    },
                    json={
                        "contents": [
                            {
                                "parts": [
                                    {
                                        "text": prompt
                                    }
                                ]
                            }
                        ],
                        "generationConfig": {
                            "imageConfig": {
                                "aspectRatio": "16:9"
                            },
                            "responseModalities": ["IMAGE"]
                        }
                    },
                    timeout=60.0  # Increased timeout for image generation
                )

            if response.status_code != 200:
                logger.error(f"Gemini API error: {response.text}")
                return None, {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

            data = response.json()
            
            # Extract usage information if available
            usage_info = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
            if "usageMetadata" in data:
                usage_meta = data["usageMetadata"]
                usage_info = {
                    "prompt_tokens": usage_meta.get("promptTokenCount", 0),
                    "completion_tokens": usage_meta.get("candidatesTokenCount", 0),
                    "total_tokens": usage_meta.get("totalTokenCount", 0),
                }

            # Check if response has inlineData directly
            if "inlineData" in data:
                inline_data = data["inlineData"]
                mime_type = inline_data.get("mimeType", "")
                data_b64 = inline_data.get("data", "")

                if mime_type and data_b64 and mime_type.startswith("image/"):
                    import base64
                    try:
                        image_bytes = base64.b64decode(data_b64)
                        return image_bytes, usage_info
                    except Exception as decode_err:
                        logger.error(f"Base64 decode error: {decode_err}")
                        return None, usage_info

            # Fallback: Gemini API returns candidates with content parts
            if "candidates" in data and len(data["candidates"]) > 0:
                candidate = data["candidates"][0]
                if "content" in candidate and "parts" in candidate["content"]:
                    for part in candidate["content"]["parts"]:
                        if "inlineData" in part:
                            inline_data = part["inlineData"]
                            mime_type = inline_data.get("mimeType", "")
                            data_b64 = inline_data.get("data", "")

                            if mime_type and data_b64 and mime_type.startswith("image/"):
                                import base64
                                try:
                                    image_bytes = base64.b64decode(data_b64)
                                    return image_bytes, usage_info
                                except Exception as decode_err:
                                    logger.error(f"Base64 decode error: {decode_err}")
                                    return None, usage_info

            return None, usage_info

        except Exception as e:
            logger.error(f"Gemini image generation failed: {str(e)}")
            return None, {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

    async def _get_image_search_keyword(self, course_name: str, about_course: str) -> str:
        """
        Ask LLM to provide an optimal keyword for image search.

        Args:
            course_name: Full course name
            about_course: Course description

        Returns:
            Search keyword suitable for Unsplash (e.g., "programming", "machine learning", "python")
        """
        try:
            if not self._openrouter_api_key:
                return course_name

            prompt = f"""
Given this course information:
Course Name: {course_name}
Course Description: {about_course}

Provide a single, concise keyword (1-3 words max) that would be optimal for searching images on Unsplash.
Choose a keyword that will find high-quality, relevant images. Avoid long titles.

Examples:
- "Python programming" -> "python"
- "Complete Machine Learning Course" -> "machine learning"
- "Web Development with JavaScript" -> "javascript"
- "Data Science Fundamentals" -> "data science"

Return ONLY the keyword, nothing else:
"""

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self._openrouter_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self._llm_model,  # Use same model as course outline
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.3,  # Match course outline temperature
                        "max_tokens": 10
                    },
                    timeout=30.0
                )

                if response.status_code == 200:
                    data = response.json()
                    keyword = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                    if keyword:
                        return keyword

        except Exception as e:
            logger.warning(f"Keyword generation failed: {str(e)}")

        # Fallback to course name
        return course_name


__all__ = ["ImageGenerationService"]

