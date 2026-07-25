package vacademy.io.admin_core_service.features.course_pulse.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.course_pulse.dto.PulseCountsProjection;
import vacademy.io.admin_core_service.features.course_pulse.dto.PulseRosterRowProjection;
import vacademy.io.admin_core_service.features.learner_tracking.entity.ActivityLog;

import java.time.Instant;
import java.util.List;

/**
 * Read-only queries for Course Pulse. All are bounded by the active set (rows whose
 * last_seen_at is inside the offline window), so cost scales with concurrent learners,
 * not with the size of activity_log.
 *
 * The "latest per learner" subquery uses DISTINCT ON (user_id) ordered by last_seen_at DESC,
 * so a learner with several open slide rows collapses to their most recent one. Time fields
 * are computed against now() in SQL; unquoted camelCase aliases are lower-cased by Postgres
 * and matched case-insensitively to the projection getters.
 */
public interface PulseRepository extends JpaRepository<ActivityLog, String> {

    @Query(value = """
            SELECT userId, fullName, slideId, slideTitle, slideType, chapterId,
                   onSlideSeconds, lastSeenAgoSeconds
            FROM (
                SELECT DISTINCT ON (al.user_id)
                       al.user_id                                                AS userId,
                       st.full_name                                              AS fullName,
                       al.slide_id                                               AS slideId,
                       sl.title                                                  AS slideTitle,
                       sl.source_type                                            AS slideType,
                       cts.chapter_id                                            AS chapterId,
                       EXTRACT(EPOCH FROM (now() - al.created_at))::bigint        AS onSlideSeconds,
                       EXTRACT(EPOCH FROM (now() - al.last_seen_at))::bigint      AS lastSeenAgoSeconds
                FROM activity_log al
                    JOIN chapter_to_slides cts
                        ON cts.slide_id = al.slide_id AND cts.status <> 'DELETED'
                    JOIN chapter_package_session_mapping m
                        ON m.chapter_id = cts.chapter_id AND m.status <> 'DELETED'
                    JOIN slide sl ON sl.id = al.slide_id
                    LEFT JOIN student st ON st.user_id = al.user_id
                WHERE m.package_session_id = :batchId
                  AND al.last_seen_at > :offlineCutoff
                ORDER BY al.user_id, al.last_seen_at DESC
            ) latest
            ORDER BY
                CASE
                    WHEN lastSeenAgoSeconds <= :activeWindowSeconds
                         AND onSlideSeconds >= :stuckThresholdSeconds THEN 0
                    WHEN lastSeenAgoSeconds >  :activeWindowSeconds        THEN 1
                    ELSE 2
                END,
                onSlideSeconds DESC
            LIMIT :limitCount
            """, nativeQuery = true)
    List<PulseRosterRowProjection> getRoster(@Param("batchId") String batchId,
                                             @Param("offlineCutoff") Instant offlineCutoff,
                                             @Param("activeWindowSeconds") long activeWindowSeconds,
                                             @Param("stuckThresholdSeconds") long stuckThresholdSeconds,
                                             @Param("limitCount") int limitCount);

    @Query(value = """
            SELECT
                COUNT(*) FILTER (WHERE lastSeenAgoSeconds <= :activeWindowSeconds)                AS activeCount,
                COUNT(*) FILTER (WHERE lastSeenAgoSeconds >  :activeWindowSeconds)                AS idleCount,
                COUNT(*) FILTER (WHERE lastSeenAgoSeconds <= :activeWindowSeconds
                                   AND onSlideSeconds     >= :stuckThresholdSeconds)              AS needHelpCount
            FROM (
                SELECT DISTINCT ON (al.user_id)
                       EXTRACT(EPOCH FROM (now() - al.created_at))::bigint    AS onSlideSeconds,
                       EXTRACT(EPOCH FROM (now() - al.last_seen_at))::bigint  AS lastSeenAgoSeconds
                FROM activity_log al
                    JOIN chapter_to_slides cts
                        ON cts.slide_id = al.slide_id AND cts.status <> 'DELETED'
                    JOIN chapter_package_session_mapping m
                        ON m.chapter_id = cts.chapter_id AND m.status <> 'DELETED'
                WHERE m.package_session_id = :batchId
                  AND al.last_seen_at > :offlineCutoff
                ORDER BY al.user_id, al.last_seen_at DESC
            ) latest
            """, nativeQuery = true)
    PulseCountsProjection getCounts(@Param("batchId") String batchId,
                                    @Param("offlineCutoff") Instant offlineCutoff,
                                    @Param("activeWindowSeconds") long activeWindowSeconds,
                                    @Param("stuckThresholdSeconds") long stuckThresholdSeconds);

    @Query(value = """
            SELECT COUNT(*)
            FROM student_session_institute_group_mapping
            WHERE package_session_id = :batchId
              AND status = 'ACTIVE'
            """, nativeQuery = true)
    long countEnrolled(@Param("batchId") String batchId);
}
