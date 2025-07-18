package vacademy.io.common.auth.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.common.auth.entity.UserActivityLog;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface UserActivityLogRepository extends JpaRepository<UserActivityLog, String> {

    // Activity count queries
    @Query("SELECT COUNT(DISTINCT u.userId) FROM UserActivityLog u WHERE u.instituteId = :instituteId AND u.createdAt >= :startTime")
    Long countActiveUsersInInstituteSince(@Param("instituteId") String instituteId, @Param("startTime") LocalDateTime startTime);

    @Query("SELECT COUNT(u) FROM UserActivityLog u WHERE u.instituteId = :instituteId AND u.createdAt >= :startTime")
    Long countActivityInInstituteSince(@Param("instituteId") String instituteId, @Param("startTime") LocalDateTime startTime);

    // Service usage analytics
    @Query("SELECT u.serviceName, COUNT(u) FROM UserActivityLog u WHERE u.instituteId = :instituteId AND u.createdAt >= :startTime GROUP BY u.serviceName ORDER BY COUNT(u) DESC")
    List<Object[]> getServiceUsageStats(@Param("instituteId") String instituteId, @Param("startTime") LocalDateTime startTime);

    // Peak hours analysis
    @Query("SELECT HOUR(u.createdAt), COUNT(u) FROM UserActivityLog u WHERE u.instituteId = :instituteId AND u.createdAt >= :startTime GROUP BY HOUR(u.createdAt) ORDER BY COUNT(u) DESC")
    List<Object[]> getPeakHoursActivity(@Param("instituteId") String instituteId, @Param("startTime") LocalDateTime startTime);

    // Most active users
    @Query("SELECT u.userId, COUNT(u) FROM UserActivityLog u WHERE u.instituteId = :instituteId AND u.createdAt >= :startTime GROUP BY u.userId ORDER BY COUNT(u) DESC")
    List<Object[]> getMostActiveUsers(@Param("instituteId") String instituteId, @Param("startTime") LocalDateTime startTime);

    // User activity timeline
    @Query("SELECT u FROM UserActivityLog u WHERE u.userId = :userId AND u.instituteId = :instituteId AND u.createdAt >= :startTime ORDER BY u.createdAt DESC")
    List<UserActivityLog> getUserActivityTimeline(@Param("userId") String userId, @Param("instituteId") String instituteId, @Param("startTime") LocalDateTime startTime);

    // Device type analytics
    @Query("SELECT u.deviceType, COUNT(DISTINCT u.userId) FROM UserActivityLog u WHERE u.instituteId = :instituteId AND u.createdAt >= :startTime GROUP BY u.deviceType")
    List<Object[]> getDeviceTypeUsage(@Param("instituteId") String instituteId, @Param("startTime") LocalDateTime startTime);

    // Daily activity trends
    @Query("SELECT DATE(u.createdAt), COUNT(DISTINCT u.userId) FROM UserActivityLog u WHERE u.instituteId = :instituteId AND u.createdAt >= :startTime GROUP BY DATE(u.createdAt) ORDER BY DATE(u.createdAt)")
    List<Object[]> getDailyActiveUsersTrend(@Param("instituteId") String instituteId, @Param("startTime") LocalDateTime startTime);

    // Response time analytics
    @Query("SELECT u.serviceName, AVG(u.responseTimeMs), COUNT(u) FROM UserActivityLog u WHERE u.instituteId = :instituteId AND u.createdAt >= :startTime AND u.responseTimeMs IS NOT NULL GROUP BY u.serviceName")
    List<Object[]> getServicePerformanceStats(@Param("instituteId") String instituteId, @Param("startTime") LocalDateTime startTime);

    // Find activities by user and time range
    List<UserActivityLog> findByUserIdAndInstituteIdAndCreatedAtBetween(String userId, String instituteId, LocalDateTime startTime, LocalDateTime endTime);

    // Find activities by institute and time range
    List<UserActivityLog> findByInstituteIdAndCreatedAtBetween(String instituteId, LocalDateTime startTime, LocalDateTime endTime);

    // Find activities by time range
    List<UserActivityLog> findByCreatedAtBetween(LocalDateTime startTime, LocalDateTime endTime);

    // Find activities before a certain time (for cleanup)
    List<UserActivityLog> findByCreatedAtBefore(LocalDateTime cutoffTime);
} 