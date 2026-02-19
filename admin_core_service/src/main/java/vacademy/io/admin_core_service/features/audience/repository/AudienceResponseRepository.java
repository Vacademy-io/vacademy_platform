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
         * Find leads with filters and pagination
         */
        @Query(value = """
                            SELECT * FROM audience_response ar
                            WHERE ar.audience_id = :audienceId
                              AND (COALESCE(:sourceType, '') = '' OR ar.source_type = :sourceType)
                              AND (COALESCE(:sourceId, '') = '' OR ar.source_id = :sourceId)
                              AND (CAST(:submittedFrom AS timestamp) IS NULL OR ar.submitted_at >= CAST(:submittedFrom AS timestamp))
                              AND (CAST(:submittedTo AS timestamp) IS NULL OR ar.submitted_at <= CAST(:submittedTo AS timestamp))
                            ORDER BY ar.submitted_at DESC
                        """, countQuery = """
                            SELECT COUNT(*) FROM audience_response ar
                            WHERE ar.audience_id = :audienceId
                              AND (COALESCE(:sourceType, '') = '' OR ar.source_type = :sourceType)
                              AND (COALESCE(:sourceId, '') = '' OR ar.source_id = :sourceId)
                              AND (CAST(:submittedFrom AS timestamp) IS NULL OR ar.submitted_at >= CAST(:submittedFrom AS timestamp))
                              AND (CAST(:submittedTo AS timestamp) IS NULL OR ar.submitted_at <= CAST(:submittedTo AS timestamp))
                        """, nativeQuery = true)
        Page<AudienceResponse> findLeadsWithFilters(
                        @Param("audienceId") String audienceId,
                        @Param("sourceType") String sourceType,
                        @Param("sourceId") String sourceId,
                        @Param("submittedFrom") Timestamp submittedFrom,
                        @Param("submittedTo") Timestamp submittedTo,
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
}
