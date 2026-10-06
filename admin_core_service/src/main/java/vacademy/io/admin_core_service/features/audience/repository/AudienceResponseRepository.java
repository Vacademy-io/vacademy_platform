package vacademy.io.admin_core_service.features.audience.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.audience.dto.LeadLastActionProjection;
import vacademy.io.admin_core_service.features.audience.dto.LeadReportProjections;
import vacademy.io.admin_core_service.features.audience.dto.LeadSlaCandidate;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;

import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;

/**
 * Repository for AudienceResponse (Lead) entities
 */
@Repository
public interface AudienceResponseRepository extends JpaRepository<AudienceResponse, String> {

    /**
     * Bulk lead id -> display name and number, for screens that list leads they do not
     * otherwise load. The AI call queue resolves a whole page at once; a per-row lookup
     * would turn one page into fifty queries.
     */
    @Query(value = "SELECT ar.id, ar.parent_name, ar.parent_mobile FROM audience_response ar "
            + "WHERE ar.id IN (:ids)", nativeQuery = true)
    List<Object[]> findIdNameAndMobileByIds(@Param("ids") java.util.Collection<String> ids);


        /**
         * Find all leads for a specific campaign, INCLUDING soft-deleted ones.
         *
         * <p>Use {@link #findActiveByAudienceId(String)} for anything that contacts a lead or
         * shows it to a user. This raw variant is for whole-campaign maintenance (e.g. score
         * recalculation), where a deleted lead's derived data should still be kept correct in
         * case it is restored.</p>
         */
        List<AudienceResponse> findByAudienceId(String audienceId);

        /**
         * Live leads for a campaign — soft-deleted rows excluded.
         *
         * <p>This is the safe default for send/dial recipient selection. Deliberately has no
         * "include deleted" parameter: there is no legitimate reason to blast a lead an admin
         * has deleted, so the option should not exist.</p>
         */
        @Query("""
                            SELECT ar FROM AudienceResponse ar
                            WHERE ar.audienceId = :audienceId
                            AND ar.audienceStatus = 'ACTIVE'
                        """)
        List<AudienceResponse> findActiveByAudienceId(@Param("audienceId") String audienceId);

        /**
         * Lead lookup by phone number for telephony attribution: the most recent
         * lead in this institute whose {@code parent_mobile} matches on the last 10
         * digits. Returns {@code [audience_response.id, user_id]}. Institute-scoped
         * via the audience join so a call never attaches to another institute's
         * lead. Used by the Airtel CCR/CDR importer to attribute inbound +
         * softphone-originated outbound calls that have no CRM click2dial row.
         */
        @Query(value = """
                SELECT ar.id, ar.user_id
                FROM audience_response ar
                JOIN audience a ON a.id = ar.audience_id
                WHERE a.institute_id = :instituteId
                  AND ar.parent_mobile IS NOT NULL
                  AND RIGHT(regexp_replace(ar.parent_mobile, '[^0-9]', '', 'g'), 10) = :last10
                ORDER BY ar.created_at DESC
                LIMIT 1
                """, nativeQuery = true)
        List<Object[]> findLeadIdAndUserByInstituteAndPhoneLast10(
                        @Param("instituteId") String instituteId,
                        @Param("last10") String last10);

        /**
         * The lead a WhatsApp chatbot flow should treat as "this person is already a lead":
         * any lead in the institute (any list) whose {@code parent_mobile} matches on the last
         * 10 digits. Opted-out leads count — someone who opted out and writes again is still a
         * known person, not a new lead. Rows flagged as duplicates are skipped. A live row wins
         * over a soft-deleted one, then the newest wins. Returns
         * {@code [audience_response.id, user_id, audience_status]}.
         */
        @Query(value = """
                SELECT ar.id, ar.user_id, ar.audience_status
                FROM audience_response ar
                JOIN audience a ON a.id = ar.audience_id
                WHERE a.institute_id = :instituteId
                  AND ar.parent_mobile IS NOT NULL
                  AND RIGHT(regexp_replace(ar.parent_mobile, '[^0-9]', '', 'g'), 10) = :last10
                  AND (ar.is_duplicate IS NULL OR ar.is_duplicate = false)
                ORDER BY CASE WHEN ar.audience_status = 'INACTIVE' THEN 1 ELSE 0 END, ar.created_at DESC
                LIMIT 1
                """, nativeQuery = true)
        List<Object[]> findChatbotLeadMatchByInstituteAndPhoneLast10(
                        @Param("instituteId") String instituteId,
                        @Param("last10") String last10);

        /**
         * Transaction-scoped Postgres advisory lock on an arbitrary key. Held until the
         * surrounding transaction commits or rolls back, so two concurrent callers with the
         * same key run one after the other. Used to stop two WhatsApp messages arriving at
         * once from both creating a lead for the same phone.
         */
        @Query(value = "SELECT 1 FROM pg_advisory_xact_lock(hashtext(:lockKey))", nativeQuery = true)
        Integer acquireTransactionLock(@Param("lockKey") String lockKey);

        /**
         * The most recent {@code audience_response.id} for a given user in this
         * institute — i.e. confirms the user IS a lead here and returns the lead's
         * response id. Used by the telephony resolver after it finds the user by
         * mobile in auth_service: the call attaches to {@code user_id}, scoped to
         * the call's institute so it never crosses tenants.
         */
        @Query(value = """
                SELECT ar.id
                FROM audience_response ar
                JOIN audience a ON a.id = ar.audience_id
                WHERE a.institute_id = :instituteId
                  AND ar.user_id = :userId
                ORDER BY ar.created_at DESC
                LIMIT 1
                """, nativeQuery = true)
        List<String> findResponseIdByInstituteAndUser(
                        @Param("instituteId") String instituteId,
                        @Param("userId") String userId);

        /**
         * Every distinct "student side" user id across this institute's leads
         * (any campaign, any status) — a lead is "student-shaped" the moment a
         * real user is attached, whether or not they've ever been enrolled.
         * Powers the guardian-linking backfill's lead variant, which needs to
         * reach leads that never got as far as an SSIGM enrollment row.
         *
         * <p>{@code audience_response} has two different user columns depending
         * on how the lead was captured:
         * <ul>
         *   <li>Admission/enquiry-form leads (see AdmissionService,
         *   AudienceService's enquiry-creation path) store the applying
         *   guardian's own account in {@code user_id} and the child being
         *   applied for in {@code student_user_id} — here {@code user_id} is
         *   ALREADY a guardian and must be excluded, {@code student_user_id}
         *   is the real candidate.</li>
         *   <li>Every other (the common) lead-capture path only ever sets
         *   {@code user_id} — the lead's own account IS the prospective
         *   student, and {@code student_user_id} stays null. Missing this case
         *   previously made the leads backfill silently see zero eligible
         *   leads for the common path.</li>
         * </ul>
         */
        @Query(value = """
                SELECT DISTINCT ar.student_user_id AS candidate_user_id
                FROM audience_response ar
                JOIN audience a ON a.id = ar.audience_id
                WHERE a.institute_id = :instituteId
                  AND ar.student_user_id IS NOT NULL
                UNION
                SELECT DISTINCT ar.user_id AS candidate_user_id
                FROM audience_response ar
                JOIN audience a ON a.id = ar.audience_id
                WHERE a.institute_id = :instituteId
                  AND ar.user_id IS NOT NULL
                  AND ar.student_user_id IS NULL
                """, nativeQuery = true)
        List<String> findDistinctStudentUserIdsByInstitute(@Param("instituteId") String instituteId);

        /**
         * Find all leads for a campaign with pagination
         */
        Page<AudienceResponse> findByAudienceId(String audienceId, Pageable pageable);

        /**
         * Find audience response by enquiry ID
         */
        Optional<AudienceResponse> findByEnquiryId(String enquiryId);

        /**
         * Find audience responses by multiple enquiry IDs (batch fetch)
         */
        List<AudienceResponse> findByEnquiryIdIn(List<String> enquiryIds);

        /**
         * Find audience responses by multiple applicant IDs (batch fetch)
         */
        List<AudienceResponse> findByApplicantIdIn(java.util.Collection<String> applicantIds);

        /**
         * Find lead by ID and audience ID (for security/isolation)
         */
        Optional<AudienceResponse> findByIdAndAudienceId(String id, String audienceId);

        /**
         * Find all converted leads (with user_id)
         */
        @Query("SELECT ar FROM AudienceResponse ar WHERE ar.audienceId = :audienceId AND ar.userId IS NOT NULL AND (ar.overallStatus IS NULL OR ar.overallStatus != 'OPTED_OUT') AND ar.audienceStatus = 'ACTIVE'")
        List<AudienceResponse> findConvertedLeads(@Param("audienceId") String audienceId);

        /**
         * Find all unconverted leads (without user_id)
         */
        @Query("SELECT ar FROM AudienceResponse ar WHERE ar.audienceId = :audienceId AND ar.userId IS NULL AND (ar.overallStatus IS NULL OR ar.overallStatus != 'OPTED_OUT') AND ar.audienceStatus = 'ACTIVE'")
        List<AudienceResponse> findUnconvertedLeads(@Param("audienceId") String audienceId);

        /**
         * Find leads by source type
         */
        List<AudienceResponse> findByAudienceIdAndSourceType(String audienceId, String sourceType);

