package vacademy.io.admin_core_service.features.engagement.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementMember;

import java.time.Instant;
import java.util.List;

public interface EngagementMemberRepository extends JpaRepository<EngagementMember, String> {

    /**
     * Due scan (no lock). Safety comes from the per-row lease CAS below — the pattern this
     * codebase has proven in prod three times (WorkflowResumeJob.claimForResume,
     * LeadFollowupRepository.claimDueTransition, AudienceRepository.tryClaimAiCampaign).
     * Ordered by tier so HOT members (fresh replies) are decided first within the engine.
     */
    @Query(value = """
            SELECT * FROM engagement_member
            WHERE engine_id = :engineId AND status = 'ACTIVE' AND next_action_at <= :now
            ORDER BY tier ASC, next_action_at ASC
            LIMIT :batch
            """, nativeQuery = true)
    List<EngagementMember> findDueMembers(@Param("engineId") String engineId,
                                          @Param("now") Instant now,
                                          @Param("batch") int batch);

    /**
     * THE claim: a LEASE, not a status flip. Pushes next_action_at +15min; returns 1 only for
     * the winning replica (the loser sees next_action_at > now and gets 0 rows). A pod that
     * dies mid-decision simply has its rows come due again when the lease expires — a CLAIMED
     * status would be a terminal state on pod death (the row leaves the due scan forever,
     * invisibly, which is the worst failure class for an autonomous system).
     */
    @Modifying
    @Transactional
    @Query(value = """
            UPDATE engagement_member
               SET next_action_at = :leaseUntil, updated_at = :now
             WHERE id = :id AND status = 'ACTIVE' AND next_action_at <= :now
            """, nativeQuery = true)
    int claimLease(@Param("id") String id, @Param("now") Instant now, @Param("leaseUntil") Instant leaseUntil);

    /**
     * Idempotent enrolment with a SWEEP STAMP. Inserts if absent; if present, stamps the row
     * with the current reconcile run id AND resurrects it if it was EXITED (a learner who left
     * and re-enrolled next term must not stay invisible) — but NOT if OPTED_OUT (consent sticks).
     * ON CONFLICT target matches ux_em_subject token-for-token. Rows-affected is 1 on BOTH the
     * insert and the update path (Postgres counts an ON-CONFLICT update as affected), so the
     * caller measures "newly enrolled" by a before/after ACTIVE count, not this return value.
     */
    @Modifying
    @Transactional
    @Query(value = """
            INSERT INTO engagement_member
                (id, engine_id, institute_id, user_id, audience_response_id, status, tier,
                 next_action_at, memory_json)
            VALUES (:id, :engineId, :instituteId, :userId, :audienceResponseId, 'ACTIVE', 2,
                    :nextActionAt, jsonb_build_object('reconcileRun', CAST(:runId AS text)))
            ON CONFLICT (engine_id, COALESCE(user_id, ''), COALESCE(audience_response_id, ''))
            DO UPDATE SET
                status = CASE WHEN engagement_member.status = 'EXITED' THEN 'ACTIVE'
                              ELSE engagement_member.status END,
                next_action_at = CASE WHEN engagement_member.status = 'EXITED' THEN EXCLUDED.next_action_at
                                      ELSE engagement_member.next_action_at END,
                memory_json = jsonb_set(COALESCE(engagement_member.memory_json, '{}'::jsonb),
                                        '{reconcileRun}', to_jsonb(CAST(:runId AS text))),
                updated_at = now()
            """, nativeQuery = true)
    int enrollOrStamp(@Param("id") String id,
                      @Param("engineId") String engineId,
                      @Param("instituteId") String instituteId,
                      @Param("userId") String userId,
                      @Param("audienceResponseId") String audienceResponseId,
                      @Param("nextActionAt") Instant nextActionAt,
                      @Param("runId") String runId);

    /**
     * Reconciliation: EXIT active members NOT stamped by this reconcile run — no giant IN-list
     * (which would blow pgJDBC's 32,767-param cap on a large audience). Runs unconditionally,
     * so an audience that resolved to zero subjects correctly exits everyone.
     */
    @Modifying
    @Transactional
    @Query(value = """
            UPDATE engagement_member
               SET status = 'EXITED', updated_at = now()
             WHERE engine_id = :engineId AND status = 'ACTIVE'
               AND COALESCE(memory_json->>'reconcileRun', '') <> :runId
            """, nativeQuery = true)
    int exitNotStampedBy(@Param("engineId") String engineId, @Param("runId") String runId);

    long countByEngineIdAndStatus(String engineId, String status);

    List<EngagementMember> findByEngineIdAndStatus(String engineId, String status);
}
