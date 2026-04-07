package vacademy.io.admin_core_service.features.audience.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
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
        @Query("SELECT ar FROM AudienceResponse ar WHERE ar.audienceId = :audienceId AND ar.userId IS NOT NULL")
        List<AudienceResponse> findConvertedLeads(@Param("audienceId") String audienceId);

        /**
         * Find all unconverted leads (without user_id)
         */
        @Query("SELECT ar FROM AudienceResponse ar WHERE ar.audienceId = :audienceId AND ar.userId IS NULL")
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
                            LEFT JOIN lead_score ls ON ls.audience_response_id = ar.id
                            LEFT JOIN LATERAL (
                                SELECT lu.user_id
                                FROM linked_users lu
                                WHERE lu.source = 'ENQUIRY' AND lu.source_id = ar.enquiry_id
                                ORDER BY lu.created_at DESC
                                LIMIT 1
                            ) lu ON true
                            WHERE ar.audience_id = :audienceId
                              AND (COALESCE(:sourceType, '') = '' OR ar.source_type = :sourceType)
                              AND (COALESCE(:sourceId, '') = '' OR ar.source_id = :sourceId)
                              AND (CAST(:submittedFrom AS timestamp) IS NULL OR ar.submitted_at >= CAST(:submittedFrom AS timestamp))
                              AND (CAST(:submittedTo AS timestamp) IS NULL OR ar.submitted_at <= CAST(:submittedTo AS timestamp))
                              AND (:excludeDuplicates IS NULL OR :excludeDuplicates = FALSE OR COALESCE(ar.is_duplicate, FALSE) = FALSE)
                              AND (COALESCE(:searchQuery, '') = '' OR
                                   LOWER(ar.parent_name) LIKE LOWER(CONCAT('%', :searchQuery, '%')) OR
                                   LOWER(ar.parent_email) LIKE LOWER(CONCAT('%', :searchQuery, '%')) OR
                                   ar.parent_mobile LIKE CONCAT('%', :searchQuery, '%'))
                              AND (:minLeadScore IS NULL OR COALESCE(ls.raw_score, 0) >= :minLeadScore)
                              AND (:maxLeadScore IS NULL OR COALESCE(ls.raw_score, 0) <= :maxLeadScore)
                              AND (COALESCE(:leadTier, '') = '' OR
                                   (:leadTier = 'HOT'  AND ls.raw_score IS NOT NULL AND ls.raw_score >= 80) OR
                                   (:leadTier = 'WARM' AND ls.raw_score IS NOT NULL AND ls.raw_score >= 50 AND ls.raw_score < 80) OR
                                   (:leadTier = 'COLD' AND ls.raw_score IS NOT NULL AND ls.raw_score < 50))
                              AND (COALESCE(:assignedCounselorId, '') = '' OR lu.user_id = :assignedCounselorId)
                              AND (:isUnassigned IS NULL OR :isUnassigned = FALSE OR lu.user_id IS NULL)
                              AND (COALESCE(:overallStatusStr, '') = '' OR ar.overall_status = ANY(STRING_TO_ARRAY(:overallStatusStr, ',')))
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
                            LEFT JOIN lead_score ls ON ls.audience_response_id = ar.id
                            LEFT JOIN LATERAL (
                                SELECT lu.user_id
                                FROM linked_users lu
                                WHERE lu.source = 'ENQUIRY' AND lu.source_id = ar.enquiry_id
                                ORDER BY lu.created_at DESC
                                LIMIT 1
                            ) lu ON true
                            WHERE ar.audience_id = :audienceId
                              AND (COALESCE(:sourceType, '') = '' OR ar.source_type = :sourceType)
                              AND (COALESCE(:sourceId, '') = '' OR ar.source_id = :sourceId)
                              AND (CAST(:submittedFrom AS timestamp) IS NULL OR ar.submitted_at >= CAST(:submittedFrom AS timestamp))
                              AND (CAST(:submittedTo AS timestamp) IS NULL OR ar.submitted_at <= CAST(:submittedTo AS timestamp))
                              AND (:excludeDuplicates IS NULL OR :excludeDuplicates = FALSE OR COALESCE(ar.is_duplicate, FALSE) = FALSE)
                              AND (COALESCE(:searchQuery, '') = '' OR
                                   LOWER(ar.parent_name) LIKE LOWER(CONCAT('%', :searchQuery, '%')) OR
                                   LOWER(ar.parent_email) LIKE LOWER(CONCAT('%', :searchQuery, '%')) OR
                                   ar.parent_mobile LIKE CONCAT('%', :searchQuery, '%'))
                              AND (:minLeadScore IS NULL OR COALESCE(ls.raw_score, 0) >= :minLeadScore)
                              AND (:maxLeadScore IS NULL OR COALESCE(ls.raw_score, 0) <= :maxLeadScore)
                              AND (COALESCE(:leadTier, '') = '' OR
                                   (:leadTier = 'HOT'  AND ls.raw_score IS NOT NULL AND ls.raw_score >= 80) OR
                                   (:leadTier = 'WARM' AND ls.raw_score IS NOT NULL AND ls.raw_score >= 50 AND ls.raw_score < 80) OR
                                   (:leadTier = 'COLD' AND ls.raw_score IS NOT NULL AND ls.raw_score < 50))
                              AND (COALESCE(:assignedCounselorId, '') = '' OR lu.user_id = :assignedCounselorId)
                              AND (:isUnassigned IS NULL OR :isUnassigned = FALSE OR lu.user_id IS NULL)
                              AND (COALESCE(:overallStatusStr, '') = '' OR ar.overall_status = ANY(STRING_TO_ARRAY(:overallStatusStr, ',')))
                        """, nativeQuery = true)
        Page<AudienceResponse> findLeadsWithFilters(
                        @Param("audienceId") String audienceId,
                        @Param("sourceType") String sourceType,
                        @Param("sourceId") String sourceId,
                        @Param("submittedFrom") Timestamp submittedFrom,
                        @Param("submittedTo") Timestamp submittedTo,
                        @Param("excludeDuplicates") Boolean excludeDuplicates,
                        @Param("searchQuery") String searchQuery,
                        @Param("minLeadScore") Integer minLeadScore,
                        @Param("maxLeadScore") Integer maxLeadScore,
                        @Param("leadTier") String leadTier,
                        @Param("assignedCounselorId") String assignedCounselorId,
                        @Param("isUnassigned") Boolean isUnassigned,
                        @Param("overallStatusStr") String overallStatusStr,
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
                            ORDER BY ar.submittedAt DESC
                        """)
        Page<AudienceResponse> findAllLeadsForInstitute(
                        @Param("instituteId") String instituteId,
                        Pageable pageable);

        /**
         * Count total leads for a campaign
         */
        Long countByAudienceId(String audienceId);

        /**
         * Count converted leads for a campaign
         */
        @Query("SELECT COUNT(ar) FROM AudienceResponse ar WHERE ar.audienceId = :audienceId AND ar.userId IS NOT NULL")
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
                        "WHERE ar.audienceId IN :audienceIds AND ar.userId IS NOT NULL")
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
                        "WHERE ar.audienceId IN :audienceIds AND ar.userId IN :userIds AND ar.userId IS NOT NULL")
        List<String> findDistinctUserIdsByAudienceIdsAndUserIds(
                        @Param("audienceIds") List<String> audienceIds,
                        @Param("userIds") List<String> userIds);

        @Query("""
                            SELECT ar FROM AudienceResponse ar
                            JOIN Audience a ON a.id = ar.audienceId
                            WHERE a.instituteId = :instituteId
                            AND ar.audienceId = :audienceId
                            AND ar.workflowActivateDayAt >= :startDate AND ar.workflowActivateDayAt <= :endDate
                        """)
        List<AudienceResponse> findLeadsByAudienceAndDateRange(
                        @Param("instituteId") String instituteId,
                        @Param("audienceId") String audienceId,
                        @Param("startDate") Timestamp startDate,
                        @Param("endDate") Timestamp endDate);

        Optional<AudienceResponse> findFirstByStudentUserIdAndApplicantIdIsNotNull(String studentUserId);

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
}