        /**
         * Find leads with filters and pagination.
         * Supports: source, date range, score range, tier, counselor, unassigned, dedup, search, dynamic sort.
         */
        @Query(value = """
                            SELECT ar.*
                            FROM audience_response ar
                            JOIN audience a ON a.id = ar.audience_id
                            LEFT JOIN lead_score ls ON ls.audience_response_id = ar.id
                            LEFT JOIN LATERAL (
                                SELECT lu.user_id
                                FROM linked_users lu
                                WHERE lu.source = 'ENQUIRY' AND lu.source_id = ar.enquiry_id
                                ORDER BY lu.created_at DESC
                                LIMIT 1
                            ) lu ON true
                            LEFT JOIN user_lead_profile ulp
                                ON ulp.user_id = ar.user_id AND ulp.institute_id = a.institute_id
                            -- Last counsellor touch per lead, computed ONCE per row so the
                            -- "worked in the last 24h / 7d" windows and the Activity-column sort
                            -- below can both read it without re-running the correlated MAXes.
                            -- Each arm is its own index-backed subquery (idx_tcl_response,
                            -- idx_tcl_subject, idx_tcl_user, idx_timeline_event_type_type_id,
                            -- idx_timeline_student_recent) -- one subquery OR-ing the columns
                            -- together would seq-scan both logs per candidate lead.
                            -- GREATEST ignores NULL arms, so a lead with no call / no activity
                            -- keeps a NULL here and drops out of any window that is set.
                            LEFT JOIN LATERAL (
                                -- Each half is wrapped in a CASE that short-circuits to NULL when
                                -- neither the matching window NOR the matching sort is requested.
                                -- Without it these six correlated MAXes would run for every row of
                                -- EVERY leads-list call, including the overwhelming majority that
                                -- never touch these filters, and this is the hottest query in the CRM.
                                -- CASE does not evaluate the branch it does not take, so the
                                -- default path costs nothing.
                                SELECT CASE WHEN CAST(:calledFrom AS timestamp) IS NULL
                                             AND CAST(:calledTo AS timestamp) IS NULL
                                             AND COALESCE(:sortBy, '') <> 'LAST_CALLED'
                                            THEN NULL
                                            ELSE GREATEST(
                                                (SELECT MAX(tcl.created_at) FROM telephony_call_log tcl
                                                  WHERE tcl.response_id = ar.id),
                                                (SELECT MAX(tcl.created_at) FROM telephony_call_log tcl
                                                  WHERE tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD'),
                                                (SELECT MAX(tcl.created_at) FROM telephony_call_log tcl
                                                  WHERE tcl.user_id = ar.user_id
                                                    AND tcl.institute_id = a.institute_id))
                                       END AS last_called_at,
                                       CASE WHEN CAST(:activityFrom AS timestamp) IS NULL
                                             AND CAST(:activityTo AS timestamp) IS NULL
                                             AND COALESCE(:sortBy, '') <> 'LAST_ACTIVITY'
                                            THEN NULL
                                            ELSE GREATEST(
                                                (SELECT MAX(te.created_at) FROM timeline_event te
                                                  WHERE te.type = 'AUDIENCE_RESPONSE' AND te.type_id = ar.id),
                                                (SELECT MAX(te.created_at) FROM timeline_event te
                                                  WHERE te.student_user_id = ar.user_id),
                                                (SELECT MAX(te.created_at) FROM timeline_event te
                                                  WHERE te.student_user_id = ar.student_user_id))
                                       END AS last_activity_at
                            ) act ON true
                            WHERE ar.audience_id = :audienceId
                              AND (COALESCE(:leadStatusId, '') = '' OR COALESCE((SELECT lst.status_key FROM lead_status lst WHERE lst.id = ar.lead_status_id), ulp.conversion_status) = ANY(STRING_TO_ARRAY(:leadStatusId, ',')) OR ('__NO_STATUS__' = ANY(STRING_TO_ARRAY(:leadStatusId, ',')) AND ar.lead_status_id IS NULL AND ulp.conversion_status IS NULL))
                              AND (COALESCE(:leadStatusExcludeId, '') = '' OR COALESCE((SELECT lst.status_key FROM lead_status lst WHERE lst.id = ar.lead_status_id), ulp.conversion_status) IS NULL OR NOT (COALESCE((SELECT lst.status_key FROM lead_status lst WHERE lst.id = ar.lead_status_id), ulp.conversion_status) = ANY(STRING_TO_ARRAY(:leadStatusExcludeId, ','))))
                              AND (COALESCE(:followUpPending, FALSE) = FALSE OR EXISTS (SELECT 1 FROM lead_followup lf WHERE lf.audience_response_id = ar.id AND lf.is_closed = FALSE AND lf.schedule_time IS NOT NULL AND (CAST(:followUpFrom AS timestamp) IS NULL OR lf.schedule_time >= CAST(:followUpFrom AS timestamp)) AND (CAST(:followUpTo AS timestamp) IS NULL OR lf.schedule_time < CAST(:followUpTo AS timestamp))))
                              AND (COALESCE(:sourceType, '') = '' OR ar.source_type = :sourceType)
                              AND (COALESCE(:sourceId, '') = '' OR ar.source_id = :sourceId)
                              AND (CAST(:submittedFrom AS timestamp) IS NULL OR ar.submitted_at >= CAST(:submittedFrom AS timestamp))
                              AND (CAST(:submittedTo AS timestamp) IS NULL OR ar.submitted_at <= CAST(:submittedTo AS timestamp))
                              -- "How many did I work / call in the last 24h / 7d" -- deliberately
                              -- INDEPENDENT of submitted_at, which answers when the lead arrived,
                              -- not when the counsellor last touched it. Two separate windows:
                              -- calls only (telephony_call_log) vs any activity (timeline_event).
                              -- act.* is NULL when the lead was never called / never touched, and
                              -- NULL fails every comparison, so those leads are excluded as soon
                              -- as either bound is set -- no COALESCE-to-epoch needed.
                              AND (CAST(:calledFrom AS timestamp) IS NULL OR act.last_called_at >= CAST(:calledFrom AS timestamp))
                              AND (CAST(:calledTo AS timestamp) IS NULL OR act.last_called_at <= CAST(:calledTo AS timestamp))
                              AND (CAST(:activityFrom AS timestamp) IS NULL OR act.last_activity_at >= CAST(:activityFrom AS timestamp))
                              AND (CAST(:activityTo AS timestamp) IS NULL OR act.last_activity_at <= CAST(:activityTo AS timestamp))
                              AND (:excludeDuplicates IS NULL OR :excludeDuplicates = FALSE OR COALESCE(ar.is_duplicate, FALSE) = FALSE)
                              AND (COALESCE(:searchQuery, '') = '' OR
                                   LOWER(ar.parent_name) LIKE LOWER(CONCAT('%', :searchQuery, '%')) OR
                                   LOWER(ar.parent_email) LIKE LOWER(CONCAT('%', :searchQuery, '%')) OR
                                   ar.parent_mobile LIKE CONCAT('%', :searchQuery, '%') OR
                                   (COALESCE(:searchUserIdsCsv, '') != ''
                                    AND ar.user_id = ANY(STRING_TO_ARRAY(:searchUserIdsCsv, ','))))
                              AND (:minLeadScore IS NULL OR COALESCE(ls.raw_score, 0) >= :minLeadScore)
                              AND (:maxLeadScore IS NULL OR COALESCE(ls.raw_score, 0) <= :maxLeadScore)
                              AND (COALESCE(:leadTier, '') = '' OR
                                   (ulp.user_id IS NOT NULL AND COALESCE(NULLIF(ulp.lead_tier, ''),
                                       (SELECT lt.tier_key FROM lead_tier lt
                                         WHERE lt.institute_id = ulp.institute_id AND lt.is_active = TRUE
                                           AND lt.min_score IS NOT NULL AND ulp.best_score >= lt.min_score
                                         ORDER BY lt.min_score DESC, lt.display_order ASC LIMIT 1),
                                       CASE WHEN ulp.best_score >= 80 THEN 'HOT'
                                            WHEN ulp.best_score >= 50 THEN 'WARM'
                                            ELSE 'COLD' END) = ANY(STRING_TO_ARRAY(:leadTier, ','))))
                              AND (COALESCE(:assignedCounselorId, '') = ''
                                   OR lu.user_id = ANY(STRING_TO_ARRAY(:assignedCounselorId, ','))
                                   OR ulp.assigned_counselor_id = ANY(STRING_TO_ARRAY(:assignedCounselorId, ',')))
                              -- RBAC scope (CounsellorScopeService.descendantUserIdsForCaller):
                              -- caller + everyone reporting up to them through parent_user_id
                              -- chains in the leads-team subtree.
                              -- Unassigned leads (no counsellor on either linked_users or
                              -- user_lead_profile) stay visible to everyone — the "pool" of
                              -- leads anyone in scope can pick up.
                              AND (COALESCE(:assignedCounselorIdsCsv, '') = ''
                                   OR lu.user_id = ANY(STRING_TO_ARRAY(:assignedCounselorIdsCsv, ','))
                                   OR ulp.assigned_counselor_id = ANY(STRING_TO_ARRAY(:assignedCounselorIdsCsv, ','))
                                   OR ((:includeUnassigned IS NULL OR :includeUnassigned = TRUE) AND lu.user_id IS NULL AND ulp.assigned_counselor_id IS NULL))
                              AND (:isUnassigned IS NULL OR :isUnassigned = FALSE
                                   OR (lu.user_id IS NULL AND ulp.assigned_counselor_id IS NULL))
                              AND (
                                (COALESCE(:overallStatusStr, '') = '' AND (ar.overall_status IS NULL OR ar.overall_status != 'OPTED_OUT'))
                                OR (COALESCE(:overallStatusStr, '') != '' AND ar.overall_status = ANY(STRING_TO_ARRAY(:overallStatusStr, ',')))
                              )
                              AND (
                                COALESCE(:conversionStatusFilter, 'EXCLUDE_CONVERTED') = 'ALL'
                                OR (
                                  COALESCE(:conversionStatusFilter, 'EXCLUDE_CONVERTED') = 'EXCLUDE_CONVERTED'
                                  AND (ulp.conversion_status IS NULL OR ulp.conversion_status != 'CONVERTED')
                                )
                                OR (
                                  :conversionStatusFilter = 'ONLY_CONVERTED'
                                  AND ulp.conversion_status = 'CONVERTED'
                                )
                              )
                              -- Soft-delete filter. Mirrors conversionStatusFilter above:
                              -- EXCLUDE_DELETED (default) / ONLY_DELETED / ALL, so the UI can
                              -- offer a "show deleted leads" view without a second query.
                              -- Kept as its OWN unconditional AND rather than folded into the
                              -- overall_status OR block above: that block disables its own
                              -- OPTED_OUT guard whenever :overallStatusStr is set, and a
                              -- soft-deleted lead must stay hidden regardless of what else the
                              -- caller filters by.
                              AND (
                                COALESCE(:audienceStatusFilter, 'EXCLUDE_DELETED') = 'ALL'
                                OR (
                                  COALESCE(:audienceStatusFilter, 'EXCLUDE_DELETED') = 'EXCLUDE_DELETED'
                                  AND ar.audience_status = 'ACTIVE'
                                )
                                OR (
                                  :audienceStatusFilter = 'ONLY_DELETED'
                                  AND ar.audience_status = 'INACTIVE'
                                )
                              )
                              -- SLA-state filter. Aligned with the row-level badges + the new
                              -- column semantics:
                              --   * Reach-out buckets use submitted_at + tatMinutes AND a NOT EXISTS
                              --     check on timeline_event (any response event — see
                              --     findCounselorActionsByResponseIds) so leads already responded
                              --     to are excluded, matching the badge.
                              --   * Follow-up buckets read the lead_followup table (open rows
                              --     only), matching the Follow up at column which is now purely
                              --     counsellor-scheduled callbacks.
                              AND (COALESCE(:slaFilter, '') = ''
                                   OR ('TAT_OVERDUE' = ANY(STRING_TO_ARRAY(:slaFilter, ','))
                                       AND :tatMinutes IS NOT NULL
                                       AND ar.submitted_at IS NOT NULL
                                       AND ar.submitted_at + make_interval(mins => CAST(:tatMinutes AS integer)) < NOW()
                                       AND NOT EXISTS (
                                           SELECT 1 FROM timeline_event te
                                           WHERE (te.category = 'ACTIVITY' OR te.action_type = 'REACHOUT' OR (te.action_type IN ('STATUS_CHANGED','LEAD_CONVERTED','LEAD_LOST','COUNSELOR_ASSIGNED','COUNSELOR_UNASSIGNED','MANUAL_SCORE_UPDATE') AND te.actor_id IS NOT NULL))
                                             AND ( (te.type = 'AUDIENCE_RESPONSE' AND te.type_id = ar.id)
                                                   OR (ar.user_id IS NOT NULL AND te.student_user_id = ar.user_id)
                                                   OR (ar.student_user_id IS NOT NULL AND te.student_user_id = ar.student_user_id) )))
                                   OR ('TAT_BEFORE' = ANY(STRING_TO_ARRAY(:slaFilter, ','))
                                       AND :tatMinutes IS NOT NULL
                                       AND ar.submitted_at IS NOT NULL
                                       AND ar.submitted_at + make_interval(mins => CAST(:tatMinutes AS integer)) > NOW()
                                       AND ar.submitted_at + make_interval(mins => CAST(:tatMinutes AS integer)) <= NOW() + INTERVAL '30 minutes'
                                       AND NOT EXISTS (
                                           SELECT 1 FROM timeline_event te
                                           WHERE (te.category = 'ACTIVITY' OR te.action_type = 'REACHOUT' OR (te.action_type IN ('STATUS_CHANGED','LEAD_CONVERTED','LEAD_LOST','COUNSELOR_ASSIGNED','COUNSELOR_UNASSIGNED','MANUAL_SCORE_UPDATE') AND te.actor_id IS NOT NULL))
                                             AND ( (te.type = 'AUDIENCE_RESPONSE' AND te.type_id = ar.id)
                                                   OR (ar.user_id IS NOT NULL AND te.student_user_id = ar.user_id)
                                                   OR (ar.student_user_id IS NOT NULL AND te.student_user_id = ar.student_user_id) )))
                                   OR ('FOLLOW_UP_DUE' = ANY(STRING_TO_ARRAY(:slaFilter, ','))
                                       AND EXISTS (
                                           SELECT 1 FROM lead_followup lf
                                           WHERE lf.audience_response_id = ar.id
                                             AND lf.is_closed = false
                                             AND lf.schedule_time IS NOT NULL
                                             AND lf.schedule_time > NOW()
                                             AND lf.schedule_time <= NOW() + INTERVAL '30 minutes'))
                                   OR ('FOLLOW_UP_OVERDUE' = ANY(STRING_TO_ARRAY(:slaFilter, ','))
                                       AND EXISTS (
                                           SELECT 1 FROM lead_followup lf
                                           WHERE lf.audience_response_id = ar.id
                                             AND lf.is_closed = false
                                             AND lf.schedule_time IS NOT NULL
                                             AND lf.schedule_time < NOW()))
                                   OR ('ANY_OVERDUE' = ANY(STRING_TO_ARRAY(:slaFilter, ','))
                                       AND (
                                           (:tatMinutes IS NOT NULL
                                            AND ar.submitted_at IS NOT NULL
                                            AND ar.submitted_at + make_interval(mins => CAST(:tatMinutes AS integer)) < NOW()
                                            AND NOT EXISTS (
                                                SELECT 1 FROM timeline_event te
                                                WHERE (te.category = 'ACTIVITY' OR te.action_type = 'REACHOUT' OR (te.action_type IN ('STATUS_CHANGED','LEAD_CONVERTED','LEAD_LOST','COUNSELOR_ASSIGNED','COUNSELOR_UNASSIGNED','MANUAL_SCORE_UPDATE') AND te.actor_id IS NOT NULL))
                                                  AND ( (te.type = 'AUDIENCE_RESPONSE' AND te.type_id = ar.id)
                                                        OR (ar.user_id IS NOT NULL AND te.student_user_id = ar.user_id)
                                                        OR (ar.student_user_id IS NOT NULL AND te.student_user_id = ar.student_user_id) )))
                                           OR EXISTS (
                                               SELECT 1 FROM lead_followup lf
                                               WHERE lf.audience_response_id = ar.id
                                                 AND lf.is_closed = false
                                                 AND lf.schedule_time IS NOT NULL
                                                 AND lf.schedule_time < NOW()))))
                              AND (COALESCE(:customFieldMatchedIdsCsv, '') = ''
                                   OR ar.id = ANY(STRING_TO_ARRAY(:customFieldMatchedIdsCsv, ',')))
                              AND (COALESCE(:customFieldExcludedIdsCsv, '') = ''
                                   OR NOT (ar.id = ANY(STRING_TO_ARRAY(:customFieldExcludedIdsCsv, ','))))
                              -- NOTE never put a semicolon anywhere in this query's comments --
                              -- Hibernate's limit handler treats the first semicolon as end of
                              -- statement and injects "fetch first ? rows only" there, which
                              -- desyncs JDBC parameter binding (column index out of range).
                              -- Call-history matching. A call log links to a lead THREE ways:
                              -- response_id (manual dialer + CDR import), subject_id+LEAD (AI
                              -- campaigns), or just user_id (about a quarter of Airtel CDR rows
                              -- have no response link, while the lead side-panel lists calls by
                              -- user_id + institute, so the filter must match the same or called
                              -- leads land in NOT_CALLED).
                              -- Keep each column in its OWN EXISTS block: one EXISTS with an OR
                              -- across columns defeats every index and seq-scans the whole call
                              -- log per candidate lead (statement timeout).
                              AND (COALESCE(:callHistoryFilter, '') = ''
                                   OR (:callHistoryFilter = 'NOT_CALLED'
                                       AND NOT EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.response_id = ar.id)
                                       AND NOT EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD')
                                       AND NOT EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.user_id = ar.user_id
                                                AND tcl.institute_id = a.institute_id))
                                   OR (:callHistoryFilter = 'CALLED'
                                       AND (EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.response_id = ar.id)
                                         OR EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD')
                                         OR EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.user_id = ar.user_id
                                                AND tcl.institute_id = a.institute_id)))
                                   OR (:callHistoryFilter = 'CALLED_ONCE' AND (
                                         SELECT COUNT(*) FROM telephony_call_log tcl
                                          WHERE tcl.response_id = ar.id
                                             OR (tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD')
                                             OR (tcl.user_id = ar.user_id
                                                 AND tcl.institute_id = a.institute_id)) = 1)
                                   OR (:callHistoryFilter = 'CALLED_TWICE_PLUS' AND (
                                         SELECT COUNT(*) FROM telephony_call_log tcl
                                          WHERE tcl.response_id = ar.id
                                             OR (tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD')
                                             OR (tcl.user_id = ar.user_id
                                                 AND tcl.institute_id = a.institute_id)) >= 2)
                                   -- Arbitrary-N variants of the two options above: "called
                                   -- exactly N times" and "called N or more times". N comes from
                                   -- :callCountValue, floored at 1 so a missing/zero value
                                   -- degrades to the CALLED_ONCE / CALLED semantics rather than
                                   -- matching nothing.
                                   OR (:callHistoryFilter = 'CALLED_N_TIMES' AND (
                                         SELECT COUNT(*) FROM telephony_call_log tcl
                                          WHERE tcl.response_id = ar.id
                                             OR (tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD')
                                             OR (tcl.user_id = ar.user_id
                                                 AND tcl.institute_id = a.institute_id))
                                       = GREATEST(COALESCE(CAST(:callCountValue AS integer), 1), 1))
                                   OR (:callHistoryFilter = 'CALLED_N_PLUS_TIMES' AND (
                                         SELECT COUNT(*) FROM telephony_call_log tcl
                                          WHERE tcl.response_id = ar.id
                                             OR (tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD')
                                             OR (tcl.user_id = ar.user_id
                                                 AND tcl.institute_id = a.institute_id))
                                       >= GREATEST(COALESCE(CAST(:callCountValue AS integer), 1), 1))
                                   OR (:callHistoryFilter = 'AI_CALLED'
                                       AND (EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.response_id = ar.id
                                                AND tcl.provider_type IN ('VACADEMY_AI', 'AAVTAAR'))
                                         OR EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD'
                                                AND tcl.provider_type IN ('VACADEMY_AI', 'AAVTAAR'))
                                         OR EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.user_id = ar.user_id
                                                AND tcl.institute_id = a.institute_id
                                                AND tcl.provider_type IN ('VACADEMY_AI', 'AAVTAAR'))))
                                   OR (:callHistoryFilter = 'MANUAL_CALLED'
                                       AND (EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.response_id = ar.id
                                                AND tcl.provider_type NOT IN ('VACADEMY_AI', 'AAVTAAR', 'MOCK'))
                                         OR EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD'
                                                AND tcl.provider_type NOT IN ('VACADEMY_AI', 'AAVTAAR', 'MOCK'))
                                         OR EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.user_id = ar.user_id
                                                AND tcl.institute_id = a.institute_id
                                                AND tcl.provider_type NOT IN ('VACADEMY_AI', 'AAVTAAR', 'MOCK')))))
                            ORDER BY
                              CASE WHEN :sortBy = 'SUBMITTED_AT' AND :sortDirection = 'ASC'
                                   THEN ar.submitted_at END ASC,
                              CASE WHEN :sortBy = 'SUBMITTED_AT' AND (:sortDirection IS NULL OR :sortDirection = 'DESC')
                                   THEN ar.submitted_at END DESC,
                              CASE WHEN :sortBy = 'LEAD_SCORE' AND (:sortDirection IS NULL OR :sortDirection = 'DESC')
                                   THEN COALESCE(ls.raw_score, 0) END DESC,
                              CASE WHEN :sortBy = 'LEAD_SCORE' AND :sortDirection = 'ASC'
                                   THEN COALESCE(ls.raw_score, 0) END ASC,
                              CASE WHEN :sortBy = 'LEAD_TIER' AND :sortDirection = 'ASC'
                                   THEN COALESCE(
                                        (SELECT 1000 - lt.display_order FROM lead_tier lt
                                          WHERE lt.institute_id = ulp.institute_id AND lt.is_active = TRUE
                                            AND lt.tier_key = COALESCE(NULLIF(ulp.lead_tier, ''),
                                                (SELECT lt2.tier_key FROM lead_tier lt2
                                                  WHERE lt2.institute_id = ulp.institute_id AND lt2.is_active = TRUE
                                                    AND lt2.min_score IS NOT NULL AND ulp.best_score >= lt2.min_score
                                                  ORDER BY lt2.min_score DESC, lt2.display_order ASC LIMIT 1))
                                          LIMIT 1),
                                        CASE COALESCE(NULLIF(ulp.lead_tier, ''),
                                            CASE WHEN ulp.best_score >= 80 THEN 'HOT'
                                                 WHEN ulp.best_score >= 50 THEN 'WARM'
                                                 WHEN ulp.best_score IS NOT NULL THEN 'COLD'
                                                 ELSE NULL END)
                                        WHEN 'HOT' THEN 3 WHEN 'WARM' THEN 2 WHEN 'COLD' THEN 1 ELSE 0 END) END ASC,
                              CASE WHEN :sortBy = 'LEAD_TIER' AND (:sortDirection IS NULL OR :sortDirection = 'DESC')
                                   THEN COALESCE(
                                        (SELECT 1000 - lt.display_order FROM lead_tier lt
                                          WHERE lt.institute_id = ulp.institute_id AND lt.is_active = TRUE
                                            AND lt.tier_key = COALESCE(NULLIF(ulp.lead_tier, ''),
                                                (SELECT lt2.tier_key FROM lead_tier lt2
                                                  WHERE lt2.institute_id = ulp.institute_id AND lt2.is_active = TRUE
                                                    AND lt2.min_score IS NOT NULL AND ulp.best_score >= lt2.min_score
                                                  ORDER BY lt2.min_score DESC, lt2.display_order ASC LIMIT 1))
                                          LIMIT 1),
                                        CASE COALESCE(NULLIF(ulp.lead_tier, ''),
                                            CASE WHEN ulp.best_score >= 80 THEN 'HOT'
                                                 WHEN ulp.best_score >= 50 THEN 'WARM'
                                                 WHEN ulp.best_score IS NOT NULL THEN 'COLD'
                                                 ELSE NULL END)
                                        WHEN 'HOT' THEN 3 WHEN 'WARM' THEN 2 WHEN 'COLD' THEN 1 ELSE 0 END) END DESC,
                              CASE WHEN :sortBy = 'STATUS' AND :sortDirection = 'ASC'
                                   THEN COALESCE((SELECT lst.status_key FROM lead_status lst WHERE lst.id = ar.lead_status_id), ulp.conversion_status) END ASC,
                              CASE WHEN :sortBy = 'STATUS' AND (:sortDirection IS NULL OR :sortDirection = 'DESC')
                                   THEN COALESCE((SELECT lst.status_key FROM lead_status lst WHERE lst.id = ar.lead_status_id), ulp.conversion_status) END DESC,
                              CASE WHEN :sortBy = 'PARENT_NAME' AND (:sortDirection IS NULL OR :sortDirection = 'ASC')
                                   THEN ar.parent_name END ASC,
                              CASE WHEN :sortBy = 'PARENT_NAME' AND :sortDirection = 'DESC'
                                   THEN ar.parent_name END DESC,
                              CASE WHEN :sortBy = 'CUSTOM_FIELD' AND :sortCustomFieldId IS NOT NULL AND :sortDirection = 'ASC'
                                   THEN CASE WHEN (SELECT scf.value FROM custom_field_values scf WHERE scf.source_type = 'AUDIENCE_RESPONSE' AND scf.source_id = ar.id AND scf.custom_field_id = :sortCustomFieldId ORDER BY scf.updated_at DESC NULLS LAST LIMIT 1) ~ '^-?[0-9]+([.][0-9]+)?$' THEN CAST((SELECT scf.value FROM custom_field_values scf WHERE scf.source_type = 'AUDIENCE_RESPONSE' AND scf.source_id = ar.id AND scf.custom_field_id = :sortCustomFieldId ORDER BY scf.updated_at DESC NULLS LAST LIMIT 1) AS numeric) END END ASC NULLS LAST,
                              CASE WHEN :sortBy = 'CUSTOM_FIELD' AND :sortCustomFieldId IS NOT NULL AND (:sortDirection IS NULL OR :sortDirection = 'DESC')
                                   THEN CASE WHEN (SELECT scf.value FROM custom_field_values scf WHERE scf.source_type = 'AUDIENCE_RESPONSE' AND scf.source_id = ar.id AND scf.custom_field_id = :sortCustomFieldId ORDER BY scf.updated_at DESC NULLS LAST LIMIT 1) ~ '^-?[0-9]+([.][0-9]+)?$' THEN CAST((SELECT scf.value FROM custom_field_values scf WHERE scf.source_type = 'AUDIENCE_RESPONSE' AND scf.source_id = ar.id AND scf.custom_field_id = :sortCustomFieldId ORDER BY scf.updated_at DESC NULLS LAST LIMIT 1) AS numeric) END END DESC NULLS LAST,
                              CASE WHEN :sortBy = 'CUSTOM_FIELD' AND :sortCustomFieldId IS NOT NULL AND :sortDirection = 'ASC'
                                   THEN (SELECT scf.value FROM custom_field_values scf WHERE scf.source_type = 'AUDIENCE_RESPONSE' AND scf.source_id = ar.id AND scf.custom_field_id = :sortCustomFieldId ORDER BY scf.updated_at DESC NULLS LAST LIMIT 1) END ASC NULLS LAST,
                              CASE WHEN :sortBy = 'CUSTOM_FIELD' AND :sortCustomFieldId IS NOT NULL AND (:sortDirection IS NULL OR :sortDirection = 'DESC')
                                   THEN (SELECT scf.value FROM custom_field_values scf WHERE scf.source_type = 'AUDIENCE_RESPONSE' AND scf.source_id = ar.id AND scf.custom_field_id = :sortCustomFieldId ORDER BY scf.updated_at DESC NULLS LAST LIMIT 1) END DESC NULLS LAST,
                              CASE WHEN :sortBy = 'LAST_ACTIVITY' AND :sortDirection = 'ASC'
                                   THEN act.last_activity_at END ASC NULLS LAST,
                              CASE WHEN :sortBy = 'LAST_ACTIVITY' AND (:sortDirection IS NULL OR :sortDirection = 'DESC')
                                   THEN act.last_activity_at END DESC NULLS LAST,
                              CASE WHEN :sortBy = 'LAST_CALLED' AND :sortDirection = 'ASC'
                                   THEN act.last_called_at END ASC NULLS LAST,
                              CASE WHEN :sortBy = 'LAST_CALLED' AND (:sortDirection IS NULL OR :sortDirection = 'DESC')
                                   THEN act.last_called_at END DESC NULLS LAST,
                              ar.submitted_at DESC
                        """, countQuery = """
                            SELECT COUNT(*)
                            FROM audience_response ar
                            JOIN audience a ON a.id = ar.audience_id
                            LEFT JOIN lead_score ls ON ls.audience_response_id = ar.id
                            LEFT JOIN LATERAL (
                                SELECT lu.user_id
                                FROM linked_users lu
                                WHERE lu.source = 'ENQUIRY' AND lu.source_id = ar.enquiry_id
                                ORDER BY lu.created_at DESC
                                LIMIT 1
                            ) lu ON true
                            LEFT JOIN user_lead_profile ulp
                                ON ulp.user_id = ar.user_id AND ulp.institute_id = a.institute_id
                            -- Last counsellor touch per lead, computed ONCE per row so the
                            -- "worked in the last 24h / 7d" windows and the Activity-column sort
                            -- below can both read it without re-running the correlated MAXes.
                            -- Each arm is its own index-backed subquery (idx_tcl_response,
                            -- idx_tcl_subject, idx_tcl_user, idx_timeline_event_type_type_id,
                            -- idx_timeline_student_recent) -- one subquery OR-ing the columns
                            -- together would seq-scan both logs per candidate lead.
                            -- GREATEST ignores NULL arms, so a lead with no call / no activity
                            -- keeps a NULL here and drops out of any window that is set.
                            LEFT JOIN LATERAL (
                                -- Each half is wrapped in a CASE that short-circuits to NULL when
                                -- neither the matching window NOR the matching sort is requested.
                                -- Without it these six correlated MAXes would run for every row of
                                -- EVERY leads-list call, including the overwhelming majority that
                                -- never touch these filters, and this is the hottest query in the CRM.
                                -- CASE does not evaluate the branch it does not take, so the
                                -- default path costs nothing.
                                SELECT CASE WHEN CAST(:calledFrom AS timestamp) IS NULL
                                             AND CAST(:calledTo AS timestamp) IS NULL
                                             AND COALESCE(:sortBy, '') <> 'LAST_CALLED'
                                            THEN NULL
                                            ELSE GREATEST(
                                                (SELECT MAX(tcl.created_at) FROM telephony_call_log tcl
                                                  WHERE tcl.response_id = ar.id),
                                                (SELECT MAX(tcl.created_at) FROM telephony_call_log tcl
                                                  WHERE tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD'),
                                                (SELECT MAX(tcl.created_at) FROM telephony_call_log tcl
                                                  WHERE tcl.user_id = ar.user_id
                                                    AND tcl.institute_id = a.institute_id))
                                       END AS last_called_at,
                                       CASE WHEN CAST(:activityFrom AS timestamp) IS NULL
                                             AND CAST(:activityTo AS timestamp) IS NULL
                                             AND COALESCE(:sortBy, '') <> 'LAST_ACTIVITY'
                                            THEN NULL
                                            ELSE GREATEST(
                                                (SELECT MAX(te.created_at) FROM timeline_event te
                                                  WHERE te.type = 'AUDIENCE_RESPONSE' AND te.type_id = ar.id),
                                                (SELECT MAX(te.created_at) FROM timeline_event te
                                                  WHERE te.student_user_id = ar.user_id),
                                                (SELECT MAX(te.created_at) FROM timeline_event te
                                                  WHERE te.student_user_id = ar.student_user_id))
                                       END AS last_activity_at
                            ) act ON true
                            WHERE ar.audience_id = :audienceId
                              AND (COALESCE(:leadStatusId, '') = '' OR COALESCE((SELECT lst.status_key FROM lead_status lst WHERE lst.id = ar.lead_status_id), ulp.conversion_status) = ANY(STRING_TO_ARRAY(:leadStatusId, ',')) OR ('__NO_STATUS__' = ANY(STRING_TO_ARRAY(:leadStatusId, ',')) AND ar.lead_status_id IS NULL AND ulp.conversion_status IS NULL))
                              AND (COALESCE(:leadStatusExcludeId, '') = '' OR COALESCE((SELECT lst.status_key FROM lead_status lst WHERE lst.id = ar.lead_status_id), ulp.conversion_status) IS NULL OR NOT (COALESCE((SELECT lst.status_key FROM lead_status lst WHERE lst.id = ar.lead_status_id), ulp.conversion_status) = ANY(STRING_TO_ARRAY(:leadStatusExcludeId, ','))))
                              AND (COALESCE(:followUpPending, FALSE) = FALSE OR EXISTS (SELECT 1 FROM lead_followup lf WHERE lf.audience_response_id = ar.id AND lf.is_closed = FALSE AND lf.schedule_time IS NOT NULL AND (CAST(:followUpFrom AS timestamp) IS NULL OR lf.schedule_time >= CAST(:followUpFrom AS timestamp)) AND (CAST(:followUpTo AS timestamp) IS NULL OR lf.schedule_time < CAST(:followUpTo AS timestamp))))
                              AND (COALESCE(:sourceType, '') = '' OR ar.source_type = :sourceType)
                              AND (COALESCE(:sourceId, '') = '' OR ar.source_id = :sourceId)
                              AND (CAST(:submittedFrom AS timestamp) IS NULL OR ar.submitted_at >= CAST(:submittedFrom AS timestamp))
                              AND (CAST(:submittedTo AS timestamp) IS NULL OR ar.submitted_at <= CAST(:submittedTo AS timestamp))
                              -- "How many did I work / call in the last 24h / 7d" -- deliberately
                              -- INDEPENDENT of submitted_at, which answers when the lead arrived,
                              -- not when the counsellor last touched it. Two separate windows:
                              -- calls only (telephony_call_log) vs any activity (timeline_event).
                              -- act.* is NULL when the lead was never called / never touched, and
                              -- NULL fails every comparison, so those leads are excluded as soon
                              -- as either bound is set -- no COALESCE-to-epoch needed.
                              AND (CAST(:calledFrom AS timestamp) IS NULL OR act.last_called_at >= CAST(:calledFrom AS timestamp))
                              AND (CAST(:calledTo AS timestamp) IS NULL OR act.last_called_at <= CAST(:calledTo AS timestamp))
                              AND (CAST(:activityFrom AS timestamp) IS NULL OR act.last_activity_at >= CAST(:activityFrom AS timestamp))
                              AND (CAST(:activityTo AS timestamp) IS NULL OR act.last_activity_at <= CAST(:activityTo AS timestamp))
                              AND (:excludeDuplicates IS NULL OR :excludeDuplicates = FALSE OR COALESCE(ar.is_duplicate, FALSE) = FALSE)
                              AND (COALESCE(:searchQuery, '') = '' OR
                                   LOWER(ar.parent_name) LIKE LOWER(CONCAT('%', :searchQuery, '%')) OR
                                   LOWER(ar.parent_email) LIKE LOWER(CONCAT('%', :searchQuery, '%')) OR
                                   ar.parent_mobile LIKE CONCAT('%', :searchQuery, '%') OR
                                   (COALESCE(:searchUserIdsCsv, '') != ''
                                    AND ar.user_id = ANY(STRING_TO_ARRAY(:searchUserIdsCsv, ','))))
                              AND (:minLeadScore IS NULL OR COALESCE(ls.raw_score, 0) >= :minLeadScore)
                              AND (:maxLeadScore IS NULL OR COALESCE(ls.raw_score, 0) <= :maxLeadScore)
                              AND (COALESCE(:leadTier, '') = '' OR
                                   (ulp.user_id IS NOT NULL AND COALESCE(NULLIF(ulp.lead_tier, ''),
                                       (SELECT lt.tier_key FROM lead_tier lt
                                         WHERE lt.institute_id = ulp.institute_id AND lt.is_active = TRUE
                                           AND lt.min_score IS NOT NULL AND ulp.best_score >= lt.min_score
                                         ORDER BY lt.min_score DESC, lt.display_order ASC LIMIT 1),
                                       CASE WHEN ulp.best_score >= 80 THEN 'HOT'
                                            WHEN ulp.best_score >= 50 THEN 'WARM'
                                            ELSE 'COLD' END) = ANY(STRING_TO_ARRAY(:leadTier, ','))))
                              AND (COALESCE(:assignedCounselorId, '') = ''
                                   OR lu.user_id = ANY(STRING_TO_ARRAY(:assignedCounselorId, ','))
                                   OR ulp.assigned_counselor_id = ANY(STRING_TO_ARRAY(:assignedCounselorId, ',')))
                              -- RBAC scope (CounsellorScopeService.descendantUserIdsForCaller):
                              -- caller + everyone reporting up to them through parent_user_id
                              -- chains in the leads-team subtree.
                              -- Unassigned leads (no counsellor on either linked_users or
                              -- user_lead_profile) stay visible to everyone — the "pool" of
                              -- leads anyone in scope can pick up.
                              AND (COALESCE(:assignedCounselorIdsCsv, '') = ''
                                   OR lu.user_id = ANY(STRING_TO_ARRAY(:assignedCounselorIdsCsv, ','))
                                   OR ulp.assigned_counselor_id = ANY(STRING_TO_ARRAY(:assignedCounselorIdsCsv, ','))
                                   OR ((:includeUnassigned IS NULL OR :includeUnassigned = TRUE) AND lu.user_id IS NULL AND ulp.assigned_counselor_id IS NULL))
                              AND (:isUnassigned IS NULL OR :isUnassigned = FALSE
                                   OR (lu.user_id IS NULL AND ulp.assigned_counselor_id IS NULL))
                              AND (
                                (COALESCE(:overallStatusStr, '') = '' AND (ar.overall_status IS NULL OR ar.overall_status != 'OPTED_OUT'))
                                OR (COALESCE(:overallStatusStr, '') != '' AND ar.overall_status = ANY(STRING_TO_ARRAY(:overallStatusStr, ',')))
                              )
                              AND (
                                COALESCE(:conversionStatusFilter, 'EXCLUDE_CONVERTED') = 'ALL'
                                OR (
                                  COALESCE(:conversionStatusFilter, 'EXCLUDE_CONVERTED') = 'EXCLUDE_CONVERTED'
                                  AND (ulp.conversion_status IS NULL OR ulp.conversion_status != 'CONVERTED')
                                )
                                OR (
                                  :conversionStatusFilter = 'ONLY_CONVERTED'
                                  AND ulp.conversion_status = 'CONVERTED'
                                )
                              )
                              -- Soft-delete filter. Mirrors conversionStatusFilter above:
                              -- EXCLUDE_DELETED (default) / ONLY_DELETED / ALL, so the UI can
                              -- offer a "show deleted leads" view without a second query.
                              -- Kept as its OWN unconditional AND rather than folded into the
                              -- overall_status OR block above: that block disables its own
                              -- OPTED_OUT guard whenever :overallStatusStr is set, and a
                              -- soft-deleted lead must stay hidden regardless of what else the
                              -- caller filters by.
                              AND (
                                COALESCE(:audienceStatusFilter, 'EXCLUDE_DELETED') = 'ALL'
                                OR (
                                  COALESCE(:audienceStatusFilter, 'EXCLUDE_DELETED') = 'EXCLUDE_DELETED'
                                  AND ar.audience_status = 'ACTIVE'
                                )
                                OR (
                                  :audienceStatusFilter = 'ONLY_DELETED'
                                  AND ar.audience_status = 'INACTIVE'
                                )
                              )
                              -- SLA-state filter. Aligned with the row-level badges + the new
                              -- column semantics:
                              --   * Reach-out buckets use submitted_at + tatMinutes AND a NOT EXISTS
                              --     check on timeline_event (any response event — see
                              --     findCounselorActionsByResponseIds) so leads already responded
                              --     to are excluded, matching the badge.
                              --   * Follow-up buckets read the lead_followup table (open rows
                              --     only), matching the Follow up at column which is now purely
                              --     counsellor-scheduled callbacks.
                              AND (COALESCE(:slaFilter, '') = ''
                                   OR ('TAT_OVERDUE' = ANY(STRING_TO_ARRAY(:slaFilter, ','))
                                       AND :tatMinutes IS NOT NULL
                                       AND ar.submitted_at IS NOT NULL
                                       AND ar.submitted_at + make_interval(mins => CAST(:tatMinutes AS integer)) < NOW()
                                       AND NOT EXISTS (
                                           SELECT 1 FROM timeline_event te
                                           WHERE (te.category = 'ACTIVITY' OR te.action_type = 'REACHOUT' OR (te.action_type IN ('STATUS_CHANGED','LEAD_CONVERTED','LEAD_LOST','COUNSELOR_ASSIGNED','COUNSELOR_UNASSIGNED','MANUAL_SCORE_UPDATE') AND te.actor_id IS NOT NULL))
                                             AND ( (te.type = 'AUDIENCE_RESPONSE' AND te.type_id = ar.id)
                                                   OR (ar.user_id IS NOT NULL AND te.student_user_id = ar.user_id)
                                                   OR (ar.student_user_id IS NOT NULL AND te.student_user_id = ar.student_user_id) )))
                                   OR ('TAT_BEFORE' = ANY(STRING_TO_ARRAY(:slaFilter, ','))
                                       AND :tatMinutes IS NOT NULL
                                       AND ar.submitted_at IS NOT NULL
                                       AND ar.submitted_at + make_interval(mins => CAST(:tatMinutes AS integer)) > NOW()
                                       AND ar.submitted_at + make_interval(mins => CAST(:tatMinutes AS integer)) <= NOW() + INTERVAL '30 minutes'
                                       AND NOT EXISTS (
                                           SELECT 1 FROM timeline_event te
                                           WHERE (te.category = 'ACTIVITY' OR te.action_type = 'REACHOUT' OR (te.action_type IN ('STATUS_CHANGED','LEAD_CONVERTED','LEAD_LOST','COUNSELOR_ASSIGNED','COUNSELOR_UNASSIGNED','MANUAL_SCORE_UPDATE') AND te.actor_id IS NOT NULL))
                                             AND ( (te.type = 'AUDIENCE_RESPONSE' AND te.type_id = ar.id)
                                                   OR (ar.user_id IS NOT NULL AND te.student_user_id = ar.user_id)
                                                   OR (ar.student_user_id IS NOT NULL AND te.student_user_id = ar.student_user_id) )))
                                   OR ('FOLLOW_UP_DUE' = ANY(STRING_TO_ARRAY(:slaFilter, ','))
                                       AND EXISTS (
                                           SELECT 1 FROM lead_followup lf
                                           WHERE lf.audience_response_id = ar.id
                                             AND lf.is_closed = false
                                             AND lf.schedule_time IS NOT NULL
                                             AND lf.schedule_time > NOW()
                                             AND lf.schedule_time <= NOW() + INTERVAL '30 minutes'))
                                   OR ('FOLLOW_UP_OVERDUE' = ANY(STRING_TO_ARRAY(:slaFilter, ','))
                                       AND EXISTS (
                                           SELECT 1 FROM lead_followup lf
                                           WHERE lf.audience_response_id = ar.id
                                             AND lf.is_closed = false
                                             AND lf.schedule_time IS NOT NULL
                                             AND lf.schedule_time < NOW()))
                                   OR ('ANY_OVERDUE' = ANY(STRING_TO_ARRAY(:slaFilter, ','))
                                       AND (
                                           (:tatMinutes IS NOT NULL
                                            AND ar.submitted_at IS NOT NULL
                                            AND ar.submitted_at + make_interval(mins => CAST(:tatMinutes AS integer)) < NOW()
                                            AND NOT EXISTS (
                                                SELECT 1 FROM timeline_event te
                                                WHERE (te.category = 'ACTIVITY' OR te.action_type = 'REACHOUT' OR (te.action_type IN ('STATUS_CHANGED','LEAD_CONVERTED','LEAD_LOST','COUNSELOR_ASSIGNED','COUNSELOR_UNASSIGNED','MANUAL_SCORE_UPDATE') AND te.actor_id IS NOT NULL))
                                                  AND ( (te.type = 'AUDIENCE_RESPONSE' AND te.type_id = ar.id)
                                                        OR (ar.user_id IS NOT NULL AND te.student_user_id = ar.user_id)
                                                        OR (ar.student_user_id IS NOT NULL AND te.student_user_id = ar.student_user_id) )))
                                           OR EXISTS (
                                               SELECT 1 FROM lead_followup lf
                                               WHERE lf.audience_response_id = ar.id
                                                 AND lf.is_closed = false
                                                 AND lf.schedule_time IS NOT NULL
                                                 AND lf.schedule_time < NOW()))))
                              AND (COALESCE(:customFieldMatchedIdsCsv, '') = ''
                                   OR ar.id = ANY(STRING_TO_ARRAY(:customFieldMatchedIdsCsv, ',')))
                              AND (COALESCE(:customFieldExcludedIdsCsv, '') = ''
                                   OR NOT (ar.id = ANY(STRING_TO_ARRAY(:customFieldExcludedIdsCsv, ','))))
                              -- NOTE never put a semicolon anywhere in this query's comments --
                              -- Hibernate's limit handler treats the first semicolon as end of
                              -- statement and injects "fetch first ? rows only" there, which
                              -- desyncs JDBC parameter binding (column index out of range).
                              -- Call-history matching. A call log links to a lead THREE ways:
                              -- response_id (manual dialer + CDR import), subject_id+LEAD (AI
                              -- campaigns), or just user_id (about a quarter of Airtel CDR rows
                              -- have no response link, while the lead side-panel lists calls by
                              -- user_id + institute, so the filter must match the same or called
                              -- leads land in NOT_CALLED).
                              -- Keep each column in its OWN EXISTS block: one EXISTS with an OR
                              -- across columns defeats every index and seq-scans the whole call
                              -- log per candidate lead (statement timeout).
                              AND (COALESCE(:callHistoryFilter, '') = ''
                                   OR (:callHistoryFilter = 'NOT_CALLED'
                                       AND NOT EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.response_id = ar.id)
                                       AND NOT EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD')
                                       AND NOT EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.user_id = ar.user_id
                                                AND tcl.institute_id = a.institute_id))
                                   OR (:callHistoryFilter = 'CALLED'
                                       AND (EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.response_id = ar.id)
                                         OR EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD')
                                         OR EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.user_id = ar.user_id
                                                AND tcl.institute_id = a.institute_id)))
                                   OR (:callHistoryFilter = 'CALLED_ONCE' AND (
                                         SELECT COUNT(*) FROM telephony_call_log tcl
                                          WHERE tcl.response_id = ar.id
                                             OR (tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD')
                                             OR (tcl.user_id = ar.user_id
                                                 AND tcl.institute_id = a.institute_id)) = 1)
                                   OR (:callHistoryFilter = 'CALLED_TWICE_PLUS' AND (
                                         SELECT COUNT(*) FROM telephony_call_log tcl
                                          WHERE tcl.response_id = ar.id
                                             OR (tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD')
                                             OR (tcl.user_id = ar.user_id
                                                 AND tcl.institute_id = a.institute_id)) >= 2)
                                   -- Arbitrary-N variants of the two options above: "called
                                   -- exactly N times" and "called N or more times". N comes from
                                   -- :callCountValue, floored at 1 so a missing/zero value
                                   -- degrades to the CALLED_ONCE / CALLED semantics rather than
                                   -- matching nothing.
                                   OR (:callHistoryFilter = 'CALLED_N_TIMES' AND (
                                         SELECT COUNT(*) FROM telephony_call_log tcl
                                          WHERE tcl.response_id = ar.id
                                             OR (tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD')
                                             OR (tcl.user_id = ar.user_id
                                                 AND tcl.institute_id = a.institute_id))
                                       = GREATEST(COALESCE(CAST(:callCountValue AS integer), 1), 1))
                                   OR (:callHistoryFilter = 'CALLED_N_PLUS_TIMES' AND (
                                         SELECT COUNT(*) FROM telephony_call_log tcl
                                          WHERE tcl.response_id = ar.id
                                             OR (tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD')
                                             OR (tcl.user_id = ar.user_id
                                                 AND tcl.institute_id = a.institute_id))
                                       >= GREATEST(COALESCE(CAST(:callCountValue AS integer), 1), 1))
                                   OR (:callHistoryFilter = 'AI_CALLED'
                                       AND (EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.response_id = ar.id
                                                AND tcl.provider_type IN ('VACADEMY_AI', 'AAVTAAR'))
                                         OR EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD'
                                                AND tcl.provider_type IN ('VACADEMY_AI', 'AAVTAAR'))
                                         OR EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.user_id = ar.user_id
                                                AND tcl.institute_id = a.institute_id
                                                AND tcl.provider_type IN ('VACADEMY_AI', 'AAVTAAR'))))
                                   OR (:callHistoryFilter = 'MANUAL_CALLED'
                                       AND (EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.response_id = ar.id
                                                AND tcl.provider_type NOT IN ('VACADEMY_AI', 'AAVTAAR', 'MOCK'))
                                         OR EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD'
                                                AND tcl.provider_type NOT IN ('VACADEMY_AI', 'AAVTAAR', 'MOCK'))
                                         OR EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.user_id = ar.user_id
                                                AND tcl.institute_id = a.institute_id
                                                AND tcl.provider_type NOT IN ('VACADEMY_AI', 'AAVTAAR', 'MOCK')))))
                        """, nativeQuery = true)
        Page<AudienceResponse> findLeadsWithFilters(
                        @Param("audienceId") String audienceId,
                        @Param("leadStatusId") String leadStatusId,
                        @Param("leadStatusExcludeId") String leadStatusExcludeId,
                        @Param("followUpPending") Boolean followUpPending,
                        @Param("followUpFrom") Timestamp followUpFrom,
                        @Param("followUpTo") Timestamp followUpTo,
                        @Param("sourceType") String sourceType,
                        @Param("sourceId") String sourceId,
                        @Param("submittedFrom") Timestamp submittedFrom,
                        @Param("submittedTo") Timestamp submittedTo,
                        @Param("excludeDuplicates") Boolean excludeDuplicates,
                        @Param("searchQuery") String searchQuery,
                        @Param("searchUserIdsCsv") String searchUserIdsCsv,
                        @Param("minLeadScore") Integer minLeadScore,
                        @Param("maxLeadScore") Integer maxLeadScore,
                        @Param("leadTier") String leadTier,
                        @Param("assignedCounselorId") String assignedCounselorId,
                        @Param("assignedCounselorIdsCsv") String assignedCounselorIdsCsv,
                        @Param("includeUnassigned") Boolean includeUnassigned,
                        @Param("isUnassigned") Boolean isUnassigned,
                        @Param("overallStatusStr") String overallStatusStr,
                        @Param("customFieldMatchedIdsCsv") String customFieldMatchedIdsCsv,
                        @Param("customFieldExcludedIdsCsv") String customFieldExcludedIdsCsv,
                        @Param("callHistoryFilter") String callHistoryFilter,
                        @Param("callCountValue") Integer callCountValue,
                        @Param("conversionStatusFilter") String conversionStatusFilter,
                        @Param("audienceStatusFilter") String audienceStatusFilter,
                        @Param("slaFilter") String slaFilter,
                        @Param("tatMinutes") Integer tatMinutes,
                        @Param("sortBy") String sortBy,
                        @Param("sortDirection") String sortDirection,
                        @Param("sortCustomFieldId") String sortCustomFieldId,
                        @Param("calledFrom") Timestamp calledFrom,
                        @Param("calledTo") Timestamp calledTo,
                        @Param("activityFrom") Timestamp activityFrom,
                        @Param("activityTo") Timestamp activityTo,
                        Pageable pageable);

