from __future__ import annotations

from typing import Protocol, Optional

from ..domain.course_metadata import CourseMetadata


class CourseMetadataPort(Protocol):
    """
    Port abstraction for loading course metadata from admin-core-service.

    The core outline service does not know whether this comes from direct DB access,
    another HTTP service, or a cache layer.
    """

    async def load_course_metadata(
        self, course_id: str, institute_id: str
    ) -> Optional[CourseMetadata]:
        """
        Load metadata for a course if available.

        :param course_id: Identifier of the course in admin-core-service.
        :param institute_id: Identifier of the institute/tenant.
        :return: CourseMetadata if found, otherwise None.
        """
        raise NotImplementedError


__all__ = ["CourseMetadataPort"]



