package vacademy.io.admin_core_service.features.telephony.queue.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.telephony.queue.entity.AiCallQueueItem;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface AiCallQueueItemRepository extends JpaRepository<AiCallQueueItem, String> {

    /**
     * The drain candidate set: the oldest eligible items of EVERY lane that has work,
     * not the oldest N items overall.
     *
     * <p>This distinction is the whole reason the query has a LATERAL in it. A flat
     * {@code ORDER BY created_at LIMIT 200} over a queue holding one institute's
     * 500-lead upload returns 500 rows belonging to that one institute — the drainer
     * would never SEE the lane that arrived later, so skipping a capped lane could not
     * help it. Taking each lane's head first bounds the candidate set while
     * guaranteeing every waiting institute is represented in it; the caller then walks
     * that set in strict FIFO order.
     *
     * @param perLane rows per lane — fleet capacity is enough, since no lane can take
     *                more slots than the whole fleet has.
     */
    @Query(value = """
            SELECT q.* FROM (
                SELECT DISTINCT institute_id FROM ai_call_queue WHERE status = 'QUEUED'
            ) l
            JOIN LATERAL (
                SELECT * FROM ai_call_queue x
                 WHERE x.institute_id = l.institute_id
                   AND x.status = 'QUEUED'
                   AND (x.not_before IS NULL OR x.not_before <= :now)
                 ORDER BY x.priority DESC, x.created_at
                 LIMIT :perLane
            ) q ON TRUE
            ORDER BY q.priority DESC, q.created_at
            LIMIT :maxRows
            """, nativeQuery = true)
    List<AiCallQueueItem> findDrainCandidates(@Param("now") Instant now,
                                              @Param("perLane") int perLane,
                                              @Param("maxRows") int maxRows);

    /**
     * Claim an item for dispatch. This CAS — not the scheduler lock — is the
     * send-once guarantee: ShedLock's {@code lockAtMostFor} can lapse and let two
     * drainers overlap, and only a conditional UPDATE survives that.
     *
     * @return 1 when this caller won the claim, 0 when someone else already had it.
     */
    @Modifying
    @Transactional
    @Query(value = """
            UPDATE ai_call_queue
               SET status = 'DISPATCHING', attempts = attempts + 1, updated_at = NOW()
             WHERE id = :id AND status = 'QUEUED'
            """, nativeQuery = true)
    int claimForDispatch(@Param("id") String id);

    /**
     * TTL sweep. A call queued yesterday for a lead who has since been worked by a
     * human is not a call anyone wants placed; expiring it is visible (status +
     * reason) rather than a silent drop.
     */
    @Modifying
    @Transactional
    @Query(value = """
            UPDATE ai_call_queue
               SET status = 'EXPIRED',
                   status_reason = 'Waited past its time limit without a free line.',
                   updated_at = NOW()
             WHERE status = 'QUEUED' AND expires_at IS NOT NULL AND expires_at <= :now
            """, nativeQuery = true)
    int expireOverdue(@Param("now") Instant now);

    /**
     * Release items stuck in DISPATCHING — only reachable if the drainer died between
     * the claim and the dial (pod evicted mid-tick). Bounded by a generous grace so a
     * live dispatch is never yanked out from under itself.
     */
    @Modifying
    @Transactional
    @Query(value = """
            UPDATE ai_call_queue
               SET status = 'QUEUED', updated_at = NOW()
             WHERE status = 'DISPATCHING' AND updated_at <= :before
            """, nativeQuery = true)
    int releaseStuckClaims(@Param("before") Instant before);

    /**
     * Push back EVERY waiting item of one institute.
     *
     * <p>Used for the conditions that are lane-wide rather than per-call: the institute
     * is out of credits, has hit its daily cap, or is outside its calling hours. Without
     * this the drainer would rediscover the same condition on the next item every tick
     * — an institute with 400 queued leads and an empty wallet would make 400 credit
     * checks working through its own backlog before settling down.
     *
     * <p>The {@code not_before} guard means an item already deferred FURTHER out keeps
     * its later time: this only ever delays, never pulls a call forward.
     */
    @Modifying
    @Transactional
    @Query(value = """
            UPDATE ai_call_queue
               SET not_before = :notBefore, status_reason = :reason, updated_at = NOW()
             WHERE institute_id = :instituteId AND status = 'QUEUED'
               AND (not_before IS NULL OR not_before < :notBefore)
            """, nativeQuery = true)
    int deferLane(@Param("instituteId") String instituteId,
                  @Param("notBefore") Instant notBefore,
                  @Param("reason") String reason);

    /** The pending item for this lead, if any — so a repeat enqueue reports its place. */
    @Query("""
            SELECT q FROM AiCallQueueItem q
            WHERE q.dedupeKey = :dedupeKey AND q.status IN ('QUEUED', 'DISPATCHING')
            """)
    Optional<AiCallQueueItem> findPendingByDedupeKey(@Param("dedupeKey") String dedupeKey);

    /**
     * Every dedupe key this institute currently has undialled. A bulk enqueue reads
     * this ONCE and filters in memory rather than probing per lead: a 500-lead campaign
     * would otherwise fire 500 existence checks on the request thread, and the pending
     * set for one institute is small by construction (it is bounded by what has not
     * dialled yet, not by history).
     */
    @Query("""
            SELECT q.dedupeKey FROM AiCallQueueItem q
            WHERE q.instituteId = :instituteId AND q.status IN ('QUEUED', 'DISPATCHING')
            """)
    List<String> findPendingDedupeKeys(@Param("instituteId") String instituteId);

    /**
     * How many items sit ahead of this one in ITS OWN lane. The lane, not the whole
     * queue, is what governs its wait: the per-lane cap means an institute drains at
     * its own rate regardless of how much other institutes have queued.
     */
    @Query("""
            SELECT COUNT(q) FROM AiCallQueueItem q
            WHERE q.instituteId = :instituteId AND q.status = 'QUEUED'
              AND (q.priority > :priority
                   OR (q.priority = :priority AND q.createdAt < :createdAt))
            """)
    long countAheadInLane(@Param("instituteId") String instituteId,
                          @Param("priority") int priority,
                          @Param("createdAt") Instant createdAt);

    @Query("SELECT COUNT(q) FROM AiCallQueueItem q WHERE q.instituteId = :instituteId AND q.status = 'QUEUED'")
    long countQueuedForInstitute(@Param("instituteId") String instituteId);

    @Query("SELECT COUNT(q) FROM AiCallQueueItem q WHERE q.status = 'QUEUED'")
    long countQueuedTotal();

    /** Institutes with at least one waiting item — the denominator of the dynamic lane cap. */
    @Query("SELECT DISTINCT q.instituteId FROM AiCallQueueItem q WHERE q.status = 'QUEUED'")
    List<String> findInstitutesWithQueuedWork();

    @Query("SELECT q.instituteId, COUNT(q) FROM AiCallQueueItem q WHERE q.status = 'QUEUED' GROUP BY q.instituteId")
    List<Object[]> countQueuedByInstitute();

    /** Fleet-wide status breakdown for the ops snapshot. */
    @Query("SELECT q.status, COUNT(q) FROM AiCallQueueItem q GROUP BY q.status")
    List<Object[]> countAllGroupedByStatus();

    @Query("""
            SELECT q.status, COUNT(q) FROM AiCallQueueItem q
            WHERE q.instituteId = :instituteId GROUP BY q.status
            """)
    List<Object[]> countByInstituteGroupedByStatus(@Param("instituteId") String instituteId);

    /**
     * This institute's waiting items in dispatch order, ids only.
     *
     * <p>The queue list view needs each row's place in line. Asking the database
     * "how many are ahead of this one" per row turns a 200-row page into 200 counts;
     * pulling the ordered id list once and reading the index off it is one query. The
     * cap keeps that list bounded — past it, positions are simply not shown, which is
     * the honest answer for an item several thousand deep.
     */
    @Query("""
            SELECT q.id FROM AiCallQueueItem q
            WHERE q.instituteId = :instituteId AND q.status = 'QUEUED'
            ORDER BY q.priority DESC, q.createdAt
            """)
    List<String> findQueuedIdsInDispatchOrder(@Param("instituteId") String instituteId,
                                              Pageable pageable);

    /**
     * Cross-institute listing for the internal dashboard, in DISPATCH order — the order
     * calls will actually go out, which is the only ordering that answers "who is next?".
     *
     * <p>Every filter is optional. The CASTs are load-bearing rather than decorative:
     * Postgres cannot infer a bare parameter's type on the NULL side of an OR and rejects
     * the statement without them.
     */
    @Query(value = """
            SELECT * FROM ai_call_queue q
             WHERE (CAST(:instituteId AS VARCHAR) IS NULL OR q.institute_id = CAST(:instituteId AS VARCHAR))
               AND (CAST(:status AS VARCHAR) IS NULL OR q.status = CAST(:status AS VARCHAR))
               AND (CAST(:provider AS VARCHAR) IS NULL OR q.provider = CAST(:provider AS VARCHAR))
               AND (CAST(:source AS VARCHAR) IS NULL OR q.source = CAST(:source AS VARCHAR))
             ORDER BY q.priority DESC, q.created_at ASC
            """,
            countQuery = """
            SELECT COUNT(*) FROM ai_call_queue q
             WHERE (CAST(:instituteId AS VARCHAR) IS NULL OR q.institute_id = CAST(:instituteId AS VARCHAR))
               AND (CAST(:status AS VARCHAR) IS NULL OR q.status = CAST(:status AS VARCHAR))
               AND (CAST(:provider AS VARCHAR) IS NULL OR q.provider = CAST(:provider AS VARCHAR))
               AND (CAST(:source AS VARCHAR) IS NULL OR q.source = CAST(:source AS VARCHAR))
            """,
            nativeQuery = true)
    Page<AiCallQueueItem> searchInLineOrder(@Param("instituteId") String instituteId,
                                            @Param("status") String status,
                                            @Param("provider") String provider,
                                            @Param("source") String source,
                                            Pageable pageable);

    /**
     * The same listing newest-first, for looking at what already happened. Line order is
     * meaningless once a row has left the queue, and an ops screen reading history wants
     * the most recent call at the top.
     */
    @Query(value = """
            SELECT * FROM ai_call_queue q
             WHERE (CAST(:instituteId AS VARCHAR) IS NULL OR q.institute_id = CAST(:instituteId AS VARCHAR))
               AND (CAST(:status AS VARCHAR) IS NULL OR q.status = CAST(:status AS VARCHAR))
               AND (CAST(:provider AS VARCHAR) IS NULL OR q.provider = CAST(:provider AS VARCHAR))
               AND (CAST(:source AS VARCHAR) IS NULL OR q.source = CAST(:source AS VARCHAR))
             ORDER BY q.created_at DESC
            """,
            countQuery = """
            SELECT COUNT(*) FROM ai_call_queue q
             WHERE (CAST(:instituteId AS VARCHAR) IS NULL OR q.institute_id = CAST(:instituteId AS VARCHAR))
               AND (CAST(:status AS VARCHAR) IS NULL OR q.status = CAST(:status AS VARCHAR))
               AND (CAST(:provider AS VARCHAR) IS NULL OR q.provider = CAST(:provider AS VARCHAR))
               AND (CAST(:source AS VARCHAR) IS NULL OR q.source = CAST(:source AS VARCHAR))
            """,
            nativeQuery = true)
    Page<AiCallQueueItem> searchByRecency(@Param("instituteId") String instituteId,
                                          @Param("status") String status,
                                          @Param("provider") String provider,
                                          @Param("source") String source,
                                          Pageable pageable);

    /** Longest-waiting item per lane — the "how far behind are they?" column. */
    @Query("""
            SELECT q.instituteId, MIN(q.createdAt) FROM AiCallQueueItem q
            WHERE q.status = 'QUEUED' GROUP BY q.instituteId
            """)
    List<Object[]> findOldestQueuedPerInstitute();

    /**
     * Calls that are on a line RIGHT NOW.
     *
     * <p>Not expressible as a queue-status filter: the queue row stops at DIALED the
     * moment the provider accepts, and never moves again. Whether the call is still up
     * lives in {@code telephony_call_log}, so "live" is the join — a dialled queue row
     * whose call has not reached a terminal status.
     */
    @Query(value = """
            SELECT q.* FROM ai_call_queue q
             JOIN telephony_call_log t ON t.id = q.call_log_id
             WHERE q.status = 'DIALED'
               AND t.status IN ('INITIATED', 'QUEUED', 'COUNSELLOR_RINGING',
                                'COUNSELLOR_ANSWERED', 'IN_PROGRESS')
               AND (CAST(:instituteId AS VARCHAR) IS NULL
                    OR q.institute_id = CAST(:instituteId AS VARCHAR))
             ORDER BY q.dispatched_at DESC
            """,
            countQuery = """
            SELECT COUNT(*) FROM ai_call_queue q
             JOIN telephony_call_log t ON t.id = q.call_log_id
             WHERE q.status = 'DIALED'
               AND t.status IN ('INITIATED', 'QUEUED', 'COUNSELLOR_RINGING',
                                'COUNSELLOR_ANSWERED', 'IN_PROGRESS')
               AND (CAST(:instituteId AS VARCHAR) IS NULL
                    OR q.institute_id = CAST(:instituteId AS VARCHAR))
            """,
            nativeQuery = true)
    Page<AiCallQueueItem> findLive(@Param("instituteId") String instituteId, Pageable pageable);

    Page<AiCallQueueItem> findByInstituteIdOrderByCreatedAtDesc(String instituteId, Pageable pageable);

    Page<AiCallQueueItem> findByInstituteIdAndStatusOrderByCreatedAtDesc(
            String instituteId, String status, Pageable pageable);

    /**
     * Cancel everything still waiting for one institute (optionally narrowed to one
     * source run). The CASTs are not decoration: Postgres cannot infer a bare
     * parameter's type on the NULL side of an OR and rejects the statement without
     * them.
     */
    @Modifying
    @Transactional
    @Query(value = """
            UPDATE ai_call_queue
               SET status = 'CANCELLED', status_reason = :reason, updated_at = NOW()
             WHERE institute_id = :instituteId AND status = 'QUEUED'
               AND (CAST(:sourceRef AS VARCHAR) IS NULL OR source_ref = CAST(:sourceRef AS VARCHAR))
            """, nativeQuery = true)
    int cancelQueued(@Param("instituteId") String instituteId,
                     @Param("sourceRef") String sourceRef,
                     @Param("reason") String reason);

    @Modifying
    @Transactional
    @Query(value = """
            UPDATE ai_call_queue
               SET status = 'CANCELLED', status_reason = :reason, updated_at = NOW()
             WHERE id = :id AND institute_id = :instituteId AND status = 'QUEUED'
            """, nativeQuery = true)
    int cancelOne(@Param("id") String id,
                  @Param("instituteId") String instituteId,
                  @Param("reason") String reason);

    /** Queue-side view of a bulk run, for the campaign progress dialog. */
    @Query("""
            SELECT q.status, COUNT(q) FROM AiCallQueueItem q
            WHERE q.instituteId = :instituteId AND q.source = :source AND q.sourceRef = :sourceRef
            GROUP BY q.status
            """)
    List<Object[]> countBySourceRefGroupedByStatus(@Param("instituteId") String instituteId,
                                                   @Param("source") String source,
                                                   @Param("sourceRef") String sourceRef);
}
