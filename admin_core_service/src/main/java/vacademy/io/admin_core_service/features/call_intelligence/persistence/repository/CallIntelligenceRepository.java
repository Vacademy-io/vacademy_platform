package vacademy.io.admin_core_service.features.call_intelligence.persistence.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.call_intelligence.persistence.entity.CallIntelligence;

import java.util.List;
import java.util.Optional;

@Repository
public interface CallIntelligenceRepository extends JpaRepository<CallIntelligence, String> {

    /** 1:1 lookup — used by the enqueue path (idempotent) and the read APIs. */
    Optional<CallIntelligence> findByCallLogId(String callLogId);

    boolean existsByCallLogId(String callLogId);

    List<CallIntelligence> findByResponseIdOrderByCallStartedAtDesc(String responseId);

    /**
     * A counsellor's COMPLETED analyses in a window — the source rows for the
     * coaching insights (per-quality averages, recurring tips, common objections),
     * aggregated in-memory from each row's analysis_json.
     */
    List<CallIntelligence> findByCounsellorUserIdAndStatusAndCallStartedAtBetweenOrderByCallStartedAtDesc(
            String counsellorUserId, String status,
            java.sql.Timestamp from, java.sql.Timestamp to);

    /** Same, but across a set of counsellors — powers the whole-team coaching view. */
    List<CallIntelligence> findByCounsellorUserIdInAndStatusAndCallStartedAtBetweenOrderByCallStartedAtDesc(
            List<String> counsellorUserIds, String status,
            java.sql.Timestamp from, java.sql.Timestamp to);

    /**
     * The poller's claim query: oldest PENDING work first. Matches the partial
     * index idx_ci_queue. Pageable caps the batch size per tick.
     */
    @Query("SELECT c FROM CallIntelligence c WHERE c.status = 'PENDING' ORDER BY c.createdAt ASC")
    List<CallIntelligence> findPendingBatch(Pageable pageable);

    /**
     * Re-arm transient failures for the poller (bounded retries). Callers pass the
     * max attempts so an institute can't loop forever on a permanently bad asset.
     */
    @Query("SELECT c FROM CallIntelligence c WHERE c.status = 'FAILED' AND c.attempts < :maxAttempts ORDER BY c.updatedAt ASC")
    List<CallIntelligence> findRetryableBatch(@Param("maxAttempts") int maxAttempts, Pageable pageable);

    // -------------------------------------------------------------------------
    // Dashboard aggregates (COMPLETED rows only, scoped to a set of counsellors
    // and a date window). All return raw rows mapped by the query service so the
    // empty-id-list case can be short-circuited before hitting these.
    // -------------------------------------------------------------------------

    /** {count, avg(callerSelfGoalRating), avg(callOutputRating)} for the cohort. */
    @Query("""
            SELECT COUNT(c), AVG(c.callerSelfGoalRating), AVG(c.callOutputRating)
            FROM CallIntelligence c
            WHERE c.counsellorUserId IN :ids AND c.status = 'COMPLETED'
              AND c.callStartedAt BETWEEN :from AND :to
            """)
    List<Object[]> aggregate(@Param("ids") List<String> ids,
                             @Param("from") java.sql.Timestamp from,
                             @Param("to") java.sql.Timestamp to);

    /** {generic_status, count} distribution. */
    @Query("""
            SELECT c.genericStatus, COUNT(c)
            FROM CallIntelligence c
            WHERE c.counsellorUserId IN :ids AND c.status = 'COMPLETED'
              AND c.callStartedAt BETWEEN :from AND :to
            GROUP BY c.genericStatus
            """)
    List<Object[]> statusDistribution(@Param("ids") List<String> ids,
                                      @Param("from") java.sql.Timestamp from,
                                      @Param("to") java.sql.Timestamp to);

    /** {lead_sentiment, count} distribution. */
    @Query("""
            SELECT c.leadSentiment, COUNT(c)
            FROM CallIntelligence c
            WHERE c.counsellorUserId IN :ids AND c.status = 'COMPLETED'
              AND c.callStartedAt BETWEEN :from AND :to
            GROUP BY c.leadSentiment
            """)
    List<Object[]> sentimentDistribution(@Param("ids") List<String> ids,
                                         @Param("from") java.sql.Timestamp from,
                                         @Param("to") java.sql.Timestamp to);

    /** Per-counsellor breakdown: {counsellor_user_id, count, avgSelf, avgOutput}. */
    @Query("""
            SELECT c.counsellorUserId, COUNT(c), AVG(c.callerSelfGoalRating), AVG(c.callOutputRating)
            FROM CallIntelligence c
            WHERE c.counsellorUserId IN :ids AND c.status = 'COMPLETED'
              AND c.callStartedAt BETWEEN :from AND :to
            GROUP BY c.counsellorUserId
            """)
    List<Object[]> perCounsellor(@Param("ids") List<String> ids,
                                 @Param("from") java.sql.Timestamp from,
                                 @Param("to") java.sql.Timestamp to);
}
