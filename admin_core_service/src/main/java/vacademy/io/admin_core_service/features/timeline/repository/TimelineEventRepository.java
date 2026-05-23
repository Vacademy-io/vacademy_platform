package vacademy.io.admin_core_service.features.timeline.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.timeline.entity.TimelineEvent;
import vacademy.io.admin_core_service.features.timeline.enums.TimelineCategory;

import java.util.List;

@Repository
public interface TimelineEventRepository extends JpaRepository<TimelineEvent, String> {

    /**
     * Fetch timeline events for a specific entity type and ID, ordered by creation
     * date descending.
     * This powers the main timeline UI.
     */
    Page<TimelineEvent> findByTypeAndTypeIdOrderByCreatedAtDesc(String type, String typeId, Pageable pageable);

    /**
     * Fetch ALL timeline events/notes for a student across all stages (enquiry,
     * application, enrollment).
     * Pinned notes appear first, then ordered by creation date descending.
     */
    Page<TimelineEvent> findByStudentUserIdOrderByIsPinnedDescCreatedAtDesc(String studentUserId, Pageable pageable);

    /**
     * Fetch timeline events for a specific entity, with pinned first.
     * Used for notes-enhanced timeline view.
     */
    Page<TimelineEvent> findByTypeAndTypeIdOrderByIsPinnedDescCreatedAtDesc(String type, String typeId,
            Pageable pageable);

    /**
     * Count timeline events for an entity (used by lead scoring engagement factor).
     */
    long countByTypeAndTypeId(String type, String typeId);

    /**
     * Count timeline events across multiple entity IDs of the same type.
     * Used by UserLeadProfileService to aggregate events across all audience
     * responses.
     */
    long countByTypeAndTypeIdIn(String type, java.util.List<String> typeIds);

    long countByStudentUserId(String studentUserId);

    // ── Journey (category = JOURNEY) ──────────────────────────────────────────

    /**
     * Paginated lead-journey events for a specific entity, newest first.
     * Used by GET /timeline/v1/journey to render the lifecycle timeline.
     */
    Page<TimelineEvent> findByTypeAndTypeIdAndCategoryOrderByCreatedAtDesc(
            String type, String typeId, TimelineCategory category, Pageable pageable);

    /**
     * Paginated lead-journey events for a student across all stages.
     * Powers the cross-stage journey view on the student side panel.
     */
    Page<TimelineEvent> findByStudentUserIdAndCategoryOrderByCreatedAtDesc(
            String studentUserId, TimelineCategory category, Pageable pageable);

    @Query(value = """
            SELECT id, type, type_id, action_type, actor_type, actor_id,
                   actor_name, title, description, metadata_json,
                   is_pinned, student_user_id, created_at
            FROM (
                SELECT te.*,
                       ROW_NUMBER() OVER (
                           PARTITION BY te.student_user_id
                           ORDER BY te.created_at DESC
                       ) AS rn
                FROM timeline_event te
                WHERE te.student_user_id IN (:studentUserIds)
            ) ranked
            WHERE rn <= :perStudentLimit
            ORDER BY student_user_id, created_at DESC
            """, nativeQuery = true)
    List<TimelineEvent> findRecentPerStudent(
            @Param("studentUserIds") List<String> studentUserIds,
            @Param("perStudentLimit") int perStudentLimit);

    /**
     * Per-student note count for a batch of users. Returns rows of
     * [student_user_id, count] so the FE can render a count chip without
     * issuing N separate count queries.
     */
    @Query(value = """
            SELECT student_user_id, COUNT(*)
            FROM timeline_event
            WHERE student_user_id IN (:studentUserIds)
            GROUP BY student_user_id
            """, nativeQuery = true)
    List<Object[]> countByStudentUserIds(@Param("studentUserIds") List<String> studentUserIds);
}
