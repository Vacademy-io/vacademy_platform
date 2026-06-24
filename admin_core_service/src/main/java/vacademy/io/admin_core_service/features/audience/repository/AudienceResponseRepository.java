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
         * Find all leads for a specific campaign
         */
        List<AudienceResponse> findByAudienceId(String audienceId);

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
        @Query("SELECT ar FROM AudienceResponse ar WHERE ar.audienceId = :audienceId AND ar.userId IS NOT NULL AND (ar.overallStatus IS NULL OR ar.overallStatus != 'OPTED_OUT')")
        List<AudienceResponse> findConvertedLeads(@Param("audienceId") String audienceId);

        /**
         * Find all unconverted leads (without user_id)
         */
        @Query("SELECT ar FROM AudienceResponse ar WHERE ar.audienceId = :audienceId AND ar.userId IS NULL AND (ar.overallStatus IS NULL OR ar.overallStatus != 'OPTED_OUT')")
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
                            WHERE ar.audience_id = :audienceId
                              AND (COALESCE(:leadStatusId, '') = '' OR COALESCE((SELECT lst.status_key FROM lead_status lst WHERE lst.id = ar.lead_status_id), ulp.conversion_status) = :leadStatusId)
                              AND (COALESCE(:sourceType, '') = '' OR ar.source_type = :sourceType)
                              AND (COALESCE(:sourceId, '') = '' OR ar.source_id = :sourceId)
                              AND (CAST(:submittedFrom AS timestamp) IS NULL OR ar.submitted_at >= CAST(:submittedFrom AS timestamp))
                              AND (CAST(:submittedTo AS timestamp) IS NULL OR ar.submitted_at <= CAST(:submittedTo AS timestamp))
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
                                   (ulp.user_id IS NOT NULL AND :leadTier = COALESCE(NULLIF(ulp.lead_tier, ''),
                                       CASE WHEN ulp.best_score >= 80 THEN 'HOT'
                                            WHEN ulp.best_score >= 50 THEN 'WARM'
                                            ELSE 'COLD' END)))
                              AND (COALESCE(:assignedCounselorId, '') = ''
                                   OR lu.user_id = :assignedCounselorId
                                   OR ulp.assigned_counselor_id = :assignedCounselorId)
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
                              AND (:isUnassigned IS NULL OR :isUnassigned = FALSE OR lu.user_id IS NULL)
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
                              -- SLA-state filter. Aligned with the row-level badges + the new
                              -- column semantics:
                              --   * Reach-out buckets use submitted_at + tatHours AND a NOT EXISTS
                              --     check on timeline_event (category = ACTIVITY) so leads the
                              --     counsellor already contacted are excluded, matching the badge.
                              --   * Follow-up buckets read the lead_followup table (open rows
                              --     only), matching the Follow up at column which is now purely
                              --     counsellor-scheduled callbacks.
                              AND (COALESCE(:slaFilter, '') = ''
                                   OR (:slaFilter = 'TAT_OVERDUE'
                                       AND :tatHours IS NOT NULL
                                       AND ar.submitted_at IS NOT NULL
                                       AND ar.submitted_at + make_interval(hours => CAST(:tatHours AS integer)) < NOW()
                                       AND NOT EXISTS (
                                           SELECT 1 FROM timeline_event te
                                           WHERE te.category = 'ACTIVITY'
                                             AND ( (te.type = 'AUDIENCE_RESPONSE' AND te.type_id = ar.id)
                                                   OR (ar.user_id IS NOT NULL AND te.student_user_id = ar.user_id)
                                                   OR (ar.student_user_id IS NOT NULL AND te.student_user_id = ar.student_user_id) )))
                                   OR (:slaFilter = 'TAT_BEFORE'
                                       AND :tatHours IS NOT NULL
                                       AND ar.submitted_at IS NOT NULL
                                       AND ar.submitted_at + make_interval(hours => CAST(:tatHours AS integer)) > NOW()
                                       AND ar.submitted_at + make_interval(hours => CAST(:tatHours AS integer)) <= NOW() + INTERVAL '30 minutes'
                                       AND NOT EXISTS (
                                           SELECT 1 FROM timeline_event te
                                           WHERE te.category = 'ACTIVITY'
                                             AND ( (te.type = 'AUDIENCE_RESPONSE' AND te.type_id = ar.id)
                                                   OR (ar.user_id IS NOT NULL AND te.student_user_id = ar.user_id)
                                                   OR (ar.student_user_id IS NOT NULL AND te.student_user_id = ar.student_user_id) )))
                                   OR (:slaFilter = 'FOLLOW_UP_DUE'
                                       AND EXISTS (
                                           SELECT 1 FROM lead_followup lf
                                           WHERE lf.audience_response_id = ar.id
                                             AND lf.is_closed = false
                                             AND lf.schedule_time IS NOT NULL
                                             AND lf.schedule_time > NOW()
                                             AND lf.schedule_time <= NOW() + INTERVAL '30 minutes'))
                                   OR (:slaFilter = 'FOLLOW_UP_OVERDUE'
                                       AND EXISTS (
                                           SELECT 1 FROM lead_followup lf
                                           WHERE lf.audience_response_id = ar.id
                                             AND lf.is_closed = false
                                             AND lf.schedule_time IS NOT NULL
                                             AND lf.schedule_time < NOW()))
                                   OR (:slaFilter = 'ANY_OVERDUE'
                                       AND (
                                           (:tatHours IS NOT NULL
                                            AND ar.submitted_at IS NOT NULL
                                            AND ar.submitted_at + make_interval(hours => CAST(:tatHours AS integer)) < NOW()
                                            AND NOT EXISTS (
                                                SELECT 1 FROM timeline_event te
                                                WHERE te.category = 'ACTIVITY'
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
                            ORDER BY
                              CASE WHEN :sortBy = 'LEAD_SCORE' AND (:sortDirection IS NULL OR :sortDirection = 'DESC')
                                   THEN COALESCE(ls.raw_score, 0) END DESC,
                              CASE WHEN :sortBy = 'LEAD_SCORE' AND :sortDirection = 'ASC'
                                   THEN COALESCE(ls.raw_score, 0) END ASC,
                              CASE WHEN :sortBy = 'PARENT_NAME' AND (:sortDirection IS NULL OR :sortDirection = 'ASC')
                                   THEN ar.parent_name END ASC,
                              CASE WHEN :sortBy = 'PARENT_NAME' AND :sortDirection = 'DESC'
                                   THEN ar.parent_name END DESC,
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
                            WHERE ar.audience_id = :audienceId
                              AND (COALESCE(:leadStatusId, '') = '' OR COALESCE((SELECT lst.status_key FROM lead_status lst WHERE lst.id = ar.lead_status_id), ulp.conversion_status) = :leadStatusId)
                              AND (COALESCE(:sourceType, '') = '' OR ar.source_type = :sourceType)
                              AND (COALESCE(:sourceId, '') = '' OR ar.source_id = :sourceId)
                              AND (CAST(:submittedFrom AS timestamp) IS NULL OR ar.submitted_at >= CAST(:submittedFrom AS timestamp))
                              AND (CAST(:submittedTo AS timestamp) IS NULL OR ar.submitted_at <= CAST(:submittedTo AS timestamp))
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
                                   (ulp.user_id IS NOT NULL AND :leadTier = COALESCE(NULLIF(ulp.lead_tier, ''),
                                       CASE WHEN ulp.best_score >= 80 THEN 'HOT'
                                            WHEN ulp.best_score >= 50 THEN 'WARM'
                                            ELSE 'COLD' END)))
                              AND (COALESCE(:assignedCounselorId, '') = ''
                                   OR lu.user_id = :assignedCounselorId
                                   OR ulp.assigned_counselor_id = :assignedCounselorId)
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
                              AND (:isUnassigned IS NULL OR :isUnassigned = FALSE OR lu.user_id IS NULL)
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
                              -- SLA-state filter. Aligned with the row-level badges + the new
                              -- column semantics:
                              --   * Reach-out buckets use submitted_at + tatHours AND a NOT EXISTS
                              --     check on timeline_event (category = ACTIVITY) so leads the
                              --     counsellor already contacted are excluded, matching the badge.
                              --   * Follow-up buckets read the lead_followup table (open rows
                              --     only), matching the Follow up at column which is now purely
                              --     counsellor-scheduled callbacks.
                              AND (COALESCE(:slaFilter, '') = ''
                                   OR (:slaFilter = 'TAT_OVERDUE'
                                       AND :tatHours IS NOT NULL
                                       AND ar.submitted_at IS NOT NULL
                                       AND ar.submitted_at + make_interval(hours => CAST(:tatHours AS integer)) < NOW()
                                       AND NOT EXISTS (
                                           SELECT 1 FROM timeline_event te
                                           WHERE te.category = 'ACTIVITY'
                                             AND ( (te.type = 'AUDIENCE_RESPONSE' AND te.type_id = ar.id)
                                                   OR (ar.user_id IS NOT NULL AND te.student_user_id = ar.user_id)
                                                   OR (ar.student_user_id IS NOT NULL AND te.student_user_id = ar.student_user_id) )))
                                   OR (:slaFilter = 'TAT_BEFORE'
                                       AND :tatHours IS NOT NULL
                                       AND ar.submitted_at IS NOT NULL
                                       AND ar.submitted_at + make_interval(hours => CAST(:tatHours AS integer)) > NOW()
                                       AND ar.submitted_at + make_interval(hours => CAST(:tatHours AS integer)) <= NOW() + INTERVAL '30 minutes'
                                       AND NOT EXISTS (
                                           SELECT 1 FROM timeline_event te
                                           WHERE te.category = 'ACTIVITY'
                                             AND ( (te.type = 'AUDIENCE_RESPONSE' AND te.type_id = ar.id)
                                                   OR (ar.user_id IS NOT NULL AND te.student_user_id = ar.user_id)
                                                   OR (ar.student_user_id IS NOT NULL AND te.student_user_id = ar.student_user_id) )))
                                   OR (:slaFilter = 'FOLLOW_UP_DUE'
                                       AND EXISTS (
                                           SELECT 1 FROM lead_followup lf
                                           WHERE lf.audience_response_id = ar.id
                                             AND lf.is_closed = false
                                             AND lf.schedule_time IS NOT NULL
                                             AND lf.schedule_time > NOW()
                                             AND lf.schedule_time <= NOW() + INTERVAL '30 minutes'))
                                   OR (:slaFilter = 'FOLLOW_UP_OVERDUE'
                                       AND EXISTS (
                                           SELECT 1 FROM lead_followup lf
                                           WHERE lf.audience_response_id = ar.id
                                             AND lf.is_closed = false
                                             AND lf.schedule_time IS NOT NULL
                                             AND lf.schedule_time < NOW()))
                                   OR (:slaFilter = 'ANY_OVERDUE'
                                       AND (
                                           (:tatHours IS NOT NULL
                                            AND ar.submitted_at IS NOT NULL
                                            AND ar.submitted_at + make_interval(hours => CAST(:tatHours AS integer)) < NOW()
                                            AND NOT EXISTS (
                                                SELECT 1 FROM timeline_event te
                                                WHERE te.category = 'ACTIVITY'
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
                        """, nativeQuery = true)
        Page<AudienceResponse> findLeadsWithFilters(
                        @Param("audienceId") String audienceId,
                        @Param("leadStatusId") String leadStatusId,
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
                        @Param("conversionStatusFilter") String conversionStatusFilter,
                        @Param("slaFilter") String slaFilter,
                        @Param("tatHours") Integer tatHours,
                        @Param("sortBy") String sortBy,
                        @Param("sortDirection") String sortDirection,
                        Pageable pageable);

        /**
         * Find all leads for an institute (across all campaigns)
         */
        @Query("""
                            SELECT ar FROM AudienceResponse ar
                            JOIN Audience a ON a.id = ar.audienceId
                            WHERE a.instituteId = :instituteId
                            AND (ar.overallStatus IS NULL OR ar.overallStatus != 'OPTED_OUT')
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
                            WHERE a.institute_id = :instituteId
                              AND (COALESCE(:leadStatusId, '') = '' OR COALESCE((SELECT lst.status_key FROM lead_status lst WHERE lst.id = ar.lead_status_id), ulp.conversion_status) = :leadStatusId)
                              AND (CAST(:submittedFrom AS timestamp) IS NULL OR ar.submitted_at >= CAST(:submittedFrom AS timestamp))
                              AND (CAST(:submittedTo AS timestamp) IS NULL OR ar.submitted_at <= CAST(:submittedTo AS timestamp))
                              AND (COALESCE(:searchQuery, '') = '' OR
                                   LOWER(ar.parent_name) LIKE LOWER(CONCAT('%', :searchQuery, '%')) OR
                                   LOWER(ar.parent_email) LIKE LOWER(CONCAT('%', :searchQuery, '%')) OR
                                   ar.parent_mobile LIKE CONCAT('%', :searchQuery, '%') OR
                                   (COALESCE(:searchUserIdsCsv, '') != ''
                                    AND ar.user_id = ANY(STRING_TO_ARRAY(:searchUserIdsCsv, ','))))
                              AND (COALESCE(:leadTier, '') = '' OR
                                   (ulp.user_id IS NOT NULL AND :leadTier = COALESCE(NULLIF(ulp.lead_tier, ''),
                                       CASE WHEN ulp.best_score >= 80 THEN 'HOT'
                                            WHEN ulp.best_score >= 50 THEN 'WARM'
                                            ELSE 'COLD' END)))
                              AND (COALESCE(:assignedCounselorId, '') = ''
                                   OR lu.user_id = :assignedCounselorId
                                   OR ulp.assigned_counselor_id = :assignedCounselorId)
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
                              AND (COALESCE(:allowedAudienceIdsCsv, '') = '' OR ar.audience_id = ANY(STRING_TO_ARRAY(:allowedAudienceIdsCsv, ',')))
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
                              AND (ar.overall_status IS NULL OR ar.overall_status != 'OPTED_OUT')
                              -- SLA-state filter. Aligned with the row-level badges + the new
                              -- column semantics:
                              --   * Reach-out buckets use submitted_at + tatHours AND a NOT EXISTS
                              --     check on timeline_event (category = ACTIVITY) so leads the
                              --     counsellor already contacted are excluded, matching the badge.
                              --   * Follow-up buckets read the lead_followup table (open rows
                              --     only), matching the Follow up at column which is now purely
                              --     counsellor-scheduled callbacks.
                              AND (COALESCE(:slaFilter, '') = ''
                                   OR (:slaFilter = 'TAT_OVERDUE'
                                       AND :tatHours IS NOT NULL
                                       AND ar.submitted_at IS NOT NULL
                                       AND ar.submitted_at + make_interval(hours => CAST(:tatHours AS integer)) < NOW()
                                       AND NOT EXISTS (
                                           SELECT 1 FROM timeline_event te
                                           WHERE te.category = 'ACTIVITY'
                                             AND ( (te.type = 'AUDIENCE_RESPONSE' AND te.type_id = ar.id)
                                                   OR (ar.user_id IS NOT NULL AND te.student_user_id = ar.user_id)
                                                   OR (ar.student_user_id IS NOT NULL AND te.student_user_id = ar.student_user_id) )))
                                   OR (:slaFilter = 'TAT_BEFORE'
                                       AND :tatHours IS NOT NULL
                                       AND ar.submitted_at IS NOT NULL
                                       AND ar.submitted_at + make_interval(hours => CAST(:tatHours AS integer)) > NOW()
                                       AND ar.submitted_at + make_interval(hours => CAST(:tatHours AS integer)) <= NOW() + INTERVAL '30 minutes'
                                       AND NOT EXISTS (
                                           SELECT 1 FROM timeline_event te
                                           WHERE te.category = 'ACTIVITY'
                                             AND ( (te.type = 'AUDIENCE_RESPONSE' AND te.type_id = ar.id)
                                                   OR (ar.user_id IS NOT NULL AND te.student_user_id = ar.user_id)
                                                   OR (ar.student_user_id IS NOT NULL AND te.student_user_id = ar.student_user_id) )))
                                   OR (:slaFilter = 'FOLLOW_UP_DUE'
                                       AND EXISTS (
                                           SELECT 1 FROM lead_followup lf
                                           WHERE lf.audience_response_id = ar.id
                                             AND lf.is_closed = false
                                             AND lf.schedule_time IS NOT NULL
                                             AND lf.schedule_time > NOW()
                                             AND lf.schedule_time <= NOW() + INTERVAL '30 minutes'))
                                   OR (:slaFilter = 'FOLLOW_UP_OVERDUE'
                                       AND EXISTS (
                                           SELECT 1 FROM lead_followup lf
                                           WHERE lf.audience_response_id = ar.id
                                             AND lf.is_closed = false
                                             AND lf.schedule_time IS NOT NULL
                                             AND lf.schedule_time < NOW()))
                                   OR (:slaFilter = 'ANY_OVERDUE'
                                       AND (
                                           (:tatHours IS NOT NULL
                                            AND ar.submitted_at IS NOT NULL
                                            AND ar.submitted_at + make_interval(hours => CAST(:tatHours AS integer)) < NOW()
                                            AND NOT EXISTS (
                                                SELECT 1 FROM timeline_event te
                                                WHERE te.category = 'ACTIVITY'
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
                            ORDER BY ar.submitted_at DESC
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
                            WHERE a.institute_id = :instituteId
                              AND (COALESCE(:leadStatusId, '') = '' OR COALESCE((SELECT lst.status_key FROM lead_status lst WHERE lst.id = ar.lead_status_id), ulp.conversion_status) = :leadStatusId)
                              AND (CAST(:submittedFrom AS timestamp) IS NULL OR ar.submitted_at >= CAST(:submittedFrom AS timestamp))
                              AND (CAST(:submittedTo AS timestamp) IS NULL OR ar.submitted_at <= CAST(:submittedTo AS timestamp))
                              AND (COALESCE(:searchQuery, '') = '' OR
                                   LOWER(ar.parent_name) LIKE LOWER(CONCAT('%', :searchQuery, '%')) OR
                                   LOWER(ar.parent_email) LIKE LOWER(CONCAT('%', :searchQuery, '%')) OR
                                   ar.parent_mobile LIKE CONCAT('%', :searchQuery, '%') OR
                                   (COALESCE(:searchUserIdsCsv, '') != ''
                                    AND ar.user_id = ANY(STRING_TO_ARRAY(:searchUserIdsCsv, ','))))
                              AND (COALESCE(:leadTier, '') = '' OR
                                   (ulp.user_id IS NOT NULL AND :leadTier = COALESCE(NULLIF(ulp.lead_tier, ''),
                                       CASE WHEN ulp.best_score >= 80 THEN 'HOT'
                                            WHEN ulp.best_score >= 50 THEN 'WARM'
                                            ELSE 'COLD' END)))
                              AND (COALESCE(:assignedCounselorId, '') = ''
                                   OR lu.user_id = :assignedCounselorId
                                   OR ulp.assigned_counselor_id = :assignedCounselorId)
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
                              AND (COALESCE(:allowedAudienceIdsCsv, '') = '' OR ar.audience_id = ANY(STRING_TO_ARRAY(:allowedAudienceIdsCsv, ',')))
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
                              AND (ar.overall_status IS NULL OR ar.overall_status != 'OPTED_OUT')
                              -- SLA-state filter. Aligned with the row-level badges + the new
                              -- column semantics:
                              --   * Reach-out buckets use submitted_at + tatHours AND a NOT EXISTS
                              --     check on timeline_event (category = ACTIVITY) so leads the
                              --     counsellor already contacted are excluded, matching the badge.
                              --   * Follow-up buckets read the lead_followup table (open rows
                              --     only), matching the Follow up at column which is now purely
                              --     counsellor-scheduled callbacks.
                              AND (COALESCE(:slaFilter, '') = ''
                                   OR (:slaFilter = 'TAT_OVERDUE'
                                       AND :tatHours IS NOT NULL
                                       AND ar.submitted_at IS NOT NULL
                                       AND ar.submitted_at + make_interval(hours => CAST(:tatHours AS integer)) < NOW()
                                       AND NOT EXISTS (
                                           SELECT 1 FROM timeline_event te
                                           WHERE te.category = 'ACTIVITY'
                                             AND ( (te.type = 'AUDIENCE_RESPONSE' AND te.type_id = ar.id)
                                                   OR (ar.user_id IS NOT NULL AND te.student_user_id = ar.user_id)
                                                   OR (ar.student_user_id IS NOT NULL AND te.student_user_id = ar.student_user_id) )))
                                   OR (:slaFilter = 'TAT_BEFORE'
                                       AND :tatHours IS NOT NULL
                                       AND ar.submitted_at IS NOT NULL
                                       AND ar.submitted_at + make_interval(hours => CAST(:tatHours AS integer)) > NOW()
                                       AND ar.submitted_at + make_interval(hours => CAST(:tatHours AS integer)) <= NOW() + INTERVAL '30 minutes'
                                       AND NOT EXISTS (
                                           SELECT 1 FROM timeline_event te
                                           WHERE te.category = 'ACTIVITY'
                                             AND ( (te.type = 'AUDIENCE_RESPONSE' AND te.type_id = ar.id)
                                                   OR (ar.user_id IS NOT NULL AND te.student_user_id = ar.user_id)
                                                   OR (ar.student_user_id IS NOT NULL AND te.student_user_id = ar.student_user_id) )))
                                   OR (:slaFilter = 'FOLLOW_UP_DUE'
                                       AND EXISTS (
                                           SELECT 1 FROM lead_followup lf
                                           WHERE lf.audience_response_id = ar.id
                                             AND lf.is_closed = false
                                             AND lf.schedule_time IS NOT NULL
                                             AND lf.schedule_time > NOW()
                                             AND lf.schedule_time <= NOW() + INTERVAL '30 minutes'))
                                   OR (:slaFilter = 'FOLLOW_UP_OVERDUE'
                                       AND EXISTS (
                                           SELECT 1 FROM lead_followup lf
                                           WHERE lf.audience_response_id = ar.id
                                             AND lf.is_closed = false
                                             AND lf.schedule_time IS NOT NULL
                                             AND lf.schedule_time < NOW()))
                                   OR (:slaFilter = 'ANY_OVERDUE'
                                       AND (
                                           (:tatHours IS NOT NULL
                                            AND ar.submitted_at IS NOT NULL
                                            AND ar.submitted_at + make_interval(hours => CAST(:tatHours AS integer)) < NOW()
                                            AND NOT EXISTS (
                                                SELECT 1 FROM timeline_event te
                                                WHERE te.category = 'ACTIVITY'
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
                        """, nativeQuery = true)
        Page<AudienceResponse> findInstituteLeadsWithFilters(
                        @Param("instituteId") String instituteId,
                        @Param("leadStatusId") String leadStatusId,
                        @Param("submittedFrom") Timestamp submittedFrom,
                        @Param("submittedTo") Timestamp submittedTo,
                        @Param("searchQuery") String searchQuery,
                        @Param("searchUserIdsCsv") String searchUserIdsCsv,
                        @Param("leadTier") String leadTier,
                        @Param("assignedCounselorId") String assignedCounselorId,
                        @Param("assignedCounselorIdsCsv") String assignedCounselorIdsCsv,
                        @Param("includeUnassigned") Boolean includeUnassigned,
                        @Param("allowedAudienceIdsCsv") String allowedAudienceIdsCsv,
                        @Param("conversionStatusFilter") String conversionStatusFilter,
                        @Param("slaFilter") String slaFilter,
                        @Param("tatHours") Integer tatHours,
                        @Param("customFieldMatchedIdsCsv") String customFieldMatchedIdsCsv,
                        Pageable pageable);

        /**
         * Distinct values a custom field holds across an institute's leads —
         * powers the searchable, paginated multi-select dropdowns in the leads
         * filter bar. Scoped to the institute via custom_field_values →
         * audience_response → audience; backed by idx_cfv_field_source_value.
         * `:search` is a case-insensitive substring (blank = all values).
         */
        @Query(value = """
                            SELECT DISTINCT cfv.value
                            FROM custom_field_values cfv
                            JOIN audience_response ar ON ar.id = cfv.source_id
                            JOIN audience a ON a.id = ar.audience_id
                            WHERE cfv.source_type = 'AUDIENCE_RESPONSE'
                              AND a.institute_id = :instituteId
                              AND cfv.custom_field_id = :customFieldId
                              AND cfv.value IS NOT NULL
                              AND cfv.value <> ''
                              AND (COALESCE(:search, '') = '' OR cfv.value ILIKE CONCAT('%', :search, '%'))
                            ORDER BY cfv.value ASC
                        """, countQuery = """
                            SELECT COUNT(DISTINCT cfv.value)
                            FROM custom_field_values cfv
                            JOIN audience_response ar ON ar.id = cfv.source_id
                            JOIN audience a ON a.id = ar.audience_id
                            WHERE cfv.source_type = 'AUDIENCE_RESPONSE'
                              AND a.institute_id = :instituteId
                              AND cfv.custom_field_id = :customFieldId
                              AND cfv.value IS NOT NULL
                              AND cfv.value <> ''
                              AND (COALESCE(:search, '') = '' OR cfv.value ILIKE CONCAT('%', :search, '%'))
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
                        "AND (ar.overallStatus IS NULL OR ar.overallStatus != 'OPTED_OUT')")
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
                        "AND (ar.overallStatus IS NULL OR ar.overallStatus != 'OPTED_OUT')")
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
                        """, nativeQuery = true)
        List<String> findInstituteIdsWithActiveLeads();

        /**
         * All open, assigned, unconverted leads for an institute, with the resolved counselor and the
         * timestamp of that counselor's last action on the lead. The scheduler decides which SLA stage
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
                                      WHERE te.actor_id = COALESCE(lu.user_id, ulp.assigned_counselor_id)
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
                              AND (ulp.conversion_status IS NULL OR ulp.conversion_status != 'CONVERTED')
                              AND COALESCE(lu.user_id, ulp.assigned_counselor_id) IS NOT NULL
                        """, nativeQuery = true)
        List<LeadSlaCandidate> findSlaCandidatesForInstitute(@Param("instituteId") String instituteId);

        /**
         * For a set of leads, the timestamps of each lead's assigned counselor's FIRST and LAST
         * actions on it (from timeline_event). Drives:
         *   firstActionAt → "Responded in N" (time-to-first-response shown in the leads tables).
         *   lastActionAt  → follow-up deadline (= lastActionAt + followUpSlaHours).
         * Counselor resolution mirrors {@link #findSlaCandidatesForInstitute} (linked_users, then profile).
         * Leads with no counselor or no counselor action return both timestamps as null.
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
                                -- Any manual human interaction (note / call log / follow-up /
                                -- meeting) counts as a "reach out" for SLA purposes, regardless
                                -- of whether the assigned counsellor or an admin acting on their
                                -- behalf logged it. Filter by category = 'ACTIVITY' so automated
                                -- JOURNEY events (status changes, score updates, etc.) do not
                                -- accidentally mark the lead as contacted.
                                SELECT MIN(te.created_at) AS first_at,
                                       MAX(te.created_at) AS last_at
                                FROM timeline_event te
                                WHERE te.category = 'ACTIVITY'
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
         * Response stats aggregate. "first response" = MIN(timeline_event by the assigned counsellor)
         * for the lead — i.e. the moment the counsellor logged their first activity (note / call /
         * status update). Status changes by admins are intentionally NOT counted; the metric is
         * strictly counsellor-driven. tatHours = 0 (or null) makes tat_met never match; the service
         * surfaces tatMetCount as null when TAT is disabled.
         */
        @Query(value = """
                            WITH first_acts AS (
                                SELECT ar.id            AS lead_id,
                                       ar.submitted_at  AS submitted_at,
                                       (SELECT MIN(te.created_at) FROM timeline_event te
                                          WHERE te.actor_id = COALESCE(lu.user_id, ulp.assigned_counselor_id)
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
                                                 AND first_action_at - submitted_at <= make_interval(hours => :tatHours)
                                                THEN 1 ELSE 0 END)                                         AS tatMetCount
                            FROM first_acts
                        """, nativeQuery = true)
        LeadReportProjections.ResponseStatsProjection findReportResponseStats(
                        @Param("instituteId") String instituteId,
                        @Param("fromTs") String fromTs,
                        @Param("toTs") String toTs,
                        @Param("tatHours") Integer tatHours,
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

        /** Tier breakdown: explicit lead_tier wins, else score-derived bucket, else UNCLASSIFIED. */
        @Query(value = """
                            SELECT COALESCE(NULLIF(ulp.lead_tier, ''),
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
         * "first_response_at" = MIN(timeline_event by this counsellor on this lead) — strict
         * counsellor-activity definition; admin status flips are NOT counted.
         */
        @Query(value = """
                            WITH lead_meta AS (
                                SELECT ar.id            AS lead_id,
                                       ar.submitted_at  AS submitted_at,
                                       ar.tat_reminder_stage AS tat_reminder_stage,
                                       ulp.conversion_status AS conversion_status,
                                       (SELECT MIN(te.created_at) FROM timeline_event te
                                          WHERE te.actor_id = COALESCE(lu.user_id, ulp.assigned_counselor_id)
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
                                                 AND first_response_at - submitted_at <= make_interval(hours => :tatHours)
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
                        @Param("tatHours") Integer tatHours,
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
}