        /**
         * Find all leads for an institute (across all campaigns)
         */
        @Query("""
                            SELECT ar FROM AudienceResponse ar
                            JOIN Audience a ON a.id = ar.audienceId
                            WHERE a.instituteId = :instituteId
                            AND (ar.overallStatus IS NULL OR ar.overallStatus != 'OPTED_OUT')
                            AND ar.audienceStatus = 'ACTIVE'
                            ORDER BY ar.submittedAt DESC
                        """)
        Page<AudienceResponse> findAllLeadsForInstitute(
                        @Param("instituteId") String instituteId,
                        Pageable pageable);

        /**
         * Find leads across all campaigns for an institute with optional date range,
         * search, lead-tier and assigned-counselor filters. Used by the
         * cross-audience "Recent Leads" view. Mirrors the joins / predicates of
         * {@link #findLeadsWithFilters} so tier and counselor scoping behave
         * identically across the per-campaign and cross-campaign paths.
         */
        @Query(value = """
                            SELECT ar.*
                            FROM audience_response ar
                            JOIN audience a ON a.id = ar.audience_id
                            LEFT JOIN lead_score ls ON ls.audience_response_id = ar.id
                            LEFT JOIN LATERAL (
                                SELECT lu.user_id
                                FROM linked_users lu
                                WHERE lu.source = 'ENQUIRY' AND lu.source_id = ar.enquiry_id
                                ORDER BY lu.created_at DESC
                                LIMIT 1
                            ) lu ON true
                            LEFT JOIN user_lead_profile ulp
                                ON ulp.user_id = ar.user_id AND ulp.institute_id = a.institute_id
                            -- Last counsellor touch per lead, computed ONCE per row so the
                            -- "worked in the last 24h / 7d" windows and the Activity-column sort
                            -- below can both read it without re-running the correlated MAXes.
                            -- Each arm is its own index-backed subquery (idx_tcl_response,
                            -- idx_tcl_subject, idx_tcl_user, idx_timeline_event_type_type_id,
                            -- idx_timeline_student_recent) -- one subquery OR-ing the columns
                            -- together would seq-scan both logs per candidate lead.
                            -- GREATEST ignores NULL arms, so a lead with no call / no activity
                            -- keeps a NULL here and drops out of any window that is set.
                            LEFT JOIN LATERAL (
                                -- Each half is wrapped in a CASE that short-circuits to NULL when
                                -- neither the matching window NOR the matching sort is requested.
                                -- Without it these six correlated MAXes would run for every row of
                                -- EVERY leads-list call, including the overwhelming majority that
                                -- never touch these filters, and this is the hottest query in the CRM.
                                -- CASE does not evaluate the branch it does not take, so the
                                -- default path costs nothing.
                                SELECT CASE WHEN CAST(:calledFrom AS timestamp) IS NULL
                                             AND CAST(:calledTo AS timestamp) IS NULL
                                             AND COALESCE(:sortBy, '') <> 'LAST_CALLED'
                                            THEN NULL
                                            ELSE GREATEST(
                                                (SELECT MAX(tcl.created_at) FROM telephony_call_log tcl
                                                  WHERE tcl.response_id = ar.id),
                                                (SELECT MAX(tcl.created_at) FROM telephony_call_log tcl
                                                  WHERE tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD'),
                                                (SELECT MAX(tcl.created_at) FROM telephony_call_log tcl
                                                  WHERE tcl.user_id = ar.user_id
                                                    AND tcl.institute_id = a.institute_id))
                                       END AS last_called_at,
                                       CASE WHEN CAST(:activityFrom AS timestamp) IS NULL
                                             AND CAST(:activityTo AS timestamp) IS NULL
                                             AND COALESCE(:sortBy, '') <> 'LAST_ACTIVITY'
                                            THEN NULL
                                            ELSE GREATEST(
                                                (SELECT MAX(te.created_at) FROM timeline_event te
                                                  WHERE te.type = 'AUDIENCE_RESPONSE' AND te.type_id = ar.id),
                                                (SELECT MAX(te.created_at) FROM timeline_event te
                                                  WHERE te.student_user_id = ar.user_id),
                                                (SELECT MAX(te.created_at) FROM timeline_event te
                                                  WHERE te.student_user_id = ar.student_user_id))
                                       END AS last_activity_at
                            ) act ON true
                            WHERE a.institute_id = :instituteId
                              AND (COALESCE(:leadStatusId, '') = '' OR COALESCE((SELECT lst.status_key FROM lead_status lst WHERE lst.id = ar.lead_status_id), ulp.conversion_status) = ANY(STRING_TO_ARRAY(:leadStatusId, ',')) OR ('__NO_STATUS__' = ANY(STRING_TO_ARRAY(:leadStatusId, ',')) AND ar.lead_status_id IS NULL AND ulp.conversion_status IS NULL))
                              AND (COALESCE(:leadStatusExcludeId, '') = '' OR COALESCE((SELECT lst.status_key FROM lead_status lst WHERE lst.id = ar.lead_status_id), ulp.conversion_status) IS NULL OR NOT (COALESCE((SELECT lst.status_key FROM lead_status lst WHERE lst.id = ar.lead_status_id), ulp.conversion_status) = ANY(STRING_TO_ARRAY(:leadStatusExcludeId, ','))))
                              AND (COALESCE(:followUpPending, FALSE) = FALSE OR EXISTS (SELECT 1 FROM lead_followup lf WHERE lf.audience_response_id = ar.id AND lf.is_closed = FALSE AND lf.schedule_time IS NOT NULL AND (CAST(:followUpFrom AS timestamp) IS NULL OR lf.schedule_time >= CAST(:followUpFrom AS timestamp)) AND (CAST(:followUpTo AS timestamp) IS NULL OR lf.schedule_time < CAST(:followUpTo AS timestamp))))
                              AND (CAST(:submittedFrom AS timestamp) IS NULL OR ar.submitted_at >= CAST(:submittedFrom AS timestamp))
                              AND (CAST(:submittedTo AS timestamp) IS NULL OR ar.submitted_at <= CAST(:submittedTo AS timestamp))
                              -- "How many did I work / call in the last 24h / 7d" -- deliberately
                              -- INDEPENDENT of submitted_at, which answers when the lead arrived,
                              -- not when the counsellor last touched it. Two separate windows:
                              -- calls only (telephony_call_log) vs any activity (timeline_event).
                              -- act.* is NULL when the lead was never called / never touched, and
                              -- NULL fails every comparison, so those leads are excluded as soon
                              -- as either bound is set -- no COALESCE-to-epoch needed.
                              AND (CAST(:calledFrom AS timestamp) IS NULL OR act.last_called_at >= CAST(:calledFrom AS timestamp))
                              AND (CAST(:calledTo AS timestamp) IS NULL OR act.last_called_at <= CAST(:calledTo AS timestamp))
                              AND (CAST(:activityFrom AS timestamp) IS NULL OR act.last_activity_at >= CAST(:activityFrom AS timestamp))
                              AND (CAST(:activityTo AS timestamp) IS NULL OR act.last_activity_at <= CAST(:activityTo AS timestamp))
                              AND (COALESCE(:searchQuery, '') = '' OR
                                   LOWER(ar.parent_name) LIKE LOWER(CONCAT('%', :searchQuery, '%')) OR
                                   LOWER(ar.parent_email) LIKE LOWER(CONCAT('%', :searchQuery, '%')) OR
                                   ar.parent_mobile LIKE CONCAT('%', :searchQuery, '%') OR
                                   (COALESCE(:searchUserIdsCsv, '') != ''
                                    AND ar.user_id = ANY(STRING_TO_ARRAY(:searchUserIdsCsv, ','))))
                              AND (COALESCE(:leadTier, '') = '' OR
                                   (ulp.user_id IS NOT NULL AND COALESCE(NULLIF(ulp.lead_tier, ''),
                                       (SELECT lt.tier_key FROM lead_tier lt
                                         WHERE lt.institute_id = ulp.institute_id AND lt.is_active = TRUE
                                           AND lt.min_score IS NOT NULL AND ulp.best_score >= lt.min_score
                                         ORDER BY lt.min_score DESC, lt.display_order ASC LIMIT 1),
                                       CASE WHEN ulp.best_score >= 80 THEN 'HOT'
                                            WHEN ulp.best_score >= 50 THEN 'WARM'
                                            ELSE 'COLD' END) = ANY(STRING_TO_ARRAY(:leadTier, ','))))
                              AND (COALESCE(:assignedCounselorId, '') = ''
                                   OR lu.user_id = ANY(STRING_TO_ARRAY(:assignedCounselorId, ','))
                                   OR ulp.assigned_counselor_id = ANY(STRING_TO_ARRAY(:assignedCounselorId, ',')))
                              -- RBAC scope (CounsellorScopeService.descendantUserIdsForCaller):
                              -- caller + everyone reporting up to them through parent_user_id
                              -- chains inside the leads-team subtree. ANDed with the single-id
                              -- narrow above so a manager can still drill into one report.
                              -- Unassigned leads (no counsellor on either linked_users or
                              -- user_lead_profile) stay visible to everyone — anyone in
                              -- scope can pick them up.
                              AND (COALESCE(:assignedCounselorIdsCsv, '') = ''
                                   OR lu.user_id = ANY(STRING_TO_ARRAY(:assignedCounselorIdsCsv, ','))
                                   OR ulp.assigned_counselor_id = ANY(STRING_TO_ARRAY(:assignedCounselorIdsCsv, ','))
                                   OR ((:includeUnassigned IS NULL OR :includeUnassigned = TRUE) AND lu.user_id IS NULL AND ulp.assigned_counselor_id IS NULL))
                              -- isUnassigned = TRUE narrows to leads with no owner at all
                              -- (both the ENQUIRY-linked counsellor and the profile owner are null).
                              AND (:isUnassigned IS NULL OR :isUnassigned = FALSE
                                   OR (lu.user_id IS NULL AND ulp.assigned_counselor_id IS NULL))
                              AND (COALESCE(:allowedAudienceIdsCsv, '') = '' OR ar.audience_id = ANY(STRING_TO_ARRAY(:allowedAudienceIdsCsv, ',')))
                              -- Caller-requested audience multi-select (Recent Leads "All audiences"
                              -- dropdown). Independent of the RBAC :allowedAudienceIdsCsv above, which
                              -- stays ANDed so a user can never widen past what they were granted.
                              AND (COALESCE(:audienceIdsCsv, '') = '' OR ar.audience_id = ANY(STRING_TO_ARRAY(:audienceIdsCsv, ',')))
                              AND (
                                COALESCE(:conversionStatusFilter, 'EXCLUDE_CONVERTED') = 'ALL'
                                OR (
                                  COALESCE(:conversionStatusFilter, 'EXCLUDE_CONVERTED') = 'EXCLUDE_CONVERTED'
                                  AND (ulp.conversion_status IS NULL OR ulp.conversion_status != 'CONVERTED')
                                )
                                OR (
                                  :conversionStatusFilter = 'ONLY_CONVERTED'
                                  AND ulp.conversion_status = 'CONVERTED'
                                )
                              )
                              -- Soft-delete filter. Mirrors conversionStatusFilter above:
                              -- EXCLUDE_DELETED (default) / ONLY_DELETED / ALL, so the UI can
                              -- offer a "show deleted leads" view without a second query.
                              -- Kept as its OWN unconditional AND rather than folded into the
                              -- overall_status OR block above: that block disables its own
                              -- OPTED_OUT guard whenever :overallStatusStr is set, and a
                              -- soft-deleted lead must stay hidden regardless of what else the
                              -- caller filters by.
                              AND (
                                COALESCE(:audienceStatusFilter, 'EXCLUDE_DELETED') = 'ALL'
                                OR (
                                  COALESCE(:audienceStatusFilter, 'EXCLUDE_DELETED') = 'EXCLUDE_DELETED'
                                  AND ar.audience_status = 'ACTIVE'
                                )
                                OR (
                                  :audienceStatusFilter = 'ONLY_DELETED'
                                  AND ar.audience_status = 'INACTIVE'
                                )
                              )
                              AND (ar.overall_status IS NULL OR ar.overall_status != 'OPTED_OUT')
                              -- SLA-state filter. Aligned with the row-level badges + the new
                              -- column semantics:
                              --   * Reach-out buckets use submitted_at + tatMinutes AND a NOT EXISTS
                              --     check on timeline_event (any response event — see
                              --     findCounselorActionsByResponseIds) so leads already responded
                              --     to are excluded, matching the badge.
                              --   * Follow-up buckets read the lead_followup table (open rows
                              --     only), matching the Follow up at column which is now purely
                              --     counsellor-scheduled callbacks.
                              AND (COALESCE(:slaFilter, '') = ''
                                   OR ('TAT_OVERDUE' = ANY(STRING_TO_ARRAY(:slaFilter, ','))
                                       AND :tatMinutes IS NOT NULL
                                       AND ar.submitted_at IS NOT NULL
                                       AND ar.submitted_at + make_interval(mins => CAST(:tatMinutes AS integer)) < NOW()
                                       AND NOT EXISTS (
                                           SELECT 1 FROM timeline_event te
                                           WHERE (te.category = 'ACTIVITY' OR te.action_type = 'REACHOUT' OR (te.action_type IN ('STATUS_CHANGED','LEAD_CONVERTED','LEAD_LOST','COUNSELOR_ASSIGNED','COUNSELOR_UNASSIGNED','MANUAL_SCORE_UPDATE') AND te.actor_id IS NOT NULL))
                                             AND ( (te.type = 'AUDIENCE_RESPONSE' AND te.type_id = ar.id)
                                                   OR (ar.user_id IS NOT NULL AND te.student_user_id = ar.user_id)
                                                   OR (ar.student_user_id IS NOT NULL AND te.student_user_id = ar.student_user_id) )))
                                   OR ('TAT_BEFORE' = ANY(STRING_TO_ARRAY(:slaFilter, ','))
                                       AND :tatMinutes IS NOT NULL
                                       AND ar.submitted_at IS NOT NULL
                                       AND ar.submitted_at + make_interval(mins => CAST(:tatMinutes AS integer)) > NOW()
                                       AND ar.submitted_at + make_interval(mins => CAST(:tatMinutes AS integer)) <= NOW() + INTERVAL '30 minutes'
                                       AND NOT EXISTS (
                                           SELECT 1 FROM timeline_event te
                                           WHERE (te.category = 'ACTIVITY' OR te.action_type = 'REACHOUT' OR (te.action_type IN ('STATUS_CHANGED','LEAD_CONVERTED','LEAD_LOST','COUNSELOR_ASSIGNED','COUNSELOR_UNASSIGNED','MANUAL_SCORE_UPDATE') AND te.actor_id IS NOT NULL))
                                             AND ( (te.type = 'AUDIENCE_RESPONSE' AND te.type_id = ar.id)
                                                   OR (ar.user_id IS NOT NULL AND te.student_user_id = ar.user_id)
                                                   OR (ar.student_user_id IS NOT NULL AND te.student_user_id = ar.student_user_id) )))
                                   OR ('FOLLOW_UP_DUE' = ANY(STRING_TO_ARRAY(:slaFilter, ','))
                                       AND EXISTS (
                                           SELECT 1 FROM lead_followup lf
                                           WHERE lf.audience_response_id = ar.id
                                             AND lf.is_closed = false
                                             AND lf.schedule_time IS NOT NULL
                                             AND lf.schedule_time > NOW()
                                             AND lf.schedule_time <= NOW() + INTERVAL '30 minutes'))
                                   OR ('FOLLOW_UP_OVERDUE' = ANY(STRING_TO_ARRAY(:slaFilter, ','))
                                       AND EXISTS (
                                           SELECT 1 FROM lead_followup lf
                                           WHERE lf.audience_response_id = ar.id
                                             AND lf.is_closed = false
                                             AND lf.schedule_time IS NOT NULL
                                             AND lf.schedule_time < NOW()))
                                   OR ('ANY_OVERDUE' = ANY(STRING_TO_ARRAY(:slaFilter, ','))
                                       AND (
                                           (:tatMinutes IS NOT NULL
                                            AND ar.submitted_at IS NOT NULL
                                            AND ar.submitted_at + make_interval(mins => CAST(:tatMinutes AS integer)) < NOW()
                                            AND NOT EXISTS (
                                                SELECT 1 FROM timeline_event te
                                                WHERE (te.category = 'ACTIVITY' OR te.action_type = 'REACHOUT' OR (te.action_type IN ('STATUS_CHANGED','LEAD_CONVERTED','LEAD_LOST','COUNSELOR_ASSIGNED','COUNSELOR_UNASSIGNED','MANUAL_SCORE_UPDATE') AND te.actor_id IS NOT NULL))
                                                  AND ( (te.type = 'AUDIENCE_RESPONSE' AND te.type_id = ar.id)
                                                        OR (ar.user_id IS NOT NULL AND te.student_user_id = ar.user_id)
                                                        OR (ar.student_user_id IS NOT NULL AND te.student_user_id = ar.student_user_id) )))
                                           OR EXISTS (
                                               SELECT 1 FROM lead_followup lf
                                               WHERE lf.audience_response_id = ar.id
                                                 AND lf.is_closed = false
                                                 AND lf.schedule_time IS NOT NULL
                                                 AND lf.schedule_time < NOW()))))
                              AND (COALESCE(:customFieldMatchedIdsCsv, '') = ''
                                   OR ar.id = ANY(STRING_TO_ARRAY(:customFieldMatchedIdsCsv, ',')))
                              AND (COALESCE(:customFieldExcludedIdsCsv, '') = ''
                                   OR NOT (ar.id = ANY(STRING_TO_ARRAY(:customFieldExcludedIdsCsv, ','))))
                              -- NOTE never put a semicolon anywhere in this query's comments --
                              -- Hibernate's limit handler treats the first semicolon as end of
                              -- statement and injects "fetch first ? rows only" there, which
                              -- desyncs JDBC parameter binding (column index out of range).
                              -- Call-history matching. A call log links to a lead THREE ways:
                              -- response_id (manual dialer + CDR import), subject_id+LEAD (AI
                              -- campaigns), or just user_id (about a quarter of Airtel CDR rows
                              -- have no response link, while the lead side-panel lists calls by
                              -- user_id + institute, so the filter must match the same or called
                              -- leads land in NOT_CALLED).
                              -- Keep each column in its OWN EXISTS block: one EXISTS with an OR
                              -- across columns defeats every index and seq-scans the whole call
                              -- log per candidate lead (statement timeout).
                              AND (COALESCE(:callHistoryFilter, '') = ''
                                   OR (:callHistoryFilter = 'NOT_CALLED'
                                       AND NOT EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.response_id = ar.id)
                                       AND NOT EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD')
                                       AND NOT EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.user_id = ar.user_id
                                                AND tcl.institute_id = a.institute_id))
                                   OR (:callHistoryFilter = 'CALLED'
                                       AND (EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.response_id = ar.id)
                                         OR EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD')
                                         OR EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.user_id = ar.user_id
                                                AND tcl.institute_id = a.institute_id)))
                                   OR (:callHistoryFilter = 'CALLED_ONCE' AND (
                                         SELECT COUNT(*) FROM telephony_call_log tcl
                                          WHERE tcl.response_id = ar.id
                                             OR (tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD')
                                             OR (tcl.user_id = ar.user_id
                                                 AND tcl.institute_id = a.institute_id)) = 1)
                                   OR (:callHistoryFilter = 'CALLED_TWICE_PLUS' AND (
                                         SELECT COUNT(*) FROM telephony_call_log tcl
                                          WHERE tcl.response_id = ar.id
                                             OR (tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD')
                                             OR (tcl.user_id = ar.user_id
                                                 AND tcl.institute_id = a.institute_id)) >= 2)
                                   -- Arbitrary-N variants of the two options above: "called
                                   -- exactly N times" and "called N or more times". N comes from
                                   -- :callCountValue, floored at 1 so a missing/zero value
                                   -- degrades to the CALLED_ONCE / CALLED semantics rather than
                                   -- matching nothing.
                                   OR (:callHistoryFilter = 'CALLED_N_TIMES' AND (
                                         SELECT COUNT(*) FROM telephony_call_log tcl
                                          WHERE tcl.response_id = ar.id
                                             OR (tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD')
                                             OR (tcl.user_id = ar.user_id
                                                 AND tcl.institute_id = a.institute_id))
                                       = GREATEST(COALESCE(CAST(:callCountValue AS integer), 1), 1))
                                   OR (:callHistoryFilter = 'CALLED_N_PLUS_TIMES' AND (
                                         SELECT COUNT(*) FROM telephony_call_log tcl
                                          WHERE tcl.response_id = ar.id
                                             OR (tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD')
                                             OR (tcl.user_id = ar.user_id
                                                 AND tcl.institute_id = a.institute_id))
                                       >= GREATEST(COALESCE(CAST(:callCountValue AS integer), 1), 1))
                                   OR (:callHistoryFilter = 'AI_CALLED'
                                       AND (EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.response_id = ar.id
                                                AND tcl.provider_type IN ('VACADEMY_AI', 'AAVTAAR'))
                                         OR EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD'
                                                AND tcl.provider_type IN ('VACADEMY_AI', 'AAVTAAR'))
                                         OR EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.user_id = ar.user_id
                                                AND tcl.institute_id = a.institute_id
                                                AND tcl.provider_type IN ('VACADEMY_AI', 'AAVTAAR'))))
                                   OR (:callHistoryFilter = 'MANUAL_CALLED'
                                       AND (EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.response_id = ar.id
                                                AND tcl.provider_type NOT IN ('VACADEMY_AI', 'AAVTAAR', 'MOCK'))
                                         OR EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD'
                                                AND tcl.provider_type NOT IN ('VACADEMY_AI', 'AAVTAAR', 'MOCK'))
                                         OR EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.user_id = ar.user_id
                                                AND tcl.institute_id = a.institute_id
                                                AND tcl.provider_type NOT IN ('VACADEMY_AI', 'AAVTAAR', 'MOCK')))))
                            ORDER BY
                              CASE WHEN :sortBy = 'SUBMITTED_AT' AND :sortDirection = 'ASC'
                                   THEN ar.submitted_at END ASC,
                              CASE WHEN :sortBy = 'SUBMITTED_AT' AND (:sortDirection IS NULL OR :sortDirection = 'DESC')
                                   THEN ar.submitted_at END DESC,
                              CASE WHEN :sortBy = 'LEAD_SCORE' AND (:sortDirection IS NULL OR :sortDirection = 'DESC')
                                   THEN COALESCE(ls.raw_score, 0) END DESC,
                              CASE WHEN :sortBy = 'LEAD_SCORE' AND :sortDirection = 'ASC'
                                   THEN COALESCE(ls.raw_score, 0) END ASC,
                              CASE WHEN :sortBy = 'LEAD_TIER' AND :sortDirection = 'ASC'
                                   THEN COALESCE(
                                        (SELECT 1000 - lt.display_order FROM lead_tier lt
                                          WHERE lt.institute_id = ulp.institute_id AND lt.is_active = TRUE
                                            AND lt.tier_key = COALESCE(NULLIF(ulp.lead_tier, ''),
                                                (SELECT lt2.tier_key FROM lead_tier lt2
                                                  WHERE lt2.institute_id = ulp.institute_id AND lt2.is_active = TRUE
                                                    AND lt2.min_score IS NOT NULL AND ulp.best_score >= lt2.min_score
                                                  ORDER BY lt2.min_score DESC, lt2.display_order ASC LIMIT 1))
                                          LIMIT 1),
                                        CASE COALESCE(NULLIF(ulp.lead_tier, ''),
                                            CASE WHEN ulp.best_score >= 80 THEN 'HOT'
                                                 WHEN ulp.best_score >= 50 THEN 'WARM'
                                                 WHEN ulp.best_score IS NOT NULL THEN 'COLD'
                                                 ELSE NULL END)
                                        WHEN 'HOT' THEN 3 WHEN 'WARM' THEN 2 WHEN 'COLD' THEN 1 ELSE 0 END) END ASC,
                              CASE WHEN :sortBy = 'LEAD_TIER' AND (:sortDirection IS NULL OR :sortDirection = 'DESC')
                                   THEN COALESCE(
                                        (SELECT 1000 - lt.display_order FROM lead_tier lt
                                          WHERE lt.institute_id = ulp.institute_id AND lt.is_active = TRUE
                                            AND lt.tier_key = COALESCE(NULLIF(ulp.lead_tier, ''),
                                                (SELECT lt2.tier_key FROM lead_tier lt2
                                                  WHERE lt2.institute_id = ulp.institute_id AND lt2.is_active = TRUE
                                                    AND lt2.min_score IS NOT NULL AND ulp.best_score >= lt2.min_score
                                                  ORDER BY lt2.min_score DESC, lt2.display_order ASC LIMIT 1))
                                          LIMIT 1),
                                        CASE COALESCE(NULLIF(ulp.lead_tier, ''),
                                            CASE WHEN ulp.best_score >= 80 THEN 'HOT'
                                                 WHEN ulp.best_score >= 50 THEN 'WARM'
                                                 WHEN ulp.best_score IS NOT NULL THEN 'COLD'
                                                 ELSE NULL END)
                                        WHEN 'HOT' THEN 3 WHEN 'WARM' THEN 2 WHEN 'COLD' THEN 1 ELSE 0 END) END DESC,
                              CASE WHEN :sortBy = 'STATUS' AND :sortDirection = 'ASC'
                                   THEN COALESCE((SELECT lst.status_key FROM lead_status lst WHERE lst.id = ar.lead_status_id), ulp.conversion_status) END ASC,
                              CASE WHEN :sortBy = 'STATUS' AND (:sortDirection IS NULL OR :sortDirection = 'DESC')
                                   THEN COALESCE((SELECT lst.status_key FROM lead_status lst WHERE lst.id = ar.lead_status_id), ulp.conversion_status) END DESC,
                              CASE WHEN :sortBy = 'PARENT_NAME' AND (:sortDirection IS NULL OR :sortDirection = 'ASC')
                                   THEN ar.parent_name END ASC,
                              CASE WHEN :sortBy = 'PARENT_NAME' AND :sortDirection = 'DESC'
                                   THEN ar.parent_name END DESC,
                              CASE WHEN :sortBy = 'CUSTOM_FIELD' AND :sortCustomFieldId IS NOT NULL AND :sortDirection = 'ASC'
                                   THEN CASE WHEN (SELECT scf.value FROM custom_field_values scf WHERE scf.source_type = 'AUDIENCE_RESPONSE' AND scf.source_id = ar.id AND scf.custom_field_id = :sortCustomFieldId ORDER BY scf.updated_at DESC NULLS LAST LIMIT 1) ~ '^-?[0-9]+([.][0-9]+)?$' THEN CAST((SELECT scf.value FROM custom_field_values scf WHERE scf.source_type = 'AUDIENCE_RESPONSE' AND scf.source_id = ar.id AND scf.custom_field_id = :sortCustomFieldId ORDER BY scf.updated_at DESC NULLS LAST LIMIT 1) AS numeric) END END ASC NULLS LAST,
                              CASE WHEN :sortBy = 'CUSTOM_FIELD' AND :sortCustomFieldId IS NOT NULL AND (:sortDirection IS NULL OR :sortDirection = 'DESC')
                                   THEN CASE WHEN (SELECT scf.value FROM custom_field_values scf WHERE scf.source_type = 'AUDIENCE_RESPONSE' AND scf.source_id = ar.id AND scf.custom_field_id = :sortCustomFieldId ORDER BY scf.updated_at DESC NULLS LAST LIMIT 1) ~ '^-?[0-9]+([.][0-9]+)?$' THEN CAST((SELECT scf.value FROM custom_field_values scf WHERE scf.source_type = 'AUDIENCE_RESPONSE' AND scf.source_id = ar.id AND scf.custom_field_id = :sortCustomFieldId ORDER BY scf.updated_at DESC NULLS LAST LIMIT 1) AS numeric) END END DESC NULLS LAST,
                              CASE WHEN :sortBy = 'CUSTOM_FIELD' AND :sortCustomFieldId IS NOT NULL AND :sortDirection = 'ASC'
                                   THEN (SELECT scf.value FROM custom_field_values scf WHERE scf.source_type = 'AUDIENCE_RESPONSE' AND scf.source_id = ar.id AND scf.custom_field_id = :sortCustomFieldId ORDER BY scf.updated_at DESC NULLS LAST LIMIT 1) END ASC NULLS LAST,
                              CASE WHEN :sortBy = 'CUSTOM_FIELD' AND :sortCustomFieldId IS NOT NULL AND (:sortDirection IS NULL OR :sortDirection = 'DESC')
                                   THEN (SELECT scf.value FROM custom_field_values scf WHERE scf.source_type = 'AUDIENCE_RESPONSE' AND scf.source_id = ar.id AND scf.custom_field_id = :sortCustomFieldId ORDER BY scf.updated_at DESC NULLS LAST LIMIT 1) END DESC NULLS LAST,
                              CASE WHEN :sortBy = 'LAST_ACTIVITY' AND :sortDirection = 'ASC'
                                   THEN act.last_activity_at END ASC NULLS LAST,
                              CASE WHEN :sortBy = 'LAST_ACTIVITY' AND (:sortDirection IS NULL OR :sortDirection = 'DESC')
                                   THEN act.last_activity_at END DESC NULLS LAST,
                              CASE WHEN :sortBy = 'LAST_CALLED' AND :sortDirection = 'ASC'
                                   THEN act.last_called_at END ASC NULLS LAST,
                              CASE WHEN :sortBy = 'LAST_CALLED' AND (:sortDirection IS NULL OR :sortDirection = 'DESC')
                                   THEN act.last_called_at END DESC NULLS LAST,
                              ar.submitted_at DESC
                        """, countQuery = """
                            SELECT COUNT(*)
                            FROM audience_response ar
                            JOIN audience a ON a.id = ar.audience_id
                            LEFT JOIN lead_score ls ON ls.audience_response_id = ar.id
                            LEFT JOIN LATERAL (
                                SELECT lu.user_id
                                FROM linked_users lu
                                WHERE lu.source = 'ENQUIRY' AND lu.source_id = ar.enquiry_id
                                ORDER BY lu.created_at DESC
                                LIMIT 1
                            ) lu ON true
                            LEFT JOIN user_lead_profile ulp
                                ON ulp.user_id = ar.user_id AND ulp.institute_id = a.institute_id
                            -- Last counsellor touch per lead, computed ONCE per row so the
                            -- "worked in the last 24h / 7d" windows and the Activity-column sort
                            -- below can both read it without re-running the correlated MAXes.
                            -- Each arm is its own index-backed subquery (idx_tcl_response,
                            -- idx_tcl_subject, idx_tcl_user, idx_timeline_event_type_type_id,
                            -- idx_timeline_student_recent) -- one subquery OR-ing the columns
                            -- together would seq-scan both logs per candidate lead.
                            -- GREATEST ignores NULL arms, so a lead with no call / no activity
                            -- keeps a NULL here and drops out of any window that is set.
                            LEFT JOIN LATERAL (
                                -- Each half is wrapped in a CASE that short-circuits to NULL when
                                -- neither the matching window NOR the matching sort is requested.
                                -- Without it these six correlated MAXes would run for every row of
                                -- EVERY leads-list call, including the overwhelming majority that
                                -- never touch these filters, and this is the hottest query in the CRM.
                                -- CASE does not evaluate the branch it does not take, so the
                                -- default path costs nothing.
                                SELECT CASE WHEN CAST(:calledFrom AS timestamp) IS NULL
                                             AND CAST(:calledTo AS timestamp) IS NULL
                                             AND COALESCE(:sortBy, '') <> 'LAST_CALLED'
                                            THEN NULL
                                            ELSE GREATEST(
                                                (SELECT MAX(tcl.created_at) FROM telephony_call_log tcl
                                                  WHERE tcl.response_id = ar.id),
                                                (SELECT MAX(tcl.created_at) FROM telephony_call_log tcl
                                                  WHERE tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD'),
                                                (SELECT MAX(tcl.created_at) FROM telephony_call_log tcl
                                                  WHERE tcl.user_id = ar.user_id
                                                    AND tcl.institute_id = a.institute_id))
                                       END AS last_called_at,
                                       CASE WHEN CAST(:activityFrom AS timestamp) IS NULL
                                             AND CAST(:activityTo AS timestamp) IS NULL
                                             AND COALESCE(:sortBy, '') <> 'LAST_ACTIVITY'
                                            THEN NULL
                                            ELSE GREATEST(
                                                (SELECT MAX(te.created_at) FROM timeline_event te
                                                  WHERE te.type = 'AUDIENCE_RESPONSE' AND te.type_id = ar.id),
                                                (SELECT MAX(te.created_at) FROM timeline_event te
                                                  WHERE te.student_user_id = ar.user_id),
                                                (SELECT MAX(te.created_at) FROM timeline_event te
                                                  WHERE te.student_user_id = ar.student_user_id))
                                       END AS last_activity_at
                            ) act ON true
                            WHERE a.institute_id = :instituteId
                              AND (COALESCE(:leadStatusId, '') = '' OR COALESCE((SELECT lst.status_key FROM lead_status lst WHERE lst.id = ar.lead_status_id), ulp.conversion_status) = ANY(STRING_TO_ARRAY(:leadStatusId, ',')) OR ('__NO_STATUS__' = ANY(STRING_TO_ARRAY(:leadStatusId, ',')) AND ar.lead_status_id IS NULL AND ulp.conversion_status IS NULL))
                              AND (COALESCE(:leadStatusExcludeId, '') = '' OR COALESCE((SELECT lst.status_key FROM lead_status lst WHERE lst.id = ar.lead_status_id), ulp.conversion_status) IS NULL OR NOT (COALESCE((SELECT lst.status_key FROM lead_status lst WHERE lst.id = ar.lead_status_id), ulp.conversion_status) = ANY(STRING_TO_ARRAY(:leadStatusExcludeId, ','))))
                              AND (COALESCE(:followUpPending, FALSE) = FALSE OR EXISTS (SELECT 1 FROM lead_followup lf WHERE lf.audience_response_id = ar.id AND lf.is_closed = FALSE AND lf.schedule_time IS NOT NULL AND (CAST(:followUpFrom AS timestamp) IS NULL OR lf.schedule_time >= CAST(:followUpFrom AS timestamp)) AND (CAST(:followUpTo AS timestamp) IS NULL OR lf.schedule_time < CAST(:followUpTo AS timestamp))))
                              AND (CAST(:submittedFrom AS timestamp) IS NULL OR ar.submitted_at >= CAST(:submittedFrom AS timestamp))
                              AND (CAST(:submittedTo AS timestamp) IS NULL OR ar.submitted_at <= CAST(:submittedTo AS timestamp))
                              -- "How many did I work / call in the last 24h / 7d" -- deliberately
                              -- INDEPENDENT of submitted_at, which answers when the lead arrived,
                              -- not when the counsellor last touched it. Two separate windows:
                              -- calls only (telephony_call_log) vs any activity (timeline_event).
                              -- act.* is NULL when the lead was never called / never touched, and
                              -- NULL fails every comparison, so those leads are excluded as soon
                              -- as either bound is set -- no COALESCE-to-epoch needed.
                              AND (CAST(:calledFrom AS timestamp) IS NULL OR act.last_called_at >= CAST(:calledFrom AS timestamp))
                              AND (CAST(:calledTo AS timestamp) IS NULL OR act.last_called_at <= CAST(:calledTo AS timestamp))
                              AND (CAST(:activityFrom AS timestamp) IS NULL OR act.last_activity_at >= CAST(:activityFrom AS timestamp))
                              AND (CAST(:activityTo AS timestamp) IS NULL OR act.last_activity_at <= CAST(:activityTo AS timestamp))
                              AND (COALESCE(:searchQuery, '') = '' OR
                                   LOWER(ar.parent_name) LIKE LOWER(CONCAT('%', :searchQuery, '%')) OR
                                   LOWER(ar.parent_email) LIKE LOWER(CONCAT('%', :searchQuery, '%')) OR
                                   ar.parent_mobile LIKE CONCAT('%', :searchQuery, '%') OR
                                   (COALESCE(:searchUserIdsCsv, '') != ''
                                    AND ar.user_id = ANY(STRING_TO_ARRAY(:searchUserIdsCsv, ','))))
                              AND (COALESCE(:leadTier, '') = '' OR
                                   (ulp.user_id IS NOT NULL AND COALESCE(NULLIF(ulp.lead_tier, ''),
                                       (SELECT lt.tier_key FROM lead_tier lt
                                         WHERE lt.institute_id = ulp.institute_id AND lt.is_active = TRUE
                                           AND lt.min_score IS NOT NULL AND ulp.best_score >= lt.min_score
                                         ORDER BY lt.min_score DESC, lt.display_order ASC LIMIT 1),
                                       CASE WHEN ulp.best_score >= 80 THEN 'HOT'
                                            WHEN ulp.best_score >= 50 THEN 'WARM'
                                            ELSE 'COLD' END) = ANY(STRING_TO_ARRAY(:leadTier, ','))))
                              AND (COALESCE(:assignedCounselorId, '') = ''
                                   OR lu.user_id = ANY(STRING_TO_ARRAY(:assignedCounselorId, ','))
                                   OR ulp.assigned_counselor_id = ANY(STRING_TO_ARRAY(:assignedCounselorId, ',')))
                              -- RBAC scope (CounsellorScopeService.descendantUserIdsForCaller):
                              -- caller + everyone reporting up to them through parent_user_id
                              -- chains inside the leads-team subtree. ANDed with the single-id
                              -- narrow above so a manager can still drill into one report.
                              -- Unassigned leads (no counsellor on either linked_users or
                              -- user_lead_profile) stay visible to everyone — anyone in
                              -- scope can pick them up.
                              AND (COALESCE(:assignedCounselorIdsCsv, '') = ''
                                   OR lu.user_id = ANY(STRING_TO_ARRAY(:assignedCounselorIdsCsv, ','))
                                   OR ulp.assigned_counselor_id = ANY(STRING_TO_ARRAY(:assignedCounselorIdsCsv, ','))
                                   OR ((:includeUnassigned IS NULL OR :includeUnassigned = TRUE) AND lu.user_id IS NULL AND ulp.assigned_counselor_id IS NULL))
                              -- isUnassigned = TRUE narrows to leads with no owner at all
                              -- (both the ENQUIRY-linked counsellor and the profile owner are null).
                              AND (:isUnassigned IS NULL OR :isUnassigned = FALSE
                                   OR (lu.user_id IS NULL AND ulp.assigned_counselor_id IS NULL))
                              AND (COALESCE(:allowedAudienceIdsCsv, '') = '' OR ar.audience_id = ANY(STRING_TO_ARRAY(:allowedAudienceIdsCsv, ',')))
                              -- Caller-requested audience multi-select (Recent Leads "All audiences"
                              -- dropdown). Independent of the RBAC :allowedAudienceIdsCsv above, which
                              -- stays ANDed so a user can never widen past what they were granted.
                              AND (COALESCE(:audienceIdsCsv, '') = '' OR ar.audience_id = ANY(STRING_TO_ARRAY(:audienceIdsCsv, ',')))
                              AND (
                                COALESCE(:conversionStatusFilter, 'EXCLUDE_CONVERTED') = 'ALL'
                                OR (
                                  COALESCE(:conversionStatusFilter, 'EXCLUDE_CONVERTED') = 'EXCLUDE_CONVERTED'
                                  AND (ulp.conversion_status IS NULL OR ulp.conversion_status != 'CONVERTED')
                                )
                                OR (
                                  :conversionStatusFilter = 'ONLY_CONVERTED'
                                  AND ulp.conversion_status = 'CONVERTED'
                                )
                              )
                              -- Soft-delete filter. Mirrors conversionStatusFilter above:
                              -- EXCLUDE_DELETED (default) / ONLY_DELETED / ALL, so the UI can
                              -- offer a "show deleted leads" view without a second query.
                              -- Kept as its OWN unconditional AND rather than folded into the
                              -- overall_status OR block above: that block disables its own
                              -- OPTED_OUT guard whenever :overallStatusStr is set, and a
                              -- soft-deleted lead must stay hidden regardless of what else the
                              -- caller filters by.
                              AND (
                                COALESCE(:audienceStatusFilter, 'EXCLUDE_DELETED') = 'ALL'
                                OR (
                                  COALESCE(:audienceStatusFilter, 'EXCLUDE_DELETED') = 'EXCLUDE_DELETED'
                                  AND ar.audience_status = 'ACTIVE'
                                )
                                OR (
                                  :audienceStatusFilter = 'ONLY_DELETED'
                                  AND ar.audience_status = 'INACTIVE'
                                )
                              )
                              AND (ar.overall_status IS NULL OR ar.overall_status != 'OPTED_OUT')
                              -- SLA-state filter. Aligned with the row-level badges + the new
                              -- column semantics:
                              --   * Reach-out buckets use submitted_at + tatMinutes AND a NOT EXISTS
                              --     check on timeline_event (any response event — see
                              --     findCounselorActionsByResponseIds) so leads already responded
                              --     to are excluded, matching the badge.
                              --   * Follow-up buckets read the lead_followup table (open rows
                              --     only), matching the Follow up at column which is now purely
                              --     counsellor-scheduled callbacks.
                              AND (COALESCE(:slaFilter, '') = ''
                                   OR ('TAT_OVERDUE' = ANY(STRING_TO_ARRAY(:slaFilter, ','))
                                       AND :tatMinutes IS NOT NULL
                                       AND ar.submitted_at IS NOT NULL
                                       AND ar.submitted_at + make_interval(mins => CAST(:tatMinutes AS integer)) < NOW()
                                       AND NOT EXISTS (
                                           SELECT 1 FROM timeline_event te
                                           WHERE (te.category = 'ACTIVITY' OR te.action_type = 'REACHOUT' OR (te.action_type IN ('STATUS_CHANGED','LEAD_CONVERTED','LEAD_LOST','COUNSELOR_ASSIGNED','COUNSELOR_UNASSIGNED','MANUAL_SCORE_UPDATE') AND te.actor_id IS NOT NULL))
                                             AND ( (te.type = 'AUDIENCE_RESPONSE' AND te.type_id = ar.id)
                                                   OR (ar.user_id IS NOT NULL AND te.student_user_id = ar.user_id)
                                                   OR (ar.student_user_id IS NOT NULL AND te.student_user_id = ar.student_user_id) )))
                                   OR ('TAT_BEFORE' = ANY(STRING_TO_ARRAY(:slaFilter, ','))
                                       AND :tatMinutes IS NOT NULL
                                       AND ar.submitted_at IS NOT NULL
                                       AND ar.submitted_at + make_interval(mins => CAST(:tatMinutes AS integer)) > NOW()
                                       AND ar.submitted_at + make_interval(mins => CAST(:tatMinutes AS integer)) <= NOW() + INTERVAL '30 minutes'
                                       AND NOT EXISTS (
                                           SELECT 1 FROM timeline_event te
                                           WHERE (te.category = 'ACTIVITY' OR te.action_type = 'REACHOUT' OR (te.action_type IN ('STATUS_CHANGED','LEAD_CONVERTED','LEAD_LOST','COUNSELOR_ASSIGNED','COUNSELOR_UNASSIGNED','MANUAL_SCORE_UPDATE') AND te.actor_id IS NOT NULL))
                                             AND ( (te.type = 'AUDIENCE_RESPONSE' AND te.type_id = ar.id)
                                                   OR (ar.user_id IS NOT NULL AND te.student_user_id = ar.user_id)
                                                   OR (ar.student_user_id IS NOT NULL AND te.student_user_id = ar.student_user_id) )))
                                   OR ('FOLLOW_UP_DUE' = ANY(STRING_TO_ARRAY(:slaFilter, ','))
                                       AND EXISTS (
                                           SELECT 1 FROM lead_followup lf
                                           WHERE lf.audience_response_id = ar.id
                                             AND lf.is_closed = false
                                             AND lf.schedule_time IS NOT NULL
                                             AND lf.schedule_time > NOW()
                                             AND lf.schedule_time <= NOW() + INTERVAL '30 minutes'))
                                   OR ('FOLLOW_UP_OVERDUE' = ANY(STRING_TO_ARRAY(:slaFilter, ','))
                                       AND EXISTS (
                                           SELECT 1 FROM lead_followup lf
                                           WHERE lf.audience_response_id = ar.id
                                             AND lf.is_closed = false
                                             AND lf.schedule_time IS NOT NULL
                                             AND lf.schedule_time < NOW()))
                                   OR ('ANY_OVERDUE' = ANY(STRING_TO_ARRAY(:slaFilter, ','))
                                       AND (
                                           (:tatMinutes IS NOT NULL
                                            AND ar.submitted_at IS NOT NULL
                                            AND ar.submitted_at + make_interval(mins => CAST(:tatMinutes AS integer)) < NOW()
                                            AND NOT EXISTS (
                                                SELECT 1 FROM timeline_event te
                                                WHERE (te.category = 'ACTIVITY' OR te.action_type = 'REACHOUT' OR (te.action_type IN ('STATUS_CHANGED','LEAD_CONVERTED','LEAD_LOST','COUNSELOR_ASSIGNED','COUNSELOR_UNASSIGNED','MANUAL_SCORE_UPDATE') AND te.actor_id IS NOT NULL))
                                                  AND ( (te.type = 'AUDIENCE_RESPONSE' AND te.type_id = ar.id)
                                                        OR (ar.user_id IS NOT NULL AND te.student_user_id = ar.user_id)
                                                        OR (ar.student_user_id IS NOT NULL AND te.student_user_id = ar.student_user_id) )))
                                           OR EXISTS (
                                               SELECT 1 FROM lead_followup lf
                                               WHERE lf.audience_response_id = ar.id
                                                 AND lf.is_closed = false
                                                 AND lf.schedule_time IS NOT NULL
                                                 AND lf.schedule_time < NOW()))))
                              AND (COALESCE(:customFieldMatchedIdsCsv, '') = ''
                                   OR ar.id = ANY(STRING_TO_ARRAY(:customFieldMatchedIdsCsv, ',')))
                              AND (COALESCE(:customFieldExcludedIdsCsv, '') = ''
                                   OR NOT (ar.id = ANY(STRING_TO_ARRAY(:customFieldExcludedIdsCsv, ','))))
                              -- NOTE never put a semicolon anywhere in this query's comments --
                              -- Hibernate's limit handler treats the first semicolon as end of
                              -- statement and injects "fetch first ? rows only" there, which
                              -- desyncs JDBC parameter binding (column index out of range).
                              -- Call-history matching. A call log links to a lead THREE ways:
                              -- response_id (manual dialer + CDR import), subject_id+LEAD (AI
                              -- campaigns), or just user_id (about a quarter of Airtel CDR rows
                              -- have no response link, while the lead side-panel lists calls by
                              -- user_id + institute, so the filter must match the same or called
                              -- leads land in NOT_CALLED).
                              -- Keep each column in its OWN EXISTS block: one EXISTS with an OR
                              -- across columns defeats every index and seq-scans the whole call
                              -- log per candidate lead (statement timeout).
                              AND (COALESCE(:callHistoryFilter, '') = ''
                                   OR (:callHistoryFilter = 'NOT_CALLED'
                                       AND NOT EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.response_id = ar.id)
                                       AND NOT EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD')
                                       AND NOT EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.user_id = ar.user_id
                                                AND tcl.institute_id = a.institute_id))
                                   OR (:callHistoryFilter = 'CALLED'
                                       AND (EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.response_id = ar.id)
                                         OR EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD')
                                         OR EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.user_id = ar.user_id
                                                AND tcl.institute_id = a.institute_id)))
                                   OR (:callHistoryFilter = 'CALLED_ONCE' AND (
                                         SELECT COUNT(*) FROM telephony_call_log tcl
                                          WHERE tcl.response_id = ar.id
                                             OR (tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD')
                                             OR (tcl.user_id = ar.user_id
                                                 AND tcl.institute_id = a.institute_id)) = 1)
                                   OR (:callHistoryFilter = 'CALLED_TWICE_PLUS' AND (
                                         SELECT COUNT(*) FROM telephony_call_log tcl
                                          WHERE tcl.response_id = ar.id
                                             OR (tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD')
                                             OR (tcl.user_id = ar.user_id
                                                 AND tcl.institute_id = a.institute_id)) >= 2)
                                   -- Arbitrary-N variants of the two options above: "called
                                   -- exactly N times" and "called N or more times". N comes from
                                   -- :callCountValue, floored at 1 so a missing/zero value
                                   -- degrades to the CALLED_ONCE / CALLED semantics rather than
                                   -- matching nothing.
                                   OR (:callHistoryFilter = 'CALLED_N_TIMES' AND (
                                         SELECT COUNT(*) FROM telephony_call_log tcl
                                          WHERE tcl.response_id = ar.id
                                             OR (tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD')
                                             OR (tcl.user_id = ar.user_id
                                                 AND tcl.institute_id = a.institute_id))
                                       = GREATEST(COALESCE(CAST(:callCountValue AS integer), 1), 1))
                                   OR (:callHistoryFilter = 'CALLED_N_PLUS_TIMES' AND (
                                         SELECT COUNT(*) FROM telephony_call_log tcl
                                          WHERE tcl.response_id = ar.id
                                             OR (tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD')
                                             OR (tcl.user_id = ar.user_id
                                                 AND tcl.institute_id = a.institute_id))
                                       >= GREATEST(COALESCE(CAST(:callCountValue AS integer), 1), 1))
                                   OR (:callHistoryFilter = 'AI_CALLED'
                                       AND (EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.response_id = ar.id
                                                AND tcl.provider_type IN ('VACADEMY_AI', 'AAVTAAR'))
                                         OR EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD'
                                                AND tcl.provider_type IN ('VACADEMY_AI', 'AAVTAAR'))
                                         OR EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.user_id = ar.user_id
                                                AND tcl.institute_id = a.institute_id
                                                AND tcl.provider_type IN ('VACADEMY_AI', 'AAVTAAR'))))
                                   OR (:callHistoryFilter = 'MANUAL_CALLED'
                                       AND (EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.response_id = ar.id
                                                AND tcl.provider_type NOT IN ('VACADEMY_AI', 'AAVTAAR', 'MOCK'))
                                         OR EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.subject_id = ar.id AND tcl.subject_type = 'LEAD'
                                                AND tcl.provider_type NOT IN ('VACADEMY_AI', 'AAVTAAR', 'MOCK'))
                                         OR EXISTS (
                                             SELECT 1 FROM telephony_call_log tcl
                                              WHERE tcl.user_id = ar.user_id
                                                AND tcl.institute_id = a.institute_id
                                                AND tcl.provider_type NOT IN ('VACADEMY_AI', 'AAVTAAR', 'MOCK')))))
                        """, nativeQuery = true)
        Page<AudienceResponse> findInstituteLeadsWithFilters(
                        @Param("instituteId") String instituteId,
                        @Param("leadStatusId") String leadStatusId,
                        @Param("leadStatusExcludeId") String leadStatusExcludeId,
                        @Param("followUpPending") Boolean followUpPending,
                        @Param("followUpFrom") Timestamp followUpFrom,
                        @Param("followUpTo") Timestamp followUpTo,
                        @Param("submittedFrom") Timestamp submittedFrom,
                        @Param("submittedTo") Timestamp submittedTo,
                        @Param("searchQuery") String searchQuery,
                        @Param("searchUserIdsCsv") String searchUserIdsCsv,
                        @Param("leadTier") String leadTier,
                        @Param("assignedCounselorId") String assignedCounselorId,
                        @Param("assignedCounselorIdsCsv") String assignedCounselorIdsCsv,
                        @Param("includeUnassigned") Boolean includeUnassigned,
                        @Param("isUnassigned") Boolean isUnassigned,
                        @Param("allowedAudienceIdsCsv") String allowedAudienceIdsCsv,
                        @Param("audienceIdsCsv") String audienceIdsCsv,
                        @Param("conversionStatusFilter") String conversionStatusFilter,
                        @Param("audienceStatusFilter") String audienceStatusFilter,
                        @Param("slaFilter") String slaFilter,
                        @Param("tatMinutes") Integer tatMinutes,
                        @Param("customFieldMatchedIdsCsv") String customFieldMatchedIdsCsv,
                        @Param("customFieldExcludedIdsCsv") String customFieldExcludedIdsCsv,
                        @Param("callHistoryFilter") String callHistoryFilter,
                        @Param("callCountValue") Integer callCountValue,
                        @Param("sortBy") String sortBy,
                        @Param("sortDirection") String sortDirection,
                        @Param("sortCustomFieldId") String sortCustomFieldId,
                        @Param("calledFrom") Timestamp calledFrom,
                        @Param("calledTo") Timestamp calledTo,
                        @Param("activityFrom") Timestamp activityFrom,
                        @Param("activityTo") Timestamp activityTo,
                        Pageable pageable);

