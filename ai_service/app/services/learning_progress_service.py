"""
Service for fetching and formatting learning progress data from learner_operation table.
"""
from __future__ import annotations

import logging
from typing import Dict, Any, List, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class LearningProgressService:
    """
    Handles fetching learning progress, building hierarchical paths,
    and formatting data for AI consumption.
    """
    
    def __init__(self, db_session: Session):
        self.db = db_session
    
    async def get_learning_progress(
        self,
        user_id: str,
        source_filter: Optional[str] = None,
        include_recent_activity: bool = True
    ) -> Dict[str, Any]:
        """
        Fetch comprehensive learning progress for a user.
        
        Args:
            user_id: Student's user ID
            source_filter: Optional filter ('SLIDE', 'CHAPTER', 'MODULE', 'SUBJECT', 'PACKAGE_SESSION')
            include_recent_activity: Whether to include recent video timestamps, last viewed slides
            
        Returns:
            Structured progress data with hierarchical paths
        """
        try:
            # Build query dynamically based on whether source_filter is provided
            if source_filter:
                query = text("""
                    WITH learner_data AS (
                        SELECT 
                            lo.id,
                            lo.user_id,
                            lo.source,
                            lo.source_id,
                            lo.operation,
                            lo.value,
                            lo.updated_at,
                            -- Get names for each level based on source
                            CASE 
                                WHEN lo.source = 'SLIDE' THEN s.title
                                WHEN lo.source = 'CHAPTER' THEN c.chapter_name
                                WHEN lo.source = 'MODULE' THEN m.module_name
                                WHEN lo.source = 'SUBJECT' THEN subj.subject_name
                                WHEN lo.source = 'PACKAGE_SESSION' THEN pkg.package_name
                            END as entity_name
                        FROM learner_operation lo
                        LEFT JOIN slide s ON lo.source = 'SLIDE' AND lo.source_id = s.id
                        LEFT JOIN chapter c ON lo.source = 'CHAPTER' AND lo.source_id = c.id
                        LEFT JOIN modules m ON lo.source = 'MODULE' AND lo.source_id = m.id
                        LEFT JOIN subject subj ON lo.source = 'SUBJECT' AND lo.source_id = subj.id
                        LEFT JOIN package_session ps ON lo.source = 'PACKAGE_SESSION' AND lo.source_id = ps.id
                        LEFT JOIN package pkg ON ps.package_id = pkg.id
                        WHERE lo.user_id = :user_id AND lo.source = :source_filter
                        ORDER BY lo.updated_at DESC
                    )
                    SELECT * FROM learner_data
                """)
                result = self.db.execute(query, {
                    "user_id": user_id,
                    "source_filter": source_filter
                })
            else:
                query = text("""
                    WITH learner_data AS (
                        SELECT 
                            lo.id,
                            lo.user_id,
                            lo.source,
                            lo.source_id,
                            lo.operation,
                            lo.value,
                            lo.updated_at,
                            -- Get names for each level based on source
                            CASE 
                                WHEN lo.source = 'SLIDE' THEN s.title
                                WHEN lo.source = 'CHAPTER' THEN c.chapter_name
                                WHEN lo.source = 'MODULE' THEN m.module_name
                                WHEN lo.source = 'SUBJECT' THEN subj.subject_name
                                WHEN lo.source = 'PACKAGE_SESSION' THEN pkg.package_name
                            END as entity_name
                        FROM learner_operation lo
                        LEFT JOIN slide s ON lo.source = 'SLIDE' AND lo.source_id = s.id
                        LEFT JOIN chapter c ON lo.source = 'CHAPTER' AND lo.source_id = c.id
                        LEFT JOIN modules m ON lo.source = 'MODULE' AND lo.source_id = m.id
                        LEFT JOIN subject subj ON lo.source = 'SUBJECT' AND lo.source_id = subj.id
                        LEFT JOIN package_session ps ON lo.source = 'PACKAGE_SESSION' AND lo.source_id = ps.id
                        LEFT JOIN package pkg ON ps.package_id = pkg.id
                        WHERE lo.user_id = :user_id
                        ORDER BY lo.updated_at DESC
                    )
                    SELECT * FROM learner_data
                """)
                result = self.db.execute(query, {"user_id": user_id})
            rows = result.fetchall()
            
            if not rows:
                return {
                    "progress_by_source": [],
                    "overall_progress": {"note": "No learning activity found"},
                    "recent_activity": []
                }
            
            # Process data
            progress_by_source = {}
            recent_activity = []
            percentage_operations = []
            
            for row in rows:
                source = row[2]  # source
                source_id = row[3]  # source_id
                operation = row[4]  # operation
                value = row[5]  # value
                entity_name = row[7]  # entity_name
                
                # Group by source + source_id
                key = f"{source}:{source_id}"
                
                if key not in progress_by_source:
                    progress_by_source[key] = {
                        "source": source,
                        "source_id": source_id,
                        "entity_name": entity_name or f"Unknown {source}",
                        "operations": {}
                    }
                
                progress_by_source[key]["operations"][operation] = value
                
                # Track percentage operations for overall progress
                if "PERCENTAGE" in operation and operation.endswith("_COMPLETED"):
                    try:
                        percentage_operations.append(int(value))
                    except (ValueError, TypeError):
                        pass
                
                # Track recent activity (last viewed, video timestamps)
                if include_recent_activity:
                    if operation == "LAST_SLIDE_VIEWED":
                        recent_activity.append({
                            "type": "last_viewed_slide",
                            "slide_id": value,
                            "entity_name": entity_name
                        })
                    elif operation == "VIDEO_LAST_TIMESTAMP":
                        try:
                            ms = int(value)
                            recent_activity.append({
                                "type": "video_progress",
                                "entity_name": entity_name,
                                "timestamp_ms": ms,
                                "timestamp_formatted": self._format_ms_to_time(ms)
                            })
                        except (ValueError, TypeError):
                            pass
            
            # Build hierarchical paths
            progress_with_paths = await self._build_hierarchical_paths(
                list(progress_by_source.values())
            )
            
            # Calculate overall progress
            overall_progress = {
                "total_items_tracked": len(progress_by_source),
                "average_completion": (
                    sum(percentage_operations) // len(percentage_operations)
                    if percentage_operations else 0
                )
            }
            
            # Get next learning recommendation
            next_recommendation = await self._get_next_recommendation(
                user_id=user_id,
                recent_activity=recent_activity
            )
            
            return {
                "progress_by_source": progress_with_paths,
                "overall_progress": overall_progress,
                "recent_activity": recent_activity[:10],  # Limit to 10 most recent
                "next_recommendation": next_recommendation
            }
            
        except Exception as e:
            logger.error(f"Error fetching learning progress: {e}")
            return {
                "progress_by_source": [],
                "overall_progress": {"error": "Failed to fetch progress data"},
                "recent_activity": [],
                "next_recommendation": None
            }
    
    async def _build_hierarchical_paths(self, progress_items: List[Dict]) -> List[Dict]:
        """
        Build hierarchical paths for each progress item.
        Course > Subject > Module > Chapter > Slide (skip 'default' levels)
        """
        for item in progress_items:
            source = item["source"]
            source_id = item["source_id"]
            
            # Build path based on source type
            try:
                if source == "SLIDE":
                    path = await self._get_slide_path(source_id)
                elif source == "CHAPTER":
                    path = await self._get_chapter_path(source_id)
                elif source == "MODULE":
                    path = await self._get_module_path(source_id)
                elif source == "SUBJECT":
                    path = await self._get_subject_path(source_id)
                elif source == "PACKAGE_SESSION":
                    path = await self._get_package_session_path(source_id)
                else:
                    path = item["entity_name"]
                
                item["path"] = path
            except Exception as e:
                logger.error(f"Error building path for {source}:{source_id}: {e}")
                item["path"] = item["entity_name"]
        
        return progress_items
    
    async def _get_slide_path(self, slide_id: str) -> str:
        """Build path: Course > Subject > Module > Chapter > Slide"""
        query = text("""
            SELECT 
                pkg.package_name as course,
                subj.subject_name,
                m.module_name,
                c.chapter_name,
                s.title as slide_name
            FROM slide s
            JOIN chapter_to_slides cts ON s.id = cts.slide_id AND cts.status != 'DELETED'
            JOIN chapter c ON cts.chapter_id = c.id
            LEFT JOIN module_chapter_mapping mcm ON c.id = mcm.chapter_id
            LEFT JOIN modules m ON mcm.module_id = m.id
            LEFT JOIN subject_module_mapping smm ON m.id = smm.module_id
            LEFT JOIN subject subj ON smm.subject_id = subj.id
            LEFT JOIN subject_chapter_module_and_package_session_mapping scmps ON subj.id = scmps.subject_id
            LEFT JOIN package_session ps ON scmps.package_session_id = ps.id
            LEFT JOIN package pkg ON ps.package_id = pkg.id
            WHERE s.id = :slide_id
            LIMIT 1
        """)
        
        result = self.db.execute(query, {"slide_id": slide_id})
        row = result.fetchone()
        
        if not row:
            return "Unknown Path"
        
        course, subject, module, chapter, slide = row
        return self._format_path(course, subject, module, chapter, slide)
    
    async def _get_chapter_path(self, chapter_id: str) -> str:
        """Build path: Course > Subject > Module > Chapter"""
        query = text("""
            SELECT 
                pkg.package_name as course,
                subj.subject_name,
                m.module_name,
                c.chapter_name
            FROM chapter c
            LEFT JOIN module_chapter_mapping mcm ON c.id = mcm.chapter_id
            LEFT JOIN modules m ON mcm.module_id = m.id
            LEFT JOIN subject_module_mapping smm ON m.id = smm.module_id
            LEFT JOIN subject subj ON smm.subject_id = subj.id
            LEFT JOIN subject_chapter_module_and_package_session_mapping scmps ON subj.id = scmps.subject_id
            LEFT JOIN package_session ps ON scmps.package_session_id = ps.id
            LEFT JOIN package pkg ON ps.package_id = pkg.id
            WHERE c.id = :chapter_id
            LIMIT 1
        """)
        
        result = self.db.execute(query, {"chapter_id": chapter_id})
        row = result.fetchone()
        
        if not row:
            return "Unknown Path"
        
        course, subject, module, chapter = row
        return self._format_path(course, subject, module, chapter)
    
    async def _get_module_path(self, module_id: str) -> str:
        """Build path: Course > Subject > Module"""
        query = text("""
            SELECT 
                pkg.package_name as course,
                subj.subject_name,
                m.module_name
            FROM modules m
            LEFT JOIN subject_module_mapping smm ON m.id = smm.module_id
            LEFT JOIN subject subj ON smm.subject_id = subj.id
            LEFT JOIN subject_chapter_module_and_package_session_mapping scmps ON subj.id = scmps.subject_id
            LEFT JOIN package_session ps ON scmps.package_session_id = ps.id
            LEFT JOIN package pkg ON ps.package_id = pkg.id
            WHERE m.id = :module_id
            LIMIT 1
        """)
        
        result = self.db.execute(query, {"module_id": module_id})
        row = result.fetchone()
        
        if not row:
            return "Unknown Path"
        
        course, subject, module = row
        return self._format_path(course, subject, module)
    
    async def _get_subject_path(self, subject_id: str) -> str:
        """Build path: Course > Subject"""
        query = text("""
            SELECT 
                pkg.package_name as course,
                subj.subject_name
            FROM subject subj
            LEFT JOIN subject_chapter_module_and_package_session_mapping scmps ON subj.id = scmps.subject_id
            LEFT JOIN package_session ps ON scmps.package_session_id = ps.id
            LEFT JOIN package pkg ON ps.package_id = pkg.id
            WHERE subj.id = :subject_id
            LIMIT 1
        """)
        
        result = self.db.execute(query, {"subject_id": subject_id})
        row = result.fetchone()
        
        if not row:
            return "Unknown Path"
        
        course, subject = row
        return self._format_path(course, subject)
    
    async def _get_package_session_path(self, package_session_id: str) -> str:
        """Build path: Course"""
        query = text("""
            SELECT pkg.package_name as course
            FROM package_session ps
            LEFT JOIN package pkg ON ps.package_id = pkg.id
            WHERE ps.id = :package_session_id
            LIMIT 1
        """)
        
        result = self.db.execute(query, {"package_session_id": package_session_id})
        row = result.fetchone()
        
        if not row:
            return "Unknown Path"
        
        return row[0]
    
    def _format_path(self, *parts) -> str:
        """
        Format hierarchical path, skipping 'default' levels.
        Course and last level (Slide/Chapter) are always included.
        """
        # Filter out None, empty strings, and 'default' (case-insensitive)
        filtered = [
            p for p in parts 
            if p and str(p).strip() and str(p).strip().lower() != 'default'
        ]
        
        if not filtered:
            return "Unknown Path"
        
        # Ensure we always have course (first) and entity name (last)
        if len(filtered) == 0:
            return "Unknown Path"
        
        return " > ".join(filtered)
    
    async def _get_next_recommendation(
        self,
        user_id: str,
        recent_activity: List[Dict]
    ) -> Optional[Dict[str, Any]]:
        """
        Determine what the student should learn next based on last viewed slide.
        
        Args:
            user_id: Student's user ID
            recent_activity: List of recent activities
            
        Returns:
            Next recommendation with slide details and path, or None if not found
        """
        try:
            # Find last viewed slide from recent activity
            last_viewed_slide_id = None
            for activity in recent_activity:
                if activity.get("type") == "last_viewed_slide":
                    last_viewed_slide_id = activity.get("slide_id")
                    break
            
            if not last_viewed_slide_id:
                logger.info(f"No last viewed slide found for user {user_id}")
                return None
            
            # Query next slide in sequence
            query = text("""
                WITH current_slide_info AS (
                    SELECT 
                        cts.chapter_id,
                        cts.slide_id,
                        cts.slide_order,
                        s.title as current_slide_name,
                        c.chapter_name as current_chapter_name
                    FROM chapter_to_slides cts
                    JOIN slide s ON cts.slide_id = s.id
                    JOIN chapter c ON cts.chapter_id = c.id
                    WHERE cts.slide_id = :slide_id
                      AND cts.status != 'DELETED'
                    LIMIT 1
                )
                SELECT 
                    next_cts.slide_id as next_slide_id,
                    next_s.title as next_slide_name,
                    next_s.source_type,
                    next_cts.slide_order as next_slide_order,
                    c.chapter_name,
                    csi.current_slide_name,
                    csi.slide_order as current_slide_order,
                    csi.current_chapter_name
                FROM current_slide_info csi
                JOIN chapter_to_slides next_cts ON next_cts.chapter_id = csi.chapter_id
                JOIN slide next_s ON next_cts.slide_id = next_s.id
                JOIN chapter c ON next_cts.chapter_id = c.id
                WHERE next_cts.slide_order > csi.slide_order
                  AND next_cts.status != 'DELETED'
                ORDER BY next_cts.slide_order ASC
                LIMIT 1
            """)
            
            result = self.db.execute(query, {"slide_id": last_viewed_slide_id})
            row = result.fetchone()
            
            if not row:
                logger.info(f"No next slide found after {last_viewed_slide_id} for user {user_id}")
                return {
                    "status": "chapter_complete",
                    "message": "You've completed this chapter! Great work! 🎉"
                }
            
            # Build hierarchical path for next slide
            path = await self._get_slide_path(row.next_slide_id)
            
            return {
                "status": "next_available",
                "recommended_slide": {
                    "slide_id": row.next_slide_id,
                    "slide_name": row.next_slide_name,
                    "source_type": row.source_type,
                    "slide_order": row.next_slide_order,
                    "chapter_name": row.chapter_name
                },
                "current_position": {
                    "slide_name": row.current_slide_name,
                    "slide_order": row.current_slide_order,
                    "chapter_name": row.current_chapter_name
                },
                "path": path,
                "recommendation_type": "NEXT_IN_CHAPTER",
                "message": f"Continue with '{row.next_slide_name}' in {row.chapter_name} chapter"
            }
            
        except Exception as e:
            logger.error(f"Error getting next recommendation for user {user_id}: {e}")
            return None
    
    def _format_ms_to_time(self, milliseconds: int) -> str:
        """Convert milliseconds to human-readable time format."""
        seconds = milliseconds // 1000
        minutes = seconds // 60
        remaining_seconds = seconds % 60
        
        if minutes > 60:
            hours = minutes // 60
            remaining_minutes = minutes % 60
            return f"{hours}h {remaining_minutes}m {remaining_seconds}s"
        elif minutes > 0:
            return f"{minutes}m {remaining_seconds}s"
        else:
            return f"{remaining_seconds}s"


__all__ = ["LearningProgressService"]
