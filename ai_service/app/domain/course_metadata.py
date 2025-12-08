from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class SubjectMetadata:
    id: str
    name: str
    description: Optional[str] = None
    order: Optional[int] = None


@dataclass
class ModuleMetadata:
    id: str
    name: str
    description: Optional[str] = None
    subject_id: Optional[str] = None  # For 5-depth courses
    order: Optional[int] = None


@dataclass
class ChapterMetadata:
    id: str
    title: str
    subject_id: Optional[str] = None  # For 5-depth courses
    module_id: Optional[str] = None   # For 4-depth courses
    order: Optional[int] = None


@dataclass
class SlideMetadata:
    id: str
    title: str
    chapter_id: str
    content_type: Optional[str] = None  # DOCUMENT, VIDEO, PDF, etc.
    order: Optional[int] = None


@dataclass
class CourseMetadata:
    """
    Minimal domain view of a course as stored in admin-core-service.

    Supports all course depth structures:
    - 5-depth: course → subject → module → chapter → slide
    - 4-depth: course → module → chapter → slide
    - 3-depth: course → chapter → slide
    - 2-depth: course → slide

    Kept intentionally small and decoupled from any concrete DB schema so that
    the adapter can evolve without changing the core outline service.
    """

    id: str
    name: str
    description: Optional[str] = None
    level: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    depth: int = 3  # Default to 3-depth structure

    # Hierarchical components (populated based on depth)
    subjects: List[SubjectMetadata] = field(default_factory=list)  # Used in 5-depth
    modules: List[ModuleMetadata] = field(default_factory=list)    # Used in 4-5 depth
    chapters: List[ChapterMetadata] = field(default_factory=list)  # Used in 3-5 depth
    slides: List[SlideMetadata] = field(default_factory=list)      # Used in all depths


__all__ = [
    "CourseMetadata",
    "SubjectMetadata",
    "ModuleMetadata",
    "ChapterMetadata",
    "SlideMetadata"
]


