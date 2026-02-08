package vacademy.io.admin_core_service.features.ai_usage.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.ai_usage.entity.AiTokenUsage;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Repository for AI token usage records.
 */
@Repository
public interface AiTokenUsageRepository extends JpaRepository<AiTokenUsage, UUID> {

    /**
     * Find usage records by institute ID.
     */
    List<AiTokenUsage> findByInstituteIdOrderByCreatedAtDesc(UUID instituteId);

    /**
     * Find usage records by user ID.
     */
    List<AiTokenUsage> findByUserIdOrderByCreatedAtDesc(UUID userId);

    /**
     * Find usage records by institute and date range.
     */
    @Query("SELECT u FROM AiTokenUsage u WHERE u.instituteId = :instituteId " +
            "AND u.createdAt >= :startDate AND u.createdAt <= :endDate " +
            "ORDER BY u.createdAt DESC")
    List<AiTokenUsage> findByInstituteIdAndDateRange(
            @Param("instituteId") UUID instituteId,
            @Param("startDate") ZonedDateTime startDate,
            @Param("endDate") ZonedDateTime endDate);

    /**
     * Find usage records by user and date range.
     */
    @Query("SELECT u FROM AiTokenUsage u WHERE u.userId = :userId " +
            "AND u.createdAt >= :startDate AND u.createdAt <= :endDate " +
            "ORDER BY u.createdAt DESC")
    List<AiTokenUsage> findByUserIdAndDateRange(
            @Param("userId") UUID userId,
            @Param("startDate") ZonedDateTime startDate,
            @Param("endDate") ZonedDateTime endDate);

    /**
     * Get total tokens used by institute in a date range.
     */
    @Query("SELECT COALESCE(SUM(u.totalTokens), 0) FROM AiTokenUsage u " +
            "WHERE u.instituteId = :instituteId " +
            "AND u.createdAt >= :startDate AND u.createdAt <= :endDate")
    Long getTotalTokensByInstituteAndDateRange(
            @Param("instituteId") UUID instituteId,
            @Param("startDate") ZonedDateTime startDate,
            @Param("endDate") ZonedDateTime endDate);

    /**
     * Get total tokens used by user in a date range.
     */
    @Query("SELECT COALESCE(SUM(u.totalTokens), 0) FROM AiTokenUsage u " +
            "WHERE u.userId = :userId " +
            "AND u.createdAt >= :startDate AND u.createdAt <= :endDate")
    Long getTotalTokensByUserAndDateRange(
            @Param("userId") UUID userId,
            @Param("startDate") ZonedDateTime startDate,
            @Param("endDate") ZonedDateTime endDate);
}
