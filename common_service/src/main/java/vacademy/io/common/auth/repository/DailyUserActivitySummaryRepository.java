package vacademy.io.common.auth.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.common.auth.entity.DailyUserActivitySummary;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface DailyUserActivitySummaryRepository extends JpaRepository<DailyUserActivitySummary, String> {

    // Find summary for specific user and date - Cast UUID column to TEXT for comparison with VARCHAR parameter
    @Query(value = "SELECT * FROM daily_user_activity_summary d WHERE d.user_id = :userId AND CAST(d.institute_id AS TEXT) = :instituteId AND d.activity_date = :activityDate", 
           nativeQuery = true)
    Optional<DailyUserActivitySummary> findByUserIdAndInstituteIdAndActivityDate(@Param("userId") String userId, @Param("instituteId") String instituteId, @Param("activityDate") LocalDate activityDate);

    // Institute-wide analytics - Cast UUID column to TEXT for comparison with VARCHAR parameter
    @Query(value = "SELECT SUM(d.total_sessions), SUM(d.total_activity_time_minutes), SUM(d.total_api_calls) " +
           "FROM daily_user_activity_summary d WHERE CAST(d.institute_id AS TEXT) = :instituteId AND d.activity_date = :date", 
           nativeQuery = true)
    Object[] getInstituteActivitySummaryForDate(@Param("instituteId") String instituteId, @Param("date") LocalDate date);

    @Query(value = "SELECT COUNT(DISTINCT d.user_id) FROM daily_user_activity_summary d WHERE CAST(d.institute_id AS TEXT) = :instituteId AND d.activity_date = :date", 
           nativeQuery = true)
    Long countActiveUsersForDate(@Param("instituteId") String instituteId, @Param("date") LocalDate date);

    // Trending data - Cast UUID column to TEXT for comparison with VARCHAR parameter
    @Query(value = "SELECT d.activity_date, COUNT(DISTINCT d.user_id), SUM(d.total_sessions), SUM(d.total_api_calls) " +
           "FROM daily_user_activity_summary d WHERE CAST(d.institute_id AS TEXT) = :instituteId AND d.activity_date BETWEEN :startDate AND :endDate " +
           "GROUP BY d.activity_date ORDER BY d.activity_date", 
           nativeQuery = true)
    List<Object[]> getActivityTrendData(@Param("instituteId") String instituteId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    // Most active users in date range - Cast UUID column to TEXT for comparison with VARCHAR parameter
    @Query(value = "SELECT d.user_id, SUM(d.total_sessions), SUM(d.total_activity_time_minutes), SUM(d.total_api_calls) " +
           "FROM daily_user_activity_summary d WHERE CAST(d.institute_id AS TEXT) = :instituteId AND d.activity_date BETWEEN :startDate AND :endDate " +
           "GROUP BY d.user_id ORDER BY SUM(d.total_sessions) DESC", 
           nativeQuery = true)
    List<Object[]> getMostActiveUsersInDateRange(@Param("instituteId") String instituteId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    // Service usage trends - Cast UUID column to TEXT for comparison with VARCHAR parameter
    @Query(value = "SELECT d.services_used FROM daily_user_activity_summary d WHERE CAST(d.institute_id AS TEXT) = :instituteId AND d.activity_date BETWEEN :startDate AND :endDate", 
           nativeQuery = true)
    List<String> getServicesUsedInDateRange(@Param("instituteId") String instituteId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    // Device usage trends - Cast UUID column to TEXT for comparison with VARCHAR parameter
    @Query(value = "SELECT d.device_types_used FROM daily_user_activity_summary d WHERE CAST(d.institute_id AS TEXT) = :instituteId AND d.activity_date BETWEEN :startDate AND :endDate", 
           nativeQuery = true)
    List<String> getDeviceTypesUsedInDateRange(@Param("instituteId") String instituteId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    // Average session duration trends - Cast UUID column to TEXT for comparison with VARCHAR parameter
    @Query(value = "SELECT d.activity_date, AVG(d.total_activity_time_minutes / CASE WHEN d.total_sessions = 0 THEN 1 ELSE d.total_sessions END) " +
           "FROM daily_user_activity_summary d WHERE CAST(d.institute_id AS TEXT) = :instituteId AND d.activity_date BETWEEN :startDate AND :endDate " +
           "GROUP BY d.activity_date ORDER BY d.activity_date", 
           nativeQuery = true)
    List<Object[]> getAverageSessionDurationTrend(@Param("instituteId") String instituteId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    // Peak activity hours - Cast UUID column to TEXT for comparison with VARCHAR parameter
    @Query(value = "SELECT d.peak_activity_hour, COUNT(d.*) FROM daily_user_activity_summary d WHERE CAST(d.institute_id AS TEXT) = :instituteId AND d.activity_date BETWEEN :startDate AND :endDate " +
           "GROUP BY d.peak_activity_hour ORDER BY COUNT(d.*) DESC", 
           nativeQuery = true)
    List<Object[]> getPeakActivityHours(@Param("instituteId") String instituteId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    // User engagement metrics - Cast UUID column to TEXT for comparison with VARCHAR parameter
    @Query(value = "SELECT COUNT(d.*) FROM daily_user_activity_summary d WHERE CAST(d.institute_id AS TEXT) = :instituteId AND d.user_id = :userId AND d.activity_date BETWEEN :startDate AND :endDate", 
           nativeQuery = true)
    Long getUserEngagementDays(@Param("userId") String userId, @Param("instituteId") String instituteId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    // Get user activity summaries for date range - Cast UUID column to TEXT for comparison with VARCHAR parameter
    @Query(value = "SELECT * FROM daily_user_activity_summary d WHERE CAST(d.institute_id AS TEXT) = :instituteId AND d.activity_date BETWEEN :startDate AND :endDate ORDER BY d.activity_date", 
           nativeQuery = true)
    List<DailyUserActivitySummary> findByInstituteIdAndActivityDateBetweenOrderByActivityDate(@Param("instituteId") String instituteId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);
    
    @Query(value = "SELECT * FROM daily_user_activity_summary d WHERE d.user_id = :userId AND CAST(d.institute_id AS TEXT) = :instituteId AND d.activity_date BETWEEN :startDate AND :endDate ORDER BY d.activity_date", 
           nativeQuery = true)
    List<DailyUserActivitySummary> findByUserIdAndInstituteIdAndActivityDateBetweenOrderByActivityDate(@Param("userId") String userId, @Param("instituteId") String instituteId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);
} 