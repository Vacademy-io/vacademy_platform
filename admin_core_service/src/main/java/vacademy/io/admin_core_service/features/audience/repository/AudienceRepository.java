package vacademy.io.admin_core_service.features.audience.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.audience.entity.Audience;

import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;

/**
 * Repository for Audience (Campaign) entities
 */
@Repository
public interface AudienceRepository extends JpaRepository<Audience, String> {

    /**
     * Find all campaigns for a specific institute
     */
    List<Audience> findByInstituteId(String instituteId);

    /**
     * Find all campaigns for a specific institute with status filter
     */
    List<Audience> findByInstituteIdAndStatus(String instituteId, String status);

    /**
     * Find campaign by ID and institute ID (for security/isolation)
     */
    Optional<Audience> findByIdAndInstituteId(String id, String instituteId);

    /**
     * Find campaign by institute ID and session ID (for manual applications)
     */
    Optional<Audience> findByInstituteIdAndSessionId(String instituteId, String sessionId);

    /**
     * Find active campaigns for an institute
     */
    @Query("SELECT a FROM Audience a " +
            "WHERE a.instituteId = :instituteId " +
            "AND a.status = 'ACTIVE' " +
            "AND (a.startDate IS NULL OR a.startDate <= :currentTime) " +
            "AND (a.endDate IS NULL OR a.endDate >= :currentTime)")
    List<Audience> findActiveAudiencesForInstitute(
            @Param("instituteId") String instituteId,
            @Param("currentTime") Timestamp currentTime);

    /**
     * Find campaigns with filters and pagination
     */
    @Query("""
                SELECT a FROM Audience a
                WHERE a.instituteId = :instituteId
                  AND (:status IS NULL OR a.status = :status)
                  AND (COALESCE(:campaignType, '') = '' OR
                       LOWER(a.campaignType) LIKE LOWER(CONCAT('%', :campaignType, '%')))
                  AND (COALESCE(:searchName, '') = '' OR
                       LOWER(a.campaignName) LIKE LOWER(CONCAT('%', :searchName, '%')))
                  AND (:startDateFromProvided = false OR a.startDate IS NULL OR a.startDate >= :startDateFrom)
                  AND (:startDateToProvided = false OR a.startDate IS NULL OR a.startDate <= :startDateTo)
                ORDER BY a.createdAt DESC
            """)
    Page<Audience> findAudiencesWithFilters(
            @Param("instituteId") String instituteId,
            @Param("status") String status,
            @Param("campaignType") String campaignType,
            @Param("searchName") String searchName,
            @Param("startDateFrom") Timestamp startDateFrom,
            @Param("startDateFromProvided") boolean startDateFromProvided,
            @Param("startDateTo") Timestamp startDateTo,
            @Param("startDateToProvided") boolean startDateToProvided,
            Pageable pageable);

    /**
     * Count campaigns by institute and status
     */
    Long countByInstituteIdAndStatus(String instituteId, String status);

    /**
     * Find all audience IDs for a specific institute
     */
    @Query("SELECT a.id FROM Audience a WHERE a.instituteId = :instituteId")
    List<String> findAllAudienceIdsByInstituteId(@Param("instituteId") String instituteId);

    /**
     * Find audience IDs with filters for combined users API
     */
    @Query("""
                SELECT a.id FROM Audience a
                WHERE a.instituteId = :instituteId
                  AND (COALESCE(:campaignName, '') = '' OR
                       LOWER(a.campaignName) LIKE LOWER(CONCAT('%', :campaignName, '%')))
                  AND (COALESCE(:status, '') = '' OR a.status = :status)
                  AND (COALESCE(:campaignType, '') = '' OR a.campaignType = :campaignType)
                  AND (:startDateFromProvided = false OR a.startDate IS NULL OR a.startDate >= :startDateFrom)
                  AND (:startDateToProvided = false OR a.startDate IS NULL OR a.startDate <= :startDateTo)
            """)
    List<String> findAudienceIdsWithFilters(
            @Param("instituteId") String instituteId,
            @Param("campaignName") String campaignName,
            @Param("status") String status,
            @Param("campaignType") String campaignType,
            @Param("startDateFrom") Timestamp startDateFrom,
            @Param("startDateFromProvided") boolean startDateFromProvided,
            @Param("startDateTo") Timestamp startDateTo,
            @Param("startDateToProvided") boolean startDateToProvided);

    /**
     * Get center heatmap data by fetching audience campaigns and their response
     * counts
     * 
     * @param instituteId Institute ID to filter audiences
     * @param startDate   Optional start date filter (empty string for no filter)
     * @param endDate     Optional end date filter (empty string for no filter)
     * @param status      Optional status filter (empty string for all statuses)
     * @return List of Object arrays containing:
     *         [0] audience_id (String)
     *         [1] campaign_name (String)
     *         [2] campaign_type (String)
     *         [3] description (String)
     *         [4] campaign_objective (String)
     *         [5] status (String)
     *         [6] start_date (Timestamp)
     *         [7] end_date (Timestamp)
     *         [8] unique_users (Long)
     *         [9] total_responses (Long)
     */
    @Query(value = """
            SELECT
                a.id,
                a.campaign_name,
                a.campaign_type,
                a.description,
                a.campaign_objective,
                a.status,
                a.start_date,
                a.end_date,
                COUNT(DISTINCT ar.user_id) as unique_users,
                COUNT(ar.id) as total_responses
            FROM audience a
            LEFT JOIN audience_response ar ON ar.audience_id = a.id
                AND (COALESCE(:startDate, '') = '' OR ar.created_at >= CAST(:startDate AS TIMESTAMP))
                AND (COALESCE(:endDate, '') = '' OR ar.created_at <= CAST(:endDate AS TIMESTAMP))
            WHERE a.institute_id = :instituteId
                AND (COALESCE(:status, '') = '' OR a.status = :status)
            GROUP BY a.id, a.campaign_name, a.campaign_type, a.description,
                     a.campaign_objective, a.status, a.start_date, a.end_date
            ORDER BY COUNT(ar.id) DESC
            """, nativeQuery = true)
    List<Object[]> getCenterHeatmapByInstitute(
            @Param("instituteId") String instituteId,
            @Param("startDate") String startDate,
            @Param("endDate") String endDate,
            @Param("status") String status);
}