        /**
         * Distinct values a custom field holds across an institute's leads —
         * powers the searchable, paginated multi-select dropdowns in the leads
         * filter bar. Scoped to the institute via custom_field_values →
         * audience_response → audience; backed by idx_cfv_field_source_value.
         * `:search` is a case-insensitive substring (blank = all values).
         * JSON-array answers (MULTI_SELECT) are split into one value per option;
         * the filter side matches them via CustomFieldValueSql.matchesAnyOf.
         */
        @Query(value = """
                            SELECT DISTINCT opt.v
                            FROM custom_field_values cfv
                            JOIN audience_response ar ON ar.id = cfv.source_id
                            JOIN audience a ON a.id = ar.audience_id
                            CROSS JOIN LATERAL jsonb_array_elements_text(
                                CASE WHEN cfv.value LIKE '[%' AND pg_input_is_valid(cfv.value, 'jsonb')
                                     THEN CAST(cfv.value AS jsonb)
                                     ELSE jsonb_build_array(cfv.value) END) AS opt(v)
                            WHERE cfv.source_type = 'AUDIENCE_RESPONSE'
                              AND a.institute_id = :instituteId
                              AND cfv.custom_field_id = :customFieldId
                              AND cfv.value IS NOT NULL
                              AND cfv.value <> ''
                              AND opt.v <> ''
                              AND (COALESCE(:search, '') = '' OR opt.v ILIKE CONCAT('%', :search, '%'))
                            ORDER BY opt.v ASC
                        """, countQuery = """
                            SELECT COUNT(DISTINCT opt.v)
                            FROM custom_field_values cfv
                            JOIN audience_response ar ON ar.id = cfv.source_id
                            JOIN audience a ON a.id = ar.audience_id
                            CROSS JOIN LATERAL jsonb_array_elements_text(
                                CASE WHEN cfv.value LIKE '[%' AND pg_input_is_valid(cfv.value, 'jsonb')
                                     THEN CAST(cfv.value AS jsonb)
                                     ELSE jsonb_build_array(cfv.value) END) AS opt(v)
                            WHERE cfv.source_type = 'AUDIENCE_RESPONSE'
                              AND a.institute_id = :instituteId
                              AND cfv.custom_field_id = :customFieldId
                              AND cfv.value IS NOT NULL
                              AND cfv.value <> ''
                              AND opt.v <> ''
                              AND (COALESCE(:search, '') = '' OR opt.v ILIKE CONCAT('%', :search, '%'))
                        """, nativeQuery = true)
        Page<String> findDistinctLeadCustomFieldValues(
                        @Param("instituteId") String instituteId,
                        @Param("customFieldId") String customFieldId,
                        @Param("search") String search,
                        Pageable pageable);

