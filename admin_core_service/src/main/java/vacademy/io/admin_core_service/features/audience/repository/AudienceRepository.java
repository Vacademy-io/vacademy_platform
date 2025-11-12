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
     * Find active campaigns for an institute
     */
    @Query("SELECT a FROM Audience a " +
           "WHERE a.instituteId = :instituteId " +
           "AND a.status = 'ACTIVE' " +
           "AND (a.startDate IS NULL OR a.startDate <= :currentTime) " +
           "AND (a.endDate IS NULL OR a.endDate >= :currentTime)")
    List<Audience> findActiveAudiencesForInstitute(
            @Param("instituteId") String instituteId,
            @Param("currentTime") Timestamp currentTime
    );

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
            Pageable pageable
    );

    /**
     * Count campaigns by institute and status
     */
    Long countByInstituteIdAndStatus(String instituteId, String status);
}

