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

    // Institute-wide analytics
    @Query("SELECT SUM(d.totalSessions), SUM(d.totalActivityTimeMinutes), SUM(d.totalApiCalls) " +
           "FROM DailyUserActivitySummary d WHERE d.instituteId = :instituteId AND d.activityDate = :date")
    Object[] getInstituteActivitySummaryForDate(@Param("instituteId") String instituteId, @Param("date") LocalDate date);

    @Query("SELECT COUNT(DISTINCT d.userId) FROM DailyUserActivitySummary d WHERE d.instituteId = :instituteId AND d.activityDate = :date")
    Long countActiveUsersForDate(@Param("instituteId") String instituteId, @Param("date") LocalDate date);

    // Trending data
    @Query("SELECT d.activityDate, COUNT(DISTINCT d.userId), SUM(d.totalSessions), SUM(d.totalApiCalls) " +
           "FROM DailyUserActivitySummary d WHERE d.instituteId = :instituteId AND d.activityDate BETWEEN :startDate AND :endDate " +
           "GROUP BY d.activityDate ORDER BY d.activityDate")
    List<Object[]> getActivityTrendData(@Param("instituteId") String instituteId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    // Most active users in date range
    @Query("SELECT d.userId, SUM(d.totalSessions), SUM(d.totalActivityTimeMinutes), SUM(d.totalApiCalls) " +
           "FROM DailyUserActivitySummary d WHERE d.instituteId = :instituteId AND d.activityDate BETWEEN :startDate AND :endDate " +
           "GROUP BY d.userId ORDER BY SUM(d.totalSessions) DESC")
    List<Object[]> getMostActiveUsersInDateRange(@Param("instituteId") String instituteId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    // Service usage trends
    @Query("SELECT d.servicesUsed FROM DailyUserActivitySummary d WHERE d.instituteId = :instituteId AND d.activityDate BETWEEN :startDate AND :endDate")
    List<String> getServicesUsedInDateRange(@Param("instituteId") String instituteId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    // Device usage trends
    @Query("SELECT d.deviceTypesUsed FROM DailyUserActivitySummary d WHERE d.instituteId = :instituteId AND d.activityDate BETWEEN :startDate AND :endDate")
    List<String> getDeviceTypesUsedInDateRange(@Param("instituteId") String instituteId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    // Average session duration trends
    @Query("SELECT d.activityDate, AVG(d.totalActivityTimeMinutes / CASE WHEN d.totalSessions = 0 THEN 1 ELSE d.totalSessions END) " +
           "FROM DailyUserActivitySummary d WHERE d.instituteId = :instituteId AND d.activityDate BETWEEN :startDate AND :endDate " +
           "GROUP BY d.activityDate ORDER BY d.activityDate")
    List<Object[]> getAverageSessionDurationTrend(@Param("instituteId") String instituteId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    // Peak activity hours
    @Query("SELECT d.peakActivityHour, COUNT(d) FROM DailyUserActivitySummary d WHERE d.instituteId = :instituteId AND d.activityDate BETWEEN :startDate AND :endDate " +
           "GROUP BY d.peakActivityHour ORDER BY COUNT(d) DESC")
    List<Object[]> getPeakActivityHours(@Param("instituteId") String instituteId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    // User engagement metrics
    @Query("SELECT COUNT(d) FROM DailyUserActivitySummary d WHERE d.instituteId = :instituteId AND d.userId = :userId AND d.activityDate BETWEEN :startDate AND :endDate")
    Long getUserEngagementDays(@Param("userId") String userId, @Param("instituteId") String instituteId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    // Get user activity summaries for date range
    List<DailyUserActivitySummary> findByInstituteIdAndActivityDateBetweenOrderByActivityDate(String instituteId, LocalDate startDate, LocalDate endDate);
    
    List<DailyUserActivitySummary> findByUserIdAndInstituteIdAndActivityDateBetweenOrderByActivityDate(String userId, String instituteId, LocalDate startDate, LocalDate endDate);
} 