        /**
         * Count total leads for a campaign
         */
        Long countByAudienceId(String audienceId);

        /**
         * Most recent response for an audience — used by the connector health
         * check as a "leads are actually arriving" heartbeat.
         */
        Optional<AudienceResponse> findTopByAudienceIdOrderBySubmittedAtDesc(String audienceId);

        /**
         * Count converted leads for a campaign
         */
        @Query("SELECT COUNT(ar) FROM AudienceResponse ar WHERE ar.audienceId = :audienceId AND ar.userId IS NOT NULL AND (ar.overallStatus IS NULL OR ar.overallStatus != 'OPTED_OUT')")
        Long countConvertedLeads(@Param("audienceId") String audienceId);

        /**
         * Count leads by source type
         */
        Long countByAudienceIdAndSourceType(String audienceId, String sourceType);

        /**
         * Check if a user has already submitted a response for this audience
         */
        boolean existsByAudienceIdAndUserId(String audienceId, String userId);

        /**
         * This person's leads in this campaign with the given audience_status. Backs
         * reactivate-on-resubmit: {@link #existsByAudienceIdAndUserId} above is derived and so
         * cannot see status, which is exactly why a soft-deleted lead would otherwise trip the
         * duplicate guard forever and never come back.
         */
        List<AudienceResponse> findByAudienceIdAndUserIdAndAudienceStatus(
                        String audienceId, String userId, String audienceStatus);

