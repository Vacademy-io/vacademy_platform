"""
Image generation and S3 upload service for course images.

This service handles:
1. Generating course banner and preview images based on course metadata
2. Uploading images to S3
3. Returning S3 URLs for the generated images
"""

from typing import Optional, Tuple
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
        image_style: str = "professional"
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """
        Generate banner, preview, and media images for a course.
        
        Args:
            course_name: Name of the course
            about_course: Course description
            course_depth: Course hierarchy depth
            image_style: Style preference for images
        
        Returns:
            Tuple of (banner_image_url, preview_image_url, media_image_url)
            Returns (None, None, None) if generation fails or S3 is not configured
        """
        try:
            logger.info(f"Generating images for course: {course_name}")

            # If S3 is not configured, return None
            if not self._s3_client or not self._s3_bucket:
                logger.warning("S3 client or bucket not configured. Skipping image generation.")
                return None, None, None

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
                banner_url = await asyncio.wait_for(
                    self._generate_and_upload_banner(
                        course_name=course_name,
                        prompt=banner_prompt
                    ),
                    timeout=15.0  # 15 seconds for banner
                )
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
                preview_url = await asyncio.wait_for(
                    self._generate_and_upload_preview(
                        course_name=course_name,
                        prompt=preview_prompt
                    ),
                    timeout=15.0  # 15 seconds for preview
                )
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
                media_url = await asyncio.wait_for(
                    self._generate_and_upload_media(
                        course_name=course_name,
                        prompt=media_prompt
                    ),
                    timeout=15.0  # 15 seconds for media
                )
            except asyncio.TimeoutError:
                logger.warning("Media image generation timed out")
                media_url = None
            except Exception as e:
                logger.error(f"Media image generation failed: {str(e)}")
                media_url = None
            
            logger.info(f"Successfully generated images. Banner: {banner_url}, Preview: {preview_url}, Media: {media_url}")
            return banner_url, preview_url, media_url
            
        except Exception as e:
            logger.error(f"Failed to generate images: {str(e)}")
            return None, None, None

    def _slugify(self, text: str) -> str:
        """Convert text to slug format (lowercase, dashes)"""
        return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
    
    async def _generate_and_upload_banner(
        self,
        course_name: str,
        prompt: str
    ) -> Optional[str]:
        """
        Generate banner image (16:9 aspect ratio) using Gemini and upload to S3.

        Args:
            course_name: Name of the course
            prompt: Image generation prompt

        Returns:
            S3 URL of the uploaded banner image or None
        """
        try:
            logger.debug(f"Generating banner for: {course_name}")

            # Generate image using Gemini
            image_data = await self._call_image_generation_llm(prompt, 1200, 400)
            
            if not image_data:
                return None

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

            return s3_url
                
        except Exception as e:
            logger.error(f"Banner generation failed: {str(e)}")
            return None

    async def _generate_and_upload_preview(
        self,
        course_name: str,
        prompt: str
    ) -> Optional[str]:
        """
        Generate preview image (16:9 aspect ratio) using Gemini and upload to S3.

        Args:
            course_name: Name of the course
            prompt: Image generation prompt

        Returns:
            S3 URL of the uploaded preview image or None
        """
        try:
            logger.debug(f"Generating preview for: {course_name}")

            # Generate image using Gemini
            image_data = await self._call_image_generation_llm(prompt, 400, 300)
            
            if not image_data:
                return None

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

            return s3_url
                
        except Exception as e:
            logger.error(f"Preview generation failed: {str(e)}")
            return None

    async def _generate_and_upload_media(
        self,
        course_name: str,
        prompt: str
    ) -> Optional[str]:
        """
        Generate media image (16:9 aspect ratio) using Gemini and upload to S3.

        Args:
            course_name: Name of the course
            prompt: Image generation prompt

        Returns:
            S3 URL of the uploaded media image or None
        """
        try:
            logger.debug(f"Generating media image for: {course_name}")

            # Generate image using Gemini
            image_data = await self._call_image_generation_llm(prompt, 800, 800)
            
            if not image_data:
                return None

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

            return s3_url
                
        except Exception as e:
            logger.error(f"Media image generation failed: {str(e)}")
            return None
    
    async def _call_image_generation_llm(self, prompt: str, width: int, height: int) -> Optional[bytes]:
        """
        Generate image using Google Generative AI (Gemini).

        Args:
            prompt: Image generation prompt
            width: Image width
            height: Image height

        Returns:
            Image bytes or None if generation fails
        """
        try:
            if not self._gemini_api_key:
                return None

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key={self._gemini_api_key}",
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
                return None

            data = response.json()

            # Check if response has inlineData directly
            if "inlineData" in data:
                inline_data = data["inlineData"]
                mime_type = inline_data.get("mimeType", "")
                data_b64 = inline_data.get("data", "")

                if mime_type and data_b64 and mime_type.startswith("image/"):
                    import base64
                    try:
                        image_bytes = base64.b64decode(data_b64)
                        return image_bytes
                    except Exception as decode_err:
                        logger.error(f"Base64 decode error: {decode_err}")
                        return None

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
                                    return image_bytes
                                except Exception as decode_err:
                                    logger.error(f"Base64 decode error: {decode_err}")
                                    return None

            return None

        except Exception as e:
            logger.error(f"Gemini image generation failed: {str(e)}")
            return None

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

