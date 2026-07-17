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
    // A FAILED autonomous SEND (kind=SEND) IS surfaced so a human can reconcile/reopen it — but a
    // pending (OPEN, scheduled) or successful (SENT) auto-send never clutters the human inbox; those
    // are the dispatch job's business, not a task needing action.
    @Query(value = """
            SELECT * FROM engagement_action
            WHERE institute_id = :instituteId
              AND status IN (:statuses)
              AND (kind IN ('TASK', 'REPLY') OR (kind = 'SEND' AND status = 'FAILED'))
            ORDER BY priority DESC NULLS LAST, scheduled_for ASC NULLS LAST, created_at DESC
            """,
            countQuery = """
            SELECT count(*) FROM engagement_action
            WHERE institute_id = :instituteId
              AND status IN (:statuses)
              AND (kind IN ('TASK', 'REPLY') OR (kind = 'SEND' AND status = 'FAILED'))
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

    /**
     * At-most-once dispatch claim: OPEN/ACKED → DISPATCHING. Returns 1 for the single winner
     * (two admins double-clicking "send", or a retry, get 0). This is THE guard that makes
     * send-on-behalf safe — the customer must not receive the draft twice.
     */
    @Modifying
    @Transactional
    @Query(value = """
            UPDATE engagement_action
               SET status = 'DISPATCHING', updated_at = :now
             WHERE id = :id AND institute_id = :instituteId AND status IN ('OPEN', 'ACKED')
            """, nativeQuery = true)
    int claimForDispatch(@Param("id") String id,
                         @Param("instituteId") String instituteId,
                         @Param("now") Instant now);

    /**
     * Reaper: expire stale open tasks so the inbox never becomes wallpaper silently. Includes
     * pending autonomous SENDs (kind=SEND, OPEN) that went past their expiry without dispatching
     * (e.g. the institute ran out of credits for days) — a stale message must NOT auto-send later.
     */
    @Modifying
    @Transactional
    @Query(value = """
            UPDATE engagement_action
               SET status = 'EXPIRED', updated_at = now()
             WHERE kind IN ('TASK', 'REPLY', 'SEND') AND status IN ('OPEN', 'ACKED')
               AND expires_at IS NOT NULL AND expires_at < now()
            """, nativeQuery = true)
    int expireStaleTasks();

    /**
     * The graduation ramp (Phase 2): how many proactive drafts a human has actually SENT with
     * approval (ACCEPTED or EDITED) for this engine. Once this reaches first_n, the engine may
     * auto-send. DONE ('handled elsewhere') does NOT count — it's no proof our drafts send well.
     */
    @Query(value = """
            SELECT count(*) FROM engagement_action
             WHERE engine_id = :engineId AND kind = 'TASK' AND status = 'SENT'
               AND outcome IN ('ACCEPTED', 'EDITED')
            """, nativeQuery = true)
    long countApprovedSends(@Param("engineId") String engineId);

    /**
     * Autonomous sends that are DUE: a proactive SEND the decision service scheduled, now ready to
     * dispatch. Ordered by scheduled time so the oldest-due goes first; the dispatch job bounds the
     * batch. expires_at guards against firing a message that sat too long (the reaper also expires it).
     */
    @Query(value = """
            SELECT * FROM engagement_action
             WHERE kind = 'SEND' AND status = 'OPEN'
               AND (scheduled_for IS NULL OR scheduled_for <= :now)
               AND (expires_at IS NULL OR expires_at > :now)
             ORDER BY scheduled_for ASC NULLS FIRST
             LIMIT :limit
            """, nativeQuery = true)
    List<EngagementAction> findDueAutoSends(@Param("now") Instant now, @Param("limit") int limit);

    /** Convert an autonomous SEND back to a human copilot TASK (kill switch / out of credits). */
    @Modifying
    @Transactional
    @Query(value = """
            UPDATE engagement_action
               SET kind = 'TASK', error_message = :reason, updated_at = :now
             WHERE id = :id AND kind = 'SEND' AND status = 'OPEN'
            """, nativeQuery = true)
    int demoteSendToTask(@Param("id") String id, @Param("reason") String reason, @Param("now") Instant now);

    /** Stamp a SENT autonomous send as billed (the per-message credit charge succeeded). */
    @Modifying
    @Transactional
    @Query(value = "UPDATE engagement_action SET credits_billed_at = :now WHERE id = :id",
            nativeQuery = true)
    int markBilled(@Param("id") String id, @Param("now") Instant now);

    /**
     * Reconciliation work list: SENT autonomous sends whose credit charge never stamped (the deduct
     * HTTP call was lost after the message went out). Windowed on dispatched_at (SEND time), NOT
     * created_at (decision time) — a send scheduled days ahead, or fired after a long pause, dispatches
     * far after it was created, so a created_at window would permanently miss it. The idempotency key
     * (action id) makes a re-charge exactly-once.
     */
    @Query(value = """
            SELECT * FROM engagement_action
             WHERE kind = 'SEND' AND status = 'SENT' AND credits_billed_at IS NULL
               AND dispatched_at >= :since
             ORDER BY dispatched_at ASC
             LIMIT :limit
            """, nativeQuery = true)
    List<EngagementAction> findUnbilledSent(@Param("since") Instant since, @Param("limit") int limit);

    /**
     * Circuit-breaker input: how many of an institute's recently-SENT autonomous messages went out
     * UNBILLED. A rising count means the charge path (ai_service /deduct) is failing while the balance
     * read still passes — the one divergence the affordability gate can't see. Above a threshold the
     * dispatch job stops auto-sending for that institute (fail closed on CHARGE failure, not just on a
     * balance-read failure), bounding revenue leak + spam.
     */
    @Query(value = """
            SELECT count(*) FROM engagement_action
             WHERE institute_id = :instituteId AND kind = 'SEND' AND status = 'SENT'
               AND credits_billed_at IS NULL AND dispatched_at >= :since
            """, nativeQuery = true)
    long countUnbilledSentForInstitute(@Param("instituteId") String instituteId, @Param("since") Instant since);

    /**
     * Reaper for rows stuck mid-dispatch: a pod that died between the claim and the settle would
     * otherwise leave the action in DISPATCHING forever (invisible to the inbox, unreapable).
     * After a grace window, settle to FAILED (visible + reopenable) — NEVER back to OPEN, because
     * the send may have landed (marking OPEN could double-send). The correlation_id lets a human
     * confirm delivery before reopening.
     */
    @Modifying
    @Transactional
    @Query(value = """
            UPDATE engagement_action
               SET status = 'FAILED', error_message = 'dispatch did not complete (reaped)', updated_at = now()
             WHERE status = 'DISPATCHING' AND updated_at < :staleBefore
            """, nativeQuery = true)
    int reapStuckDispatching(@Param("staleBefore") Instant staleBefore);

    /** Human reopens a FAILED task after confirming it did NOT land (correlation lookup). */
    @Modifying
    @Transactional
    @Query(value = """
            UPDATE engagement_action
               SET status = 'OPEN', error_message = NULL, outcome = NULL, updated_at = :now
             WHERE id = :id AND institute_id = :instituteId AND status = 'FAILED'
            """, nativeQuery = true)
    int reopenFailed(@Param("id") String id, @Param("instituteId") String instituteId, @Param("now") Instant now);

    /** Dismissal-rate alarm input (design §7): if this exceeds ~80%, the labels are worthless. */
    @Query(value = """
            SELECT count(*) FILTER (WHERE outcome = 'DISMISSED') AS dismissed, count(*) AS total
            FROM engagement_action
            WHERE engine_id = :engineId AND kind = 'TASK' AND completed_at >= :since
            """, nativeQuery = true)
    List<Object[]> dismissalStats(@Param("engineId") String engineId, @Param("since") Instant since);

    List<EngagementAction> findTop20ByMemberIdOrderByCreatedAtDesc(String memberId);
}