        /**
         * Check if a child (student) has already been submitted for this audience campaign.
         * Used for parent+child flows where the same parent can submit for multiple children.
         */
        boolean existsByAudienceIdAndStudentUserId(String audienceId, String studentUserId);

        /**
         * Find all audience responses for a specific user
         */
        List<AudienceResponse> findByUserId(String userId);

        /**
         * Find all audience responses where user is parent OR student
         * Used for fetching all applications related to a parent/child
         */
        List<AudienceResponse> findByUserIdOrStudentUserId(String userId, String studentUserId);

        /**
         * Every lead this person holds within one institute, as either the submitter
         * or the child the submission was for, whatever its audience_status.
         *
         * <p>Institute-scoped through the audience join: a person can be a lead in
         * several institutes, and an admin of one must not see the others' campaigns.
         */
        @Query("""
                            SELECT ar FROM AudienceResponse ar
                            JOIN Audience a ON a.id = ar.audienceId
                            WHERE a.instituteId = :instituteId
                            AND (ar.userId = :userId OR ar.studentUserId = :userId)
                        """)
        List<AudienceResponse> findAllByInstituteAndUserOrStudent(
                        @Param("instituteId") String instituteId,
                        @Param("userId") String userId);

        /**
         * These specific leads, but ONLY the ones that belong to this institute.
         *
         * <p>Security boundary for delete/restore: the caller supplies both the response ids and
         * the institute the ADMIN check is made against, so those two MUST be reconciled against
         * the data — otherwise an admin of institute A can pass their own institute_id (clearing
         * the role check) together with institute B's response ids and mutate another tenant's
         * leads. Resolving the targets through the institute join makes that impossible by
         * construction rather than by a follow-up check someone can forget.</p>
         *
         * <p>The join is INNER, matching the leads-list queries: a response with no audience
         * (admission/application rows) can't be attributed to an institute here and isn't listable
         * either, so it is correctly not deletable through this endpoint.</p>
         *
         * <p>Does not filter audience_status — delete needs the ACTIVE rows and restore needs the
         * INACTIVE ones.</p>
         */
        @Query("""
                            SELECT ar FROM AudienceResponse ar
                            JOIN Audience a ON a.id = ar.audienceId
                            WHERE a.instituteId = :instituteId
                            AND ar.id IN :responseIds
                        """)
        List<AudienceResponse> findAllByInstituteAndIds(
                        @Param("instituteId") String instituteId,
                        @Param("responseIds") List<String> responseIds);

        /**
         * Every lead belonging to these users within one institute, whatever its
         * audience_status. Backs the USER-scoped soft-delete ("remove the person
         * entirely") and its restore counterpart, so it must NOT filter on
         * audience_status: delete needs the ACTIVE rows, restore needs the INACTIVE ones.
         */
        @Query("""
                            SELECT ar FROM AudienceResponse ar
                            JOIN Audience a ON a.id = ar.audienceId
                            WHERE a.instituteId = :instituteId
                            AND ar.userId IN :userIds
                        """)
        List<AudienceResponse> findAllByInstituteAndUserIds(
                        @Param("instituteId") String instituteId,
                        @Param("userIds") List<String> userIds);

        /**
         * The newest ACTIVE lead row for one person inside one institute, as either
         * the submitter or the child the submission was for.
         *
         * <p>Used by click-to-call from the LMS surfaces (students list / attendance /
         * assessment side-view), where the frontend only knows a learner's user id.
         * A learner who ALSO came through a form gets their call filed on the same
         * lead — same call history, same timeline, disposition still works. A learner
         * with no lead row simply yields nothing and the call is logged against the
         * user alone.
         *
         * <p>Institute-scoped through the audience join for the same reason
         * {@link #findAllByInstituteAndIds} is: a user id alone can't be allowed to
         * reach another tenant's lead. Paged so the LIMIT 1 stays in SQL.
         */
        @Query("""
                            SELECT ar.id FROM AudienceResponse ar
                            JOIN Audience a ON a.id = ar.audienceId
                            WHERE a.instituteId = :instituteId
                            AND (ar.userId = :userId OR ar.studentUserId = :userId)
                            AND ar.audienceStatus = 'ACTIVE'
                            ORDER BY ar.createdAt DESC
                        """)
        List<String> findLatestResponseIdForUserInInstitute(
                        @Param("instituteId") String instituteId,
                        @Param("userId") String userId,
                        org.springframework.data.domain.Pageable pageable);

        /**
         * Find audience response by parent mobile number for pre-fill lookup
         */
        Optional<AudienceResponse> findFirstByParentMobileOrderByCreatedAtDesc(String parentMobile);

        /**
         * Find all audience responses by parent mobile
         */
        List<AudienceResponse> findByParentMobile(String parentMobile);

        /**
         * Find audience responses by parent name containing (ignore case)
         */
        List<AudienceResponse> findByParentNameContainingIgnoreCase(String parentName);


        /**
         * Find audience response by applicant ID
         */
        Optional<AudienceResponse> findByApplicantId(String applicantId);

        /**
         * Find all distinct user IDs from audience responses for given audience IDs
         */
        @Query("SELECT DISTINCT ar.userId FROM AudienceResponse ar " +
                        "WHERE ar.audienceId IN :audienceIds AND ar.userId IS NOT NULL " +
                        "AND (ar.overallStatus IS NULL OR ar.overallStatus != 'OPTED_OUT') AND ar.audienceStatus = 'ACTIVE'")
        List<String> findDistinctUserIdsByAudienceIds(@Param("audienceIds") List<String> audienceIds);

        /**
         * Find all audience response IDs for given user IDs
         */
        @Query("SELECT ar.id FROM AudienceResponse ar WHERE ar.userId IN :userIds AND ar.userId IS NOT NULL")
        List<String> findResponseIdsByUserIds(@Param("userIds") List<String> userIds);

        /**
         * Find all distinct user IDs from audience responses for given audience IDs and
         * user IDs
         * Used for filtering audience respondents by specific audiences
         */
        @Query("SELECT DISTINCT ar.userId FROM AudienceResponse ar " +
                        "WHERE ar.audienceId IN :audienceIds AND ar.userId IN :userIds AND ar.userId IS NOT NULL " +
                        "AND (ar.overallStatus IS NULL OR ar.overallStatus != 'OPTED_OUT') AND ar.audienceStatus = 'ACTIVE'")
        List<String> findDistinctUserIdsByAudienceIdsAndUserIds(
                        @Param("audienceIds") List<String> audienceIds,
                        @Param("userIds") List<String> userIds);

        @Query("""
                            SELECT ar FROM AudienceResponse ar
                            JOIN Audience a ON a.id = ar.audienceId
                            WHERE a.instituteId = :instituteId
                            AND ar.audienceId = :audienceId
                            AND ar.workflowActivateDayAt >= :startDate AND ar.workflowActivateDayAt <= :endDate
                            AND (ar.overallStatus IS NULL OR ar.overallStatus != 'OPTED_OUT')
                            AND ar.audienceStatus = 'ACTIVE'
                        """)
        List<AudienceResponse> findLeadsByAudienceAndDateRange(
                        @Param("instituteId") String instituteId,
                        @Param("audienceId") String audienceId,
                        @Param("startDate") Timestamp startDate,
                        @Param("endDate") Timestamp endDate);

