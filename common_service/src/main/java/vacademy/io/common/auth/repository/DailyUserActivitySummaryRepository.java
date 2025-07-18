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

    // Find summary for specific user and date
    Optional<DailyUserActivitySummary> findByUserIdAndInstituteIdAndActivityDate(String userId, String instituteId, LocalDate activityDate);

    // Institute-wide analytics - Using native query with UUID casting
    @Query(value = "SELECT SUM(d.total_sessions), SUM(d.total_activity_time_minutes), SUM(d.total_api_calls) " +
           "FROM daily_user_activity_summary d WHERE d.institute_id = CAST(:instituteId AS UUID) AND d.activity_date = :date", 
           nativeQuery = true)
    Object[] getInstituteActivitySummaryForDate(@Param("instituteId") String instituteId, @Param("date") LocalDate date);

    @Query(value = "SELECT COUNT(DISTINCT d.user_id) FROM daily_user_activity_summary d WHERE d.institute_id = CAST(:instituteId AS UUID) AND d.activity_date = :date", 
           nativeQuery = true)
    Long countActiveUsersForDate(@Param("instituteId") String instituteId, @Param("date") LocalDate date);

    // Trending data - Using native query with UUID casting
    @Query(value = "SELECT d.activity_date, COUNT(DISTINCT d.user_id), SUM(d.total_sessions), SUM(d.total_api_calls) " +
           "FROM daily_user_activity_summary d WHERE d.institute_id = CAST(:instituteId AS UUID) AND d.activity_date BETWEEN :startDate AND :endDate " +
           "GROUP BY d.activity_date ORDER BY d.activity_date", 
           nativeQuery = true)
    List<Object[]> getActivityTrendData(@Param("instituteId") String instituteId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    // Most active users in date range - Using native query with UUID casting
    @Query(value = "SELECT d.user_id, SUM(d.total_sessions), SUM(d.total_activity_time_minutes), SUM(d.total_api_calls) " +
           "FROM daily_user_activity_summary d WHERE d.institute_id = CAST(:instituteId AS UUID) AND d.activity_date BETWEEN :startDate AND :endDate " +
           "GROUP BY d.user_id ORDER BY SUM(d.total_sessions) DESC", 
           nativeQuery = true)
    List<Object[]> getMostActiveUsersInDateRange(@Param("instituteId") String instituteId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    // Service usage trends - Using native query with UUID casting
    @Query(value = "SELECT d.services_used FROM daily_user_activity_summary d WHERE d.institute_id = CAST(:instituteId AS UUID) AND d.activity_date BETWEEN :startDate AND :endDate", 
           nativeQuery = true)
    List<String> getServicesUsedInDateRange(@Param("instituteId") String instituteId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    // Device usage trends - Using native query with UUID casting
    @Query(value = "SELECT d.device_types_used FROM daily_user_activity_summary d WHERE d.institute_id = CAST(:instituteId AS UUID) AND d.activity_date BETWEEN :startDate AND :endDate", 
           nativeQuery = true)
    List<String> getDeviceTypesUsedInDateRange(@Param("instituteId") String instituteId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    // Average session duration trends - Using native query with UUID casting
    @Query(value = "SELECT d.activity_date, AVG(d.total_activity_time_minutes / CASE WHEN d.total_sessions = 0 THEN 1 ELSE d.total_sessions END) " +
           "FROM daily_user_activity_summary d WHERE d.institute_id = CAST(:instituteId AS UUID) AND d.activity_date BETWEEN :startDate AND :endDate " +
           "GROUP BY d.activity_date ORDER BY d.activity_date", 
           nativeQuery = true)
    List<Object[]> getAverageSessionDurationTrend(@Param("instituteId") String instituteId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    // Peak activity hours - Using native query with UUID casting
    @Query(value = "SELECT d.peak_activity_hour, COUNT(d.*) FROM daily_user_activity_summary d WHERE d.institute_id = CAST(:instituteId AS UUID) AND d.activity_date BETWEEN :startDate AND :endDate " +
           "GROUP BY d.peak_activity_hour ORDER BY COUNT(d.*) DESC", 
           nativeQuery = true)
    List<Object[]> getPeakActivityHours(@Param("instituteId") String instituteId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    // User engagement metrics - Using native query with UUID casting
    @Query(value = "SELECT COUNT(d.*) FROM daily_user_activity_summary d WHERE d.institute_id = CAST(:instituteId AS UUID) AND d.user_id = :userId AND d.activity_date BETWEEN :startDate AND :endDate", 
           nativeQuery = true)
    Long getUserEngagementDays(@Param("userId") String userId, @Param("instituteId") String instituteId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    // Get user activity summaries for date range
    List<DailyUserActivitySummary> findByInstituteIdAndActivityDateBetweenOrderByActivityDate(String instituteId, LocalDate startDate, LocalDate endDate);
    
    List<DailyUserActivitySummary> findByUserIdAndInstituteIdAndActivityDateBetweenOrderByActivityDate(String userId, String instituteId, LocalDate startDate, LocalDate endDate);
} 