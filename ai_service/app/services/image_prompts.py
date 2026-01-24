"""
Image prompt generation for course images.

This module contains functions to generate prompts for AI image generation,
separated from the image service logic for better maintainability.
"""


def generate_banner_prompt(
    course_name: str,
    base_search_query: str,
    about_course: str,
    image_style: str = "professional"
) -> str:
    """
    Generate prompt for banner image generation.

    Args:
        course_name: Name of the course
        base_search_query: Search keyword for the course
        about_course: Course description
        image_style: Style preference for images

    Returns:
        Formatted prompt string for banner image generation
    """
    return f"Create a professional {image_style} banner image (16:9 aspect ratio) for a course titled '{course_name}' about {base_search_query}. {about_course[:200]}"


def generate_preview_prompt(
    course_name: str,
    base_search_query: str,
    about_course: str,
    image_style: str = "professional"
) -> str:
    """
    Generate prompt for preview image generation.

    Args:
        course_name: Name of the course
        base_search_query: Search keyword for the course
        about_course: Course description
        image_style: Style preference for images

    Returns:
        Formatted prompt string for preview image generation
    """
    return f"Create a {image_style} thumbnail preview image (16:9 aspect ratio) for course '{course_name}' about {base_search_query} showing key concepts. {about_course[:100]}"


def generate_media_prompt(
    course_name: str,
    base_search_query: str,
    about_course: str,
    image_style: str = "professional"
) -> str:
    """
    Generate prompt for media image generation.

    Args:
        course_name: Name of the course
        base_search_query: Search keyword for the course
        about_course: Course description
        image_style: Style preference for images

    Returns:
        Formatted prompt string for media image generation
    """
    return f"Create a {image_style} media image (16:9 aspect ratio) for course '{course_name}' about {base_search_query} suitable for social media. {about_course[:150]}"


