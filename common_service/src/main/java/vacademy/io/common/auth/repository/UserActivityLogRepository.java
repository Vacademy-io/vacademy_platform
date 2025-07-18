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

    // Activity count queries - Using native query (institute_id is VARCHAR, not UUID)
    @Query(value = "SELECT COUNT(DISTINCT u.user_id) FROM user_activity_log u WHERE u.institute_id = :instituteId AND u.created_at >= :startTime", 
           nativeQuery = true)
    Long countActiveUsersInInstituteSince(@Param("instituteId") String instituteId, @Param("startTime") LocalDateTime startTime);

    @Query(value = "SELECT COUNT(u.*) FROM user_activity_log u WHERE u.institute_id = :instituteId AND u.created_at >= :startTime", 
           nativeQuery = true)
    Long countActivityInInstituteSince(@Param("instituteId") String instituteId, @Param("startTime") LocalDateTime startTime);

    // Service usage analytics - Using native query (institute_id is VARCHAR, not UUID)
    @Query(value = "SELECT u.service_name, COUNT(u.*) FROM user_activity_log u WHERE u.institute_id = :instituteId AND u.created_at >= :startTime GROUP BY u.service_name ORDER BY COUNT(u.*) DESC", 
           nativeQuery = true)
    List<Object[]> getServiceUsageStats(@Param("instituteId") String instituteId, @Param("startTime") LocalDateTime startTime);

    // Peak hours analysis - Using native query (institute_id is VARCHAR, not UUID)
    @Query(value = "SELECT EXTRACT(HOUR FROM u.created_at), COUNT(u.*) FROM user_activity_log u WHERE u.institute_id = :instituteId AND u.created_at >= :startTime GROUP BY EXTRACT(HOUR FROM u.created_at) ORDER BY COUNT(u.*) DESC", 
           nativeQuery = true)
    List<Object[]> getPeakHoursActivity(@Param("instituteId") String instituteId, @Param("startTime") LocalDateTime startTime);

    // Most active users - Using native query (institute_id is VARCHAR, not UUID)
    @Query(value = "SELECT u.user_id, COUNT(u.*) FROM user_activity_log u WHERE u.institute_id = :instituteId AND u.created_at >= :startTime GROUP BY u.user_id ORDER BY COUNT(u.*) DESC", 
           nativeQuery = true)
    List<Object[]> getMostActiveUsers(@Param("instituteId") String instituteId, @Param("startTime") LocalDateTime startTime);

    // User activity timeline - Using native query (institute_id is VARCHAR, not UUID)
    @Query(value = "SELECT * FROM user_activity_log u WHERE u.user_id = :userId AND u.institute_id = :instituteId AND u.created_at >= :startTime ORDER BY u.created_at DESC", 
           nativeQuery = true)
    List<UserActivityLog> getUserActivityTimeline(@Param("userId") String userId, @Param("instituteId") String instituteId, @Param("startTime") LocalDateTime startTime);

    // Device type analytics - Using native query (institute_id is VARCHAR, not UUID)
    @Query(value = "SELECT u.device_type, COUNT(DISTINCT u.user_id) FROM user_activity_log u WHERE u.institute_id = :instituteId AND u.created_at >= :startTime GROUP BY u.device_type", 
           nativeQuery = true)
    List<Object[]> getDeviceTypeUsage(@Param("instituteId") String instituteId, @Param("startTime") LocalDateTime startTime);

    // Daily activity trends - Using native query (institute_id is VARCHAR, not UUID)
    @Query(value = "SELECT DATE(u.created_at), COUNT(DISTINCT u.user_id) FROM user_activity_log u WHERE u.institute_id = :instituteId AND u.created_at >= :startTime GROUP BY DATE(u.created_at) ORDER BY DATE(u.created_at)", 
           nativeQuery = true)
    List<Object[]> getDailyActiveUsersTrend(@Param("instituteId") String instituteId, @Param("startTime") LocalDateTime startTime);

    // Response time analytics - Using native query (institute_id is VARCHAR, not UUID)
    @Query(value = "SELECT u.service_name, AVG(u.response_time_ms), COUNT(u.*) FROM user_activity_log u WHERE u.institute_id = :instituteId AND u.created_at >= :startTime AND u.response_time_ms IS NOT NULL GROUP BY u.service_name", 
           nativeQuery = true)
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