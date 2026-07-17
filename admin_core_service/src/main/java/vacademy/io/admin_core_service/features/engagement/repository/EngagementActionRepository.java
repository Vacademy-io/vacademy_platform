package vacademy.io.admin_core_service.features.engagement.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementAction;

import java.time.Instant;
import java.util.List;

public interface EngagementActionRepository extends JpaRepository<EngagementAction, String> {

    /**
     * The institute-wide task inbox: unassigned by design in Phase 1, ranked by priority.
     * The caller passes the status filter; SIMULATED (DRY_RUN) rows are surfaced only when
     * the caller explicitly asks for that status, never mixed into the default OPEN/ACKED view.
     */
    @Query(value = """
            SELECT * FROM engagement_action
            WHERE institute_id = :instituteId
              AND kind IN ('TASK', 'REPLY')
              AND status IN (:statuses)
            ORDER BY priority DESC NULLS LAST, scheduled_for ASC NULLS LAST, created_at DESC
            """,
            countQuery = """
            SELECT count(*) FROM engagement_action
            WHERE institute_id = :instituteId
              AND kind IN ('TASK', 'REPLY')
              AND status IN (:statuses)
            """, nativeQuery = true)
    Page<EngagementAction> findInbox(@Param("instituteId") String instituteId,
                                     @Param("statuses") List<String> statuses,
                                     Pageable pageable);

    /**
     * Institute-wide CROSS-ENGINE per-member action count in a window — the only cadence
     * safety mechanism (the prompt decides cadence, so this cap must be hard and checked
     * BEFORE the LLM call). Counts by subject (user or lead), not by member row, so three
     * engines sharing a learner share the cap.
     */
    // SIMULATED excluded: a DRY_RUN never consumes the real cadence cap. NULL subject params
    // are CAST so Postgres can infer the type (an un-cast null bind → "could not determine
    // data type of parameter" at runtime — a compile-clean, run-fatal trap on this hot path).
    @Query(value = """
            SELECT count(*) FROM engagement_action a
            JOIN engagement_member m ON m.id = a.member_id
            WHERE a.institute_id = :instituteId
              AND a.kind IN ('TASK', 'SEND', 'REPLY')
              AND a.status NOT IN ('DISMISSED', 'EXPIRED', 'FAILED', 'SIMULATED')
              AND a.created_at >= :since
              AND ((CAST(:userId AS varchar) IS NOT NULL AND m.user_id = CAST(:userId AS varchar))
                   OR (CAST(:audienceResponseId AS varchar) IS NOT NULL
                       AND m.audience_response_id = CAST(:audienceResponseId AS varchar)))
            """, nativeQuery = true)
    long countRecentActionsForSubject(@Param("instituteId") String instituteId,
                                      @Param("userId") String userId,
                                      @Param("audienceResponseId") String audienceResponseId,
                                      @Param("since") Instant since);

    /** Human handles a task: OPEN → ACKED/DONE/DISMISSED. CAS so two admins can't double-handle. */
    @Modifying
    @Transactional
    @Query(value = """
            UPDATE engagement_action
               SET status = :toStatus, outcome = :outcome, completed_at = :now, updated_at = :now
             WHERE id = :id AND institute_id = :instituteId AND status IN ('OPEN', 'ACKED')
            """, nativeQuery = true)
    int transitionTask(@Param("id") String id,
                       @Param("instituteId") String instituteId,
                       @Param("toStatus") String toStatus,
                       @Param("outcome") String outcome,
                       @Param("now") Instant now);

    /** Reaper: expire stale open tasks so the inbox never becomes wallpaper silently. */
    @Modifying
    @Transactional
    @Query(value = """
            UPDATE engagement_action
               SET status = 'EXPIRED', updated_at = now()
             WHERE kind IN ('TASK', 'REPLY') AND status IN ('OPEN', 'ACKED')
               AND expires_at IS NOT NULL AND expires_at < now()
            """, nativeQuery = true)
    int expireStaleTasks();

    /** Dismissal-rate alarm input (design §7): if this exceeds ~80%, the labels are worthless. */
    @Query(value = """
            SELECT count(*) FILTER (WHERE outcome = 'DISMISSED') AS dismissed, count(*) AS total
            FROM engagement_action
            WHERE engine_id = :engineId AND kind = 'TASK' AND completed_at >= :since
            """, nativeQuery = true)
    List<Object[]> dismissalStats(@Param("engineId") String engineId, @Param("since") Instant since);

    List<EngagementAction> findTop20ByMemberIdOrderByCreatedAtDesc(String memberId);
}