        /**
         * Same as {@link #findLeadsByAudienceAndDateRange} but additionally narrowed to a
         * single conversion_status. Used by the opt-out drip so the day-0 MSG1 workflow can
         * target only INACTIVE entries (conversion_status = 'OPT_OUT_INACTIVE') without also
         * re-sending to EXPLICIT opt-outs whose anchor day collides.
         */
        @Query("""
                            SELECT ar FROM AudienceResponse ar
                            JOIN Audience a ON a.id = ar.audienceId
                            WHERE a.instituteId = :instituteId
                            AND ar.audienceId = :audienceId
                            AND ar.workflowActivateDayAt >= :startDate AND ar.workflowActivateDayAt <= :endDate
                            AND ar.conversionStatus = :conversionStatus
                            AND (ar.overallStatus IS NULL OR ar.overallStatus != 'OPTED_OUT')
                            AND ar.audienceStatus = 'ACTIVE'
                        """)
        List<AudienceResponse> findLeadsByAudienceDateRangeAndConversionStatus(
                        @Param("instituteId") String instituteId,
                        @Param("audienceId") String audienceId,
                        @Param("startDate") Timestamp startDate,
                        @Param("endDate") Timestamp endDate,
                        @Param("conversionStatus") String conversionStatus);

        /**
         * All active (non opted-out) leads that have both a user_id and a parent_mobile,
         * across the given audiences. Used by the inactivity scan to enumerate Js Challenge
         * participants before cross-checking which have gone silent.
         */
        @Query("""
                            SELECT ar FROM AudienceResponse ar
                            WHERE ar.audienceId IN :audienceIds
                            AND ar.userId IS NOT NULL
                            AND ar.parentMobile IS NOT NULL
                            AND (ar.overallStatus IS NULL OR ar.overallStatus != 'OPTED_OUT')
                            AND ar.audienceStatus = 'ACTIVE'
                        """)
        List<AudienceResponse> findActiveLeadsByAudienceIds(
                        @Param("audienceIds") List<String> audienceIds);

        /**
         * Find all audience responses for an institute within a date range,
         * across all audiences. Used for scheduled follow-ups when no specific
         * audienceId is configured.
         */
        @Query("""
                            SELECT ar FROM AudienceResponse ar
                            JOIN Audience a ON a.id = ar.audienceId
                            WHERE a.instituteId = :instituteId
                            AND ar.workflowActivateDayAt >= :startDate AND ar.workflowActivateDayAt <= :endDate
                            AND (ar.overallStatus IS NULL OR ar.overallStatus != 'OPTED_OUT')
                            AND ar.audienceStatus = 'ACTIVE'
                        """)
        List<AudienceResponse> findLeadsByInstituteAndDateRange(
                        @Param("instituteId") String instituteId,
                        @Param("startDate") Timestamp startDate,
                        @Param("endDate") Timestamp endDate);

        Optional<AudienceResponse> findFirstByStudentUserIdAndApplicantIdIsNotNull(String studentUserId);

        /**
         * Find the most recent audience_response for a user in an institute
         * that has not yet been opted out and is not itself an opt-out entry.
         * Used to soft-delete the previous membership when the user opts out.
         */
        @Query(value = """
                            SELECT ar.*
                            FROM audience_response ar
                            JOIN audience a ON a.id = ar.audience_id
                            WHERE a.institute_id = :instituteId
                              AND ar.user_id = :userId
                              AND (ar.overall_status IS NULL OR ar.overall_status != 'OPTED_OUT')
                              AND (ar.source_type IS NULL OR ar.source_type != 'OPT_OUT')
                            ORDER BY ar.submitted_at DESC
                            LIMIT 1
                        """, nativeQuery = true)
        Optional<AudienceResponse> findMostRecentActiveResponseForUser(
                        @Param("userId") String userId,
                        @Param("instituteId") String instituteId);

        /**
         * Find audience responses by parent mobile scoped to a specific institute
         */
        @Query("""
                            SELECT ar FROM AudienceResponse ar
                            JOIN Audience a ON a.id = ar.audienceId
                            WHERE a.instituteId = :instituteId
                            AND ar.parentMobile LIKE CONCAT('%', :phone, '%')
                            ORDER BY ar.submittedAt DESC
                        """)
        List<AudienceResponse> findByInstituteIdAndParentMobile(
                        @Param("instituteId") String instituteId,
                        @Param("phone") String phone);

        /**
         * Find audience responses by parent name (partial, case-insensitive) scoped to a specific institute
         */
        @Query("""
                            SELECT ar FROM AudienceResponse ar
                            JOIN Audience a ON a.id = ar.audienceId
                            WHERE a.instituteId = :instituteId
                            AND LOWER(ar.parentName) LIKE LOWER(CONCAT('%', :name, '%'))
                            ORDER BY ar.submittedAt DESC
                        """)
        List<AudienceResponse> findByInstituteIdAndParentNameContainingIgnoreCase(
                        @Param("instituteId") String instituteId,
                        @Param("name") String name);

        /**
         * Find audience response by enquiry ID scoped to a specific institute
         */
        @Query("""
                            SELECT ar FROM AudienceResponse ar
                            JOIN Audience a ON a.id = ar.audienceId
                            WHERE a.instituteId = :instituteId
                            AND ar.enquiryId = :enquiryId
                        """)
        Optional<AudienceResponse> findByInstituteIdAndEnquiryId(
                        @Param("instituteId") String instituteId,
                        @Param("enquiryId") String enquiryId);

        /**
         * Find a non-duplicate response by audience ID and dedupe key.
         * Used for within-campaign deduplication.
         */
        Optional<AudienceResponse> findFirstByAudienceIdAndDedupeKeyAndIsDuplicateFalse(
                        String audienceId, String dedupeKey);

        /**
         * Alias for dedup service compatibility.
         */
        default Optional<AudienceResponse> findByAudienceIdAndDedupeKey(String audienceId, String dedupeKey) {
                return findFirstByAudienceIdAndDedupeKeyAndIsDuplicateFalse(audienceId, dedupeKey);
        }

        /**
         * Institute-level lead-uniqueness setting support (LEAD_SETTING.data.dedup).
         * All six exclude opted-out and already-flagged-duplicate rows so a lead that
         * opted out can re-enter, and duplicates don't chain-match. excludeResponseId
         * lets an in-place lead edit (updateLeadProfile) check "does this new value
         * collide with some OTHER lead" without matching its own not-yet-saved row —
         * pass null from creation-flow callers, where there is no self to exclude.
         */
        @Query("""
                            SELECT COUNT(ar) > 0 FROM AudienceResponse ar
                            WHERE ar.audienceId = :audienceId
                            AND LOWER(TRIM(ar.parentEmail)) = LOWER(TRIM(:email))
                            AND (ar.isDuplicate IS NULL OR ar.isDuplicate = false)
                            AND (ar.overallStatus IS NULL OR ar.overallStatus != 'OPTED_OUT')
                            AND (:excludeResponseId IS NULL OR ar.id <> :excludeResponseId)
                        """)
        boolean existsByAudienceIdAndParentEmailIgnoreCase(
                        @Param("audienceId") String audienceId,
                        @Param("email") String email,
                        @Param("excludeResponseId") String excludeResponseId);

        @Query("""
                            SELECT COUNT(ar) > 0 FROM AudienceResponse ar
                            JOIN Audience a ON a.id = ar.audienceId
                            WHERE a.instituteId = :instituteId
                            AND LOWER(TRIM(ar.parentEmail)) = LOWER(TRIM(:email))
                            AND (ar.isDuplicate IS NULL OR ar.isDuplicate = false)
                            AND (ar.overallStatus IS NULL OR ar.overallStatus != 'OPTED_OUT')
                            AND (:excludeResponseId IS NULL OR ar.id <> :excludeResponseId)
                        """)
        boolean existsByInstituteIdAndParentEmailIgnoreCase(
                        @Param("instituteId") String instituteId,
                        @Param("email") String email,
                        @Param("excludeResponseId") String excludeResponseId);

        @Query(value = """
                            SELECT COUNT(*) > 0 FROM audience_response ar
                            WHERE ar.audience_id = :audienceId
                            AND ar.parent_mobile IS NOT NULL
                            AND RIGHT(regexp_replace(ar.parent_mobile, '[^0-9]', '', 'g'), 10) = :last10
                            AND (ar.is_duplicate IS NULL OR ar.is_duplicate = false)
                            AND (ar.overall_status IS NULL OR ar.overall_status != 'OPTED_OUT')
                            AND (COALESCE(:excludeResponseId, '') = '' OR ar.id <> :excludeResponseId)
                        """, nativeQuery = true)
        boolean existsByAudienceIdAndPhoneLast10(
                        @Param("audienceId") String audienceId,
                        @Param("last10") String last10,
                        @Param("excludeResponseId") String excludeResponseId);

        @Query(value = """
                            SELECT COUNT(*) > 0 FROM audience_response ar
                            JOIN audience a ON a.id = ar.audience_id
                            WHERE a.institute_id = :instituteId
                            AND ar.parent_mobile IS NOT NULL
                            AND RIGHT(regexp_replace(ar.parent_mobile, '[^0-9]', '', 'g'), 10) = :last10
                            AND (ar.is_duplicate IS NULL OR ar.is_duplicate = false)
                            AND (ar.overall_status IS NULL OR ar.overall_status != 'OPTED_OUT')
                            AND (COALESCE(:excludeResponseId, '') = '' OR ar.id <> :excludeResponseId)
                        """, nativeQuery = true)
        boolean existsByInstituteIdAndPhoneLast10(
                        @Param("instituteId") String instituteId,
                        @Param("last10") String last10,
                        @Param("excludeResponseId") String excludeResponseId);

        /**
         * SELECTED-scope variant of the two above — dedup checked across an
         * admin-chosen set of specific lead lists rather than one campaign or the
         * whole institute.
         */
        @Query("""
                            SELECT COUNT(ar) > 0 FROM AudienceResponse ar
                            WHERE ar.audienceId IN (:audienceIds)
                            AND LOWER(TRIM(ar.parentEmail)) = LOWER(TRIM(:email))
                            AND (ar.isDuplicate IS NULL OR ar.isDuplicate = false)
                            AND (ar.overallStatus IS NULL OR ar.overallStatus != 'OPTED_OUT')
                            AND (:excludeResponseId IS NULL OR ar.id <> :excludeResponseId)
                        """)
        boolean existsByAudienceIdInAndParentEmailIgnoreCase(
                        @Param("audienceIds") java.util.List<String> audienceIds,
                        @Param("email") String email,
                        @Param("excludeResponseId") String excludeResponseId);

        @Query(value = """
                            SELECT COUNT(*) > 0 FROM audience_response ar
                            WHERE ar.audience_id IN (:audienceIds)
                            AND ar.parent_mobile IS NOT NULL
                            AND RIGHT(regexp_replace(ar.parent_mobile, '[^0-9]', '', 'g'), 10) = :last10
                            AND (ar.is_duplicate IS NULL OR ar.is_duplicate = false)
                            AND (ar.overall_status IS NULL OR ar.overall_status != 'OPTED_OUT')
                            AND (COALESCE(:excludeResponseId, '') = '' OR ar.id <> :excludeResponseId)
                        """, nativeQuery = true)
        boolean existsByAudienceIdInAndPhoneLast10(
                        @Param("audienceIds") java.util.List<String> audienceIds,
                        @Param("last10") String last10,
                        @Param("excludeResponseId") String excludeResponseId);

        // ── TAT / Follow-up SLA scan (emit-only scheduler) ────────────────────────

        /**
         * Distinct institute IDs that currently have at least one open, non-opted-out lead.
         * The scheduler iterates these and reads each institute's LEAD_SETTING to decide
         * whether TAT / follow-up reminders are enabled before scanning its leads.
         */
        @Query(value = """
                            SELECT DISTINCT a.institute_id
                            FROM audience_response ar
                            JOIN audience a ON a.id = ar.audience_id
                            WHERE (ar.overall_status IS NULL OR ar.overall_status != 'OPTED_OUT')
                            AND ar.audience_status = 'ACTIVE'
                        """, nativeQuery = true)
        List<String> findInstituteIdsWithActiveLeads();

        /**
         * All open, assigned, unconverted leads for an institute, with the resolved counselor and the
         * timestamp of the last response event on the lead (the RESPONSE EVENT definition on
         * {@link #findCounselorActionsByResponseIds}; null = never responded, i.e. still on the TAT
         * clock — the column keeps its historical name). The scheduler decides which SLA stage
         * (TAT before/overdue, follow-up due/overdue) to emit per row in Java. Mirrors the counselor
         * resolution of {@link #findLeadsWithFilters} (linked_users first, then user_lead_profile).
         */
        @Query(value = """
                            SELECT ar.id AS leadId,
                                   ar.user_id AS userId,
                                   ar.student_user_id AS studentUserId,
                                   ar.enquiry_id AS enquiryId,
                                   ar.audience_id AS audienceId,
                                   a.campaign_name AS campaignName,
                                   a.institute_id AS instituteId,
                                   ar.parent_name AS parentName,
                                   ar.parent_email AS parentEmail,
                                   ar.parent_mobile AS parentMobile,
                                   ar.submitted_at AS submittedAt,
                                   COALESCE(lu.user_id, ulp.assigned_counselor_id) AS counselorId,
                                   ar.tat_reminder_stage AS tatReminderStage,
                                   ar.tat_reminder_count AS tatReminderCount,
                                   ar.tat_reminder_assignee_id AS tatReminderAssigneeId,
                                   (SELECT MAX(te.created_at) FROM timeline_event te
                                      WHERE (te.category = 'ACTIVITY' OR te.action_type = 'REACHOUT' OR (te.action_type IN ('STATUS_CHANGED','LEAD_CONVERTED','LEAD_LOST','COUNSELOR_ASSIGNED','COUNSELOR_UNASSIGNED','MANUAL_SCORE_UPDATE') AND te.actor_id IS NOT NULL))
                                        AND ( (te.type = 'AUDIENCE_RESPONSE' AND te.type_id = ar.id)
                                              OR (ar.user_id IS NOT NULL AND te.student_user_id = ar.user_id)
                                              OR (ar.student_user_id IS NOT NULL AND te.student_user_id = ar.student_user_id) )
                                   ) AS lastCounselorActionAt
                            FROM audience_response ar
                            JOIN audience a ON a.id = ar.audience_id
                            LEFT JOIN LATERAL (
                                SELECT lu.user_id
                                FROM linked_users lu
                                WHERE lu.source = 'ENQUIRY' AND lu.source_id = ar.enquiry_id
                                ORDER BY lu.created_at DESC
                                LIMIT 1
                            ) lu ON true
                            LEFT JOIN user_lead_profile ulp
                                ON ulp.user_id = ar.user_id AND ulp.institute_id = a.institute_id
                            WHERE a.institute_id = :instituteId
                              AND (ar.overall_status IS NULL OR ar.overall_status != 'OPTED_OUT')
                              AND ar.audience_status = 'ACTIVE'
                              AND (ulp.conversion_status IS NULL OR ulp.conversion_status != 'CONVERTED')
                              AND COALESCE(lu.user_id, ulp.assigned_counselor_id) IS NOT NULL
                        """, nativeQuery = true)
        List<LeadSlaCandidate> findSlaCandidatesForInstitute(@Param("instituteId") String instituteId);

        /**
         * For a set of leads, the timestamps of the FIRST and LAST response events on each lead
         * (from timeline_event). Drives:
         *   firstActionAt → "Responded in N" (time-to-first-response shown in the leads tables).
         *   lastActionAt  → follow-up deadline (= lastActionAt + followUpSlaMinutes).
         * Leads with no response event return both timestamps as null.
         *
         * <p>RESPONSE EVENT — the one definition every TAT query in this file shares (the leads
         * list badge, the slaFilter buckets, the SLA scheduler scan and the lead reports):
         * <ul>
         *   <li>any ACTIVITY event — notes, call logs, meetings, follow-ups, telephony calls
         *       (CALL_MADE, written for every finished call, recorded or not);</li>
         *   <li>REACHOUT — engagement-engine WhatsApp/email sends, imported Airtel calls,
         *       calls whose recording could not be fetched;</li>
         *   <li>STATUS_CHANGED / LEAD_CONVERTED / LEAD_LOST / COUNSELOR_ASSIGNED /
         *       COUNSELOR_UNASSIGNED / MANUAL_SCORE_UPDATE — only when a person made the change
         *       ({@code actor_id IS NOT NULL}). Automatic ones (intake status, AI/workflow status,
         *       pool auto-assignment) carry no actor, and the automatic SCORE_UPDATED written at
         *       intake is excluded outright — counting those would mark every lead responded
         *       the moment it arrives.</li>
         * </ul>
         * Keep the inline predicate identical in every query when changing it.
         */
        @Query(value = """
                            SELECT ar.id        AS leadId,
                                   acts.first_at AS firstActionAt,
                                   acts.last_at  AS lastActionAt
                            FROM audience_response ar
                            JOIN audience a ON a.id = ar.audience_id
                            LEFT JOIN LATERAL (
                                SELECT lu.user_id
                                FROM linked_users lu
                                WHERE lu.source = 'ENQUIRY' AND lu.source_id = ar.enquiry_id
                                ORDER BY lu.created_at DESC
                                LIMIT 1
                            ) lu ON true
                            LEFT JOIN user_lead_profile ulp
                                ON ulp.user_id = ar.user_id AND ulp.institute_id = a.institute_id
                            LEFT JOIN LATERAL (
                                -- Any response event counts as a "reach out" for SLA purposes,
                                -- whoever logged it (see the RESPONSE EVENT definition above).
                                SELECT MIN(te.created_at) AS first_at,
                                       MAX(te.created_at) AS last_at
                                FROM timeline_event te
                                WHERE (te.category = 'ACTIVITY' OR te.action_type = 'REACHOUT' OR (te.action_type IN ('STATUS_CHANGED','LEAD_CONVERTED','LEAD_LOST','COUNSELOR_ASSIGNED','COUNSELOR_UNASSIGNED','MANUAL_SCORE_UPDATE') AND te.actor_id IS NOT NULL))
                                  AND ( (te.type = 'AUDIENCE_RESPONSE' AND te.type_id = ar.id)
                                        OR (ar.user_id IS NOT NULL AND te.student_user_id = ar.user_id)
                                        OR (ar.student_user_id IS NOT NULL AND te.student_user_id = ar.student_user_id) )
                            ) acts ON true
                            WHERE ar.id IN (:responseIds)
                        """, nativeQuery = true)
        List<LeadLastActionProjection> findCounselorActionsByResponseIds(
                        @Param("responseIds") List<String> responseIds);

        // ─────────────────────────────────────────────────────────────────────
        // Lead Reports — institute-scoped aggregates, date-bounded on submitted_at.
        // OPTED_OUT leads are excluded everywhere so totals match the counsellor view.
        // All seven queries take three optional dimension binds (null = no filter):
        //   :scopeUsersCsv — comma-joined counsellor user_ids (RBAC scope). Matched against
        //       COALESCE(lu.user_id, ulp.assigned_counselor_id) — the same per-lead counsellor
        //       identity the performance rows group by. An EMPTY string matches nothing
        //       (STRING_TO_ARRAY('', ',') = {}), so an empty scope yields a zeroed report
        //       instead of silently widening back to institute-wide.
        //   :audienceId / :sourceType — straight equality on audience_response columns.
        // ─────────────────────────────────────────────────────────────────────

        /** Single-row totals: total / converted / lost / active / currently-overdue counts. */
        @Query(value = """
                            SELECT COUNT(*)                                                                              AS totalLeads,
                                   SUM(CASE WHEN ulp.conversion_status = 'CONVERTED' THEN 1 ELSE 0 END)                  AS convertedLeads,
                                   SUM(CASE WHEN ulp.conversion_status = 'LOST'      THEN 1 ELSE 0 END)                  AS lostLeads,
                                   SUM(CASE WHEN ulp.conversion_status IS NULL
                                              OR ulp.conversion_status NOT IN ('CONVERTED','LOST') THEN 1 ELSE 0 END)    AS activeLeads,
                                   SUM(CASE WHEN ar.tat_reminder_stage IN ('TAT_OVERDUE','FOLLOW_UP_OVERDUE') THEN 1 ELSE 0 END) AS overdueLeads
                            FROM audience_response ar
                            JOIN audience a ON a.id = ar.audience_id
                            LEFT JOIN LATERAL (
                                SELECT lu.user_id FROM linked_users lu
                                WHERE lu.source='ENQUIRY' AND lu.source_id = ar.enquiry_id
                                ORDER BY lu.created_at DESC LIMIT 1
                            ) lu ON true
                            LEFT JOIN user_lead_profile ulp
                                ON ulp.user_id = ar.user_id AND ulp.institute_id = a.institute_id
                            WHERE a.institute_id = :instituteId
                              AND ar.submitted_at >= CAST(:fromTs AS timestamp)
                              AND ar.submitted_at <  CAST(:toTs   AS timestamp)
                              AND (ar.overall_status IS NULL OR ar.overall_status != 'OPTED_OUT')
                              AND (:scopeUsersCsv IS NULL OR COALESCE(lu.user_id, ulp.assigned_counselor_id) = ANY(STRING_TO_ARRAY(:scopeUsersCsv, ',')))
                              AND (:audienceId IS NULL OR ar.audience_id = :audienceId)
                              AND (:sourceType IS NULL OR ar.source_type = :sourceType)
                        """, nativeQuery = true)
        LeadReportProjections.TotalsProjection findReportTotals(
                        @Param("instituteId") String instituteId,
                        @Param("fromTs") String fromTs,
                        @Param("toTs") String toTs,
                        @Param("scopeUsersCsv") String scopeUsersCsv,
                        @Param("audienceId") String audienceId,
                        @Param("sourceType") String sourceType);

