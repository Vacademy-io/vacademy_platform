from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from ..db import db_dependency
from ..domain.course_metadata import (
    CourseMetadata,
    SubjectMetadata,
    ModuleMetadata,
    ChapterMetadata,
    SlideMetadata
)
from ..ports.course_metadata_port import CourseMetadataPort


class AdminCoreCourseMetadataClient(CourseMetadataPort):
    """
    Skeleton implementation of CourseMetadataPort that is intended to read from
    the admin-core-service database.

    For now, this acts as a thin adapter around SQLAlchemy Sessions and returns
    None. You can extend this class to query the concrete tables (e.g. package,
    subject, chapter) and map them into CourseMetadata.
    """

    async def load_course_metadata(
        self, course_id: str, institute_id: str
    ) -> Optional[CourseMetadata]:
        """
        Load course metadata from admin-core-service database.

        Example implementation would:
        1. Query PackageEntity for course details
        2. Based on course.depth, query appropriate child entities:
           - depth=5: subjects → modules → chapters → slides
           - depth=4: modules → chapters → slides
           - depth=3: chapters → slides
           - depth=2: slides directly
        """
        # TODO: Implement actual database queries
        # Example structure:
        """
        from ..db import db_session
        from .models import PackageEntity, SubjectEntity, ModuleEntity, ChapterEntity, SlideEntity

        with db_session() as session:
            # Query course
            course = session.query(PackageEntity).filter_by(id=course_id).first()
            if not course:
                return None

            # Build metadata based on depth
            metadata = CourseMetadata(
                id=course.id,
                name=course.name,
                description=course.description,
                depth=course.depth or 3
            )

            if course.depth >= 5:
                # Load subjects for 5-depth courses
                metadata.subjects = [...]
            if course.depth >= 4:
                # Load modules for 4-5 depth courses
                metadata.modules = [...]
            if course.depth >= 3:
                # Load chapters for 3-5 depth courses
                metadata.chapters = [...]
            # Load slides for all depths
            metadata.slides = [...]

            return metadata
        """
        return None


__all__ = ["AdminCoreCourseMetadataClient"]