        /**
         * Response stats aggregate. "first response" = MIN(response event) for the lead — the
         * RESPONSE EVENT definition on {@link #findCounselorActionsByResponseIds}, so the report
         * agrees with the leads list badge. tatMinutes = 0 (or null) makes tat_met never match;
         * the service surfaces tatMetCount as null when TAT is disabled.
         */
        @Query(value = """
                            WITH first_acts AS (
                                SELECT ar.id            AS lead_id,
                                       ar.submitted_at  AS submitted_at,
                                       (SELECT MIN(te.created_at) FROM timeline_event te
                                          WHERE (te.category = 'ACTIVITY' OR te.action_type = 'REACHOUT' OR (te.action_type IN ('STATUS_CHANGED','LEAD_CONVERTED','LEAD_LOST','COUNSELOR_ASSIGNED','COUNSELOR_UNASSIGNED','MANUAL_SCORE_UPDATE') AND te.actor_id IS NOT NULL))
                                            AND ( (te.type='AUDIENCE_RESPONSE' AND te.type_id = ar.id)
                                                  OR (ar.user_id IS NOT NULL AND te.student_user_id = ar.user_id)
                                                  OR (ar.student_user_id IS NOT NULL AND te.student_user_id = ar.student_user_id) )
                                       )                AS first_action_at
                                FROM audience_response ar
                                JOIN audience a ON a.id = ar.audience_id
                                LEFT JOIN LATERAL (
                                    SELECT lu.user_id FROM linked_users lu
                                    WHERE lu.source='ENQUIRY' AND lu.source_id = ar.enquiry_id
                                    ORDER BY lu.created_at DESC LIMIT 1
                                ) lu ON true
                                LEFT JOIN user_lead_profile ulp
                                    ON ulp.user_id = ar.user_id AND ulp.institute_id = a.institute_id
                                WHERE a.institute_id = :instituteId
                                  AND ar.submitted_at >= CAST(:fromTs AS timestamp)
                                  AND ar.submitted_at <  CAST(:toTs   AS timestamp)
                                  AND (ar.overall_status IS NULL OR ar.overall_status != 'OPTED_OUT')
                                  AND (:scopeUsersCsv IS NULL OR COALESCE(lu.user_id, ulp.assigned_counselor_id) = ANY(STRING_TO_ARRAY(:scopeUsersCsv, ',')))
                                  AND (:audienceId IS NULL OR ar.audience_id = :audienceId)
                                  AND (:sourceType IS NULL OR ar.source_type = :sourceType)
                            )
                            SELECT COUNT(first_action_at)                                                  AS respondedLeads,
                                   AVG(EXTRACT(EPOCH FROM (first_action_at - submitted_at)) / 60.0)        AS avgResponseMinutes,
                                   SUM(CASE WHEN first_action_at IS NOT NULL
                                                 AND first_action_at - submitted_at <= make_interval(mins => :tatMinutes)
                                                THEN 1 ELSE 0 END)                                         AS tatMetCount
                            FROM first_acts
                        """, nativeQuery = true)
        LeadReportProjections.ResponseStatsProjection findReportResponseStats(
                        @Param("instituteId") String instituteId,
                        @Param("fromTs") String fromTs,
                        @Param("toTs") String toTs,
                        @Param("tatMinutes") Integer tatMinutes,
                        @Param("scopeUsersCsv") String scopeUsersCsv,
                        @Param("audienceId") String audienceId,
                        @Param("sourceType") String sourceType);

        /** Status breakdown: rows of (status_key, count). */
        @Query(value = """
                            SELECT COALESCE(ulp.conversion_status, 'LEAD') AS statusKey,
                                   COUNT(*)                                AS leadCount
                            FROM audience_response ar
                            JOIN audience a ON a.id = ar.audience_id
                            LEFT JOIN LATERAL (
                                SELECT lu.user_id FROM linked_users lu
                                WHERE lu.source='ENQUIRY' AND lu.source_id = ar.enquiry_id
                                ORDER BY lu.created_at DESC LIMIT 1
                            ) lu ON true
                            LEFT JOIN user_lead_profile ulp
                                ON ulp.user_id = ar.user_id AND ulp.institute_id = a.institute_id
                            WHERE a.institute_id = :instituteId
                              AND ar.submitted_at >= CAST(:fromTs AS timestamp)
                              AND ar.submitted_at <  CAST(:toTs   AS timestamp)
                              AND (ar.overall_status IS NULL OR ar.overall_status != 'OPTED_OUT')
                              AND (:scopeUsersCsv IS NULL OR COALESCE(lu.user_id, ulp.assigned_counselor_id) = ANY(STRING_TO_ARRAY(:scopeUsersCsv, ',')))
                              AND (:audienceId IS NULL OR ar.audience_id = :audienceId)
                              AND (:sourceType IS NULL OR ar.source_type = :sourceType)
                            GROUP BY COALESCE(ulp.conversion_status, 'LEAD')
                        """, nativeQuery = true)
        List<LeadReportProjections.StatusCountProjection> findReportStatusBreakdown(
                        @Param("instituteId") String instituteId,
                        @Param("fromTs") String fromTs,
                        @Param("toTs") String toTs,
                        @Param("scopeUsersCsv") String scopeUsersCsv,
                        @Param("audienceId") String audienceId,
                        @Param("sourceType") String sourceType);

        /** Source breakdown: rows of (source_type, total, converted). */
        @Query(value = """
                            SELECT ar.source_type                                                       AS sourceType,
                                   COUNT(*)                                                             AS totalCount,
                                   SUM(CASE WHEN ulp.conversion_status='CONVERTED' THEN 1 ELSE 0 END)   AS convertedCount
                            FROM audience_response ar
                            JOIN audience a ON a.id = ar.audience_id
                            LEFT JOIN LATERAL (
                                SELECT lu.user_id FROM linked_users lu
                                WHERE lu.source='ENQUIRY' AND lu.source_id = ar.enquiry_id
                                ORDER BY lu.created_at DESC LIMIT 1
                            ) lu ON true
                            LEFT JOIN user_lead_profile ulp
                                ON ulp.user_id = ar.user_id AND ulp.institute_id = a.institute_id
                            WHERE a.institute_id = :instituteId
                              AND ar.submitted_at >= CAST(:fromTs AS timestamp)
                              AND ar.submitted_at <  CAST(:toTs   AS timestamp)
                              AND (ar.overall_status IS NULL OR ar.overall_status != 'OPTED_OUT')
                              AND (:scopeUsersCsv IS NULL OR COALESCE(lu.user_id, ulp.assigned_counselor_id) = ANY(STRING_TO_ARRAY(:scopeUsersCsv, ',')))
                              AND (:audienceId IS NULL OR ar.audience_id = :audienceId)
                              AND (:sourceType IS NULL OR ar.source_type = :sourceType)
                            GROUP BY ar.source_type
                            ORDER BY totalCount DESC
                        """, nativeQuery = true)
        List<LeadReportProjections.SourceCountProjection> findReportSourceBreakdown(
                        @Param("instituteId") String instituteId,
                        @Param("fromTs") String fromTs,
                        @Param("toTs") String toTs,
                        @Param("scopeUsersCsv") String scopeUsersCsv,
                        @Param("audienceId") String audienceId,
                        @Param("sourceType") String sourceType);

        /** Tier breakdown: explicit lead_tier wins, else the institute catalog band, else the legacy bucket, else UNCLASSIFIED. */
        @Query(value = """
                            SELECT COALESCE(NULLIF(ulp.lead_tier, ''),
                                            (SELECT lt.tier_key FROM lead_tier lt
                                         WHERE lt.institute_id = ulp.institute_id AND lt.is_active = TRUE
                                           AND lt.min_score IS NOT NULL AND ulp.best_score >= lt.min_score
                                         ORDER BY lt.min_score DESC, lt.display_order ASC LIMIT 1),
                                       CASE WHEN ulp.best_score >= 80 THEN 'HOT'
                                                 WHEN ulp.best_score >= 50 THEN 'WARM'
                                                 WHEN ulp.best_score IS NOT NULL THEN 'COLD'
                                                 ELSE 'UNCLASSIFIED' END)                AS tier,
                                   COUNT(*)                                              AS leadCount
                            FROM audience_response ar
                            JOIN audience a ON a.id = ar.audience_id
                            LEFT JOIN LATERAL (
                                SELECT lu.user_id FROM linked_users lu
                                WHERE lu.source='ENQUIRY' AND lu.source_id = ar.enquiry_id
                                ORDER BY lu.created_at DESC LIMIT 1
                            ) lu ON true
                            LEFT JOIN user_lead_profile ulp
                                ON ulp.user_id = ar.user_id AND ulp.institute_id = a.institute_id
                            WHERE a.institute_id = :instituteId
                              AND ar.submitted_at >= CAST(:fromTs AS timestamp)
                              AND ar.submitted_at <  CAST(:toTs   AS timestamp)
                              AND (ar.overall_status IS NULL OR ar.overall_status != 'OPTED_OUT')
                              AND (:scopeUsersCsv IS NULL OR COALESCE(lu.user_id, ulp.assigned_counselor_id) = ANY(STRING_TO_ARRAY(:scopeUsersCsv, ',')))
                              AND (:audienceId IS NULL OR ar.audience_id = :audienceId)
                              AND (:sourceType IS NULL OR ar.source_type = :sourceType)
                            GROUP BY 1
                        """, nativeQuery = true)
        List<LeadReportProjections.TierCountProjection> findReportTierBreakdown(
                        @Param("instituteId") String instituteId,
                        @Param("fromTs") String fromTs,
                        @Param("toTs") String toTs,
                        @Param("scopeUsersCsv") String scopeUsersCsv,
                        @Param("audienceId") String audienceId,
                        @Param("sourceType") String sourceType);

        /** Daily trend: GROUP BY DATE(submitted_at). */
        @Query(value = """
                            SELECT DATE(ar.submitted_at)                                              AS day,
                                   COUNT(*)                                                           AS submittedCount,
                                   SUM(CASE WHEN ulp.conversion_status='CONVERTED' THEN 1 ELSE 0 END) AS convertedCount
                            FROM audience_response ar
                            JOIN audience a ON a.id = ar.audience_id
                            LEFT JOIN LATERAL (
                                SELECT lu.user_id FROM linked_users lu
                                WHERE lu.source='ENQUIRY' AND lu.source_id = ar.enquiry_id
                                ORDER BY lu.created_at DESC LIMIT 1
                            ) lu ON true
                            LEFT JOIN user_lead_profile ulp
                                ON ulp.user_id = ar.user_id AND ulp.institute_id = a.institute_id
                            WHERE a.institute_id = :instituteId
                              AND ar.submitted_at >= CAST(:fromTs AS timestamp)
                              AND ar.submitted_at <  CAST(:toTs   AS timestamp)
                              AND (ar.overall_status IS NULL OR ar.overall_status != 'OPTED_OUT')
                              AND (:scopeUsersCsv IS NULL OR COALESCE(lu.user_id, ulp.assigned_counselor_id) = ANY(STRING_TO_ARRAY(:scopeUsersCsv, ',')))
                              AND (:audienceId IS NULL OR ar.audience_id = :audienceId)
                              AND (:sourceType IS NULL OR ar.source_type = :sourceType)
                            GROUP BY DATE(ar.submitted_at)
                            ORDER BY DATE(ar.submitted_at)
                        """, nativeQuery = true)
        List<LeadReportProjections.DailyTrendProjection> findReportDailyTrend(
                        @Param("instituteId") String instituteId,
                        @Param("fromTs") String fromTs,
                        @Param("toTs") String toTs,
                        @Param("scopeUsersCsv") String scopeUsersCsv,
                        @Param("audienceId") String audienceId,
                        @Param("sourceType") String sourceType);

        /**
         * Per-counsellor aggregate row. Counsellor resolution mirrors the leads list filter.
         * "first_response_at" = MIN(response event on this lead) — the RESPONSE EVENT definition
         * on {@link #findCounselorActionsByResponseIds}, so per-counsellor numbers match the list.
         */
        @Query(value = """
                            WITH lead_meta AS (
                                SELECT ar.id            AS lead_id,
                                       ar.submitted_at  AS submitted_at,
                                       ar.tat_reminder_stage AS tat_reminder_stage,
                                       ulp.conversion_status AS conversion_status,
                                       (SELECT MIN(te.created_at) FROM timeline_event te
                                          WHERE (te.category = 'ACTIVITY' OR te.action_type = 'REACHOUT' OR (te.action_type IN ('STATUS_CHANGED','LEAD_CONVERTED','LEAD_LOST','COUNSELOR_ASSIGNED','COUNSELOR_UNASSIGNED','MANUAL_SCORE_UPDATE') AND te.actor_id IS NOT NULL))
                                            AND ( (te.type='AUDIENCE_RESPONSE' AND te.type_id = ar.id)
                                                  OR (ar.user_id IS NOT NULL AND te.student_user_id = ar.user_id)
                                                  OR (ar.student_user_id IS NOT NULL AND te.student_user_id = ar.student_user_id) )
                                       )                AS first_response_at,
                                       COALESCE(lu.user_id, ulp.assigned_counselor_id) AS counselor_id
                                FROM audience_response ar
                                JOIN audience a ON a.id = ar.audience_id
                                LEFT JOIN LATERAL (
                                    SELECT lu.user_id FROM linked_users lu
                                    WHERE lu.source='ENQUIRY' AND lu.source_id = ar.enquiry_id
                                    ORDER BY lu.created_at DESC LIMIT 1
                                ) lu ON true
                                LEFT JOIN user_lead_profile ulp
                                    ON ulp.user_id = ar.user_id AND ulp.institute_id = a.institute_id
                                WHERE a.institute_id = :instituteId
                                  AND ar.submitted_at >= CAST(:fromTs AS timestamp)
                                  AND ar.submitted_at <  CAST(:toTs   AS timestamp)
                                  AND (ar.overall_status IS NULL OR ar.overall_status != 'OPTED_OUT')
                                  AND (:scopeUsersCsv IS NULL OR COALESCE(lu.user_id, ulp.assigned_counselor_id) = ANY(STRING_TO_ARRAY(:scopeUsersCsv, ',')))
                                  AND (:audienceId IS NULL OR ar.audience_id = :audienceId)
                                  AND (:sourceType IS NULL OR ar.source_type = :sourceType)
                            )
                            SELECT counselor_id                                                                          AS counselorId,
                                   COUNT(*)                                                                              AS leadsAssigned,
                                   COUNT(first_response_at)                                                              AS leadsResponded,
                                   SUM(CASE WHEN conversion_status='CONVERTED' THEN 1 ELSE 0 END)                        AS conversions,
                                   AVG(EXTRACT(EPOCH FROM (first_response_at - submitted_at)) / 60.0)                    AS avgResponseMinutes,
                                   SUM(CASE WHEN first_response_at IS NOT NULL
                                                 AND first_response_at - submitted_at <= make_interval(mins => :tatMinutes)
                                                THEN 1 ELSE 0 END)                                                       AS tatMetCount,
                                   SUM(CASE WHEN conversion_status IS NULL
                                              OR conversion_status NOT IN ('CONVERTED','LOST') THEN 1 ELSE 0 END)        AS openLeads,
                                   SUM(CASE WHEN tat_reminder_stage IN ('TAT_OVERDUE','FOLLOW_UP_OVERDUE') THEN 1 ELSE 0 END) AS overdueLeads
                            FROM lead_meta
                            WHERE counselor_id IS NOT NULL
                            GROUP BY counselor_id
                            ORDER BY leadsAssigned DESC
                        """, nativeQuery = true)
        List<LeadReportProjections.CounselorRowProjection> findReportCounselorPerformance(
                        @Param("instituteId") String instituteId,
                        @Param("fromTs") String fromTs,
                        @Param("toTs") String toTs,
                        @Param("tatMinutes") Integer tatMinutes,
                        @Param("scopeUsersCsv") String scopeUsersCsv,
                        @Param("audienceId") String audienceId,
                        @Param("sourceType") String sourceType);

        /**
         * Atomically claim a reminder stage for a lead. Returns 1 if this call won the claim (and the row
         * was updated), 0 if another run/replica already emitted this exact stage+cycle (dedup key matches).
         * Replica-safe via the row lock on the conditional WHERE — the scheduler emits the trigger only
         * when this returns 1.
         */
        @Modifying
        @Transactional
        @Query(value = """
                            UPDATE audience_response
                               SET tat_reminder_dedup_key = :dedupKey,
                                   tat_reminder_stage = :stage,
                                   tat_reminder_assignee_id = :assigneeId,
                                   tat_reminder_count = tat_reminder_count + 1,
                                   tat_due_at = :dueAt
                             WHERE id = :id
                               AND (tat_reminder_dedup_key IS NULL OR tat_reminder_dedup_key <> :dedupKey)
                        """, nativeQuery = true)
        int claimTatReminderStage(@Param("id") String id,
                        @Param("dedupKey") String dedupKey,
                        @Param("stage") String stage,
                        @Param("assigneeId") String assigneeId,
                        @Param("dueAt") Timestamp dueAt);

        /**
         * Lead lookup — "is this phone / email already ours?".
         *
         * Institute-wide on purpose: the whole point is to answer for a lead the
         * caller cannot otherwise see. Matching mirrors the dedup check so the two
         * never disagree — phone on the last 10 digits (tolerates a country-code
         * prefix, which most stored numbers lack), email case- and space-insensitive.
         *
         * Unlike the dedup check this does NOT skip OPTED_OUT leads: a counsellor
         * about to dial someone who opted out is exactly who needs telling.
         * Duplicates are still skipped, since they point at the same person.
         *
         * Course comes from a custom field, not destination_package_session_id —
         * that column is unset on every lead for the institutes using this, because
         * the course is collected as a form answer. Which field is per-institute
         * config, matched on the field's id (stable across renames); a null id
         * leaves the column null rather than guessing.
         *
         * Newest first: a repeat enquiry should answer with its current owner.
         */
        @Query(value = """
                            SELECT ar.parent_name            AS "leadName",
                                   ar.parent_email           AS "leadEmail",
                                   ar.parent_mobile          AS "leadMobile",
                                   ulp.assigned_counselor_name AS "counsellorName",
                                   a.campaign_type           AS "campaignType",
                                   a.campaign_name           AS "campaignName",
                                   ls.label                  AS "statusLabel",
                                   course.value              AS "courseValue",
                                   ar.overall_status         AS "overallStatus"
                            FROM audience_response ar
                            JOIN audience a ON a.id = ar.audience_id
                            LEFT JOIN user_lead_profile ulp
                                   ON ulp.user_id = ar.user_id AND ulp.institute_id = a.institute_id
                            LEFT JOIN lead_status ls ON ls.id = ar.lead_status_id
                            LEFT JOIN LATERAL (
                                   SELECT cfv.value FROM custom_field_values cfv
                                   WHERE cfv.source_id = ar.id
                                     AND CAST(:courseFieldId AS text) IS NOT NULL
                                     AND cfv.custom_field_id = CAST(:courseFieldId AS text)
                                   LIMIT 1) course ON true
                            WHERE a.institute_id = :instituteId
                              AND (ar.is_duplicate IS NULL OR ar.is_duplicate = false)
                              AND (
                                   (CAST(:last10 AS text) IS NOT NULL
                                    AND ar.parent_mobile IS NOT NULL
                                    AND RIGHT(regexp_replace(ar.parent_mobile, '[^0-9]', '', 'g'), 10) = CAST(:last10 AS text))
                                OR (CAST(:email AS text) IS NOT NULL
                                    AND ar.parent_email IS NOT NULL
                                    AND LOWER(TRIM(ar.parent_email)) = LOWER(TRIM(CAST(:email AS text))))
                              )
                            ORDER BY ar.submitted_at DESC NULLS LAST, ar.created_at DESC
                            LIMIT 1
                        """, nativeQuery = true)
        java.util.Optional<LeadLookupRow> lookupByPhoneOrEmail(
                        @Param("instituteId") String instituteId,
                        @Param("last10") String last10,
                        @Param("email") String email,
                        @Param("courseFieldId") String courseFieldId);

        /**
         * Projection for {@link #lookupByPhoneOrEmail}.
         *
         * The aliases above are quoted camelCase on purpose. Postgres folds an
         * unquoted alias to lower case, so `AS lead_name` arrives as `lead_name`
         * and never binds to {@code getLeadName()} — Spring returns null for every
         * getter rather than failing, which reads as "the lead exists but we know
         * nothing about it".
         */
        interface LeadLookupRow {
                String getLeadName();
                String getLeadEmail();
                String getLeadMobile();
                String getCounsellorName();
                String getCampaignType();
                String getCampaignName();
                String getStatusLabel();
                String getCourseValue();
                String getOverallStatus();
        }
}
