package vacademy.io.common.auth.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.common.auth.entity.UserSession;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface UserSessionRepository extends JpaRepository<UserSession, String> {

       // Find active sessions - Cast UUID column to TEXT for comparison with VARCHAR
       // parameter
       @Query(value = "SELECT COUNT(DISTINCT u.user_id) FROM user_session u WHERE CAST(u.institute_id AS TEXT) = :instituteId AND u.is_active = true AND u.last_activity_time >= :cutoffTime", nativeQuery = true)
       Long countActiveUsersInInstitute(@Param("instituteId") String instituteId,
                     @Param("cutoffTime") LocalDateTime cutoffTime);

       @Query(value = "SELECT * FROM user_session u WHERE CAST(u.institute_id AS TEXT) = :instituteId AND u.is_active = true AND u.last_activity_time >= :cutoffTime", nativeQuery = true)
       List<UserSession> findActiveSessionsInInstitute(@Param("instituteId") String instituteId,
                     @Param("cutoffTime") LocalDateTime cutoffTime);

       // Find user's active sessions
       @Query("SELECT u FROM UserSession u WHERE u.userId = :userId AND u.isActive = true ORDER BY u.lastActivityTime DESC")
       List<UserSession> findActiveSessionsByUserId(@Param("userId") String userId);

       // Find session by token
       List<UserSession> findBySessionTokenAndIsActive(String sessionToken, Boolean isActive);

       // Update last activity time
       @Modifying
       @Transactional
       @Query("UPDATE UserSession u SET u.lastActivityTime = :activityTime WHERE u.sessionToken = :sessionToken AND u.isActive = true")
       void updateLastActivityTime(@Param("sessionToken") String sessionToken,
                     @Param("activityTime") LocalDateTime activityTime);

       // End session
       @Modifying
       @Transactional
       @Query("UPDATE UserSession u SET u.isActive = false, u.logoutTime = :logoutTime WHERE u.sessionToken = :sessionToken")
       void endSession(@Param("sessionToken") String sessionToken, @Param("logoutTime") LocalDateTime logoutTime);

       // End inactive sessions
       @Modifying
       @Transactional
       @Query("UPDATE UserSession u SET u.isActive = false, u.logoutTime = :logoutTime WHERE u.isActive = true AND u.lastActivityTime < :cutoffTime")
       void endInactiveSessions(@Param("cutoffTime") LocalDateTime cutoffTime,
                     @Param("logoutTime") LocalDateTime logoutTime);

       // Analytics queries - Cast UUID column to TEXT for comparison with VARCHAR
       // parameter
       @Query(value = "SELECT u.device_type, COUNT(u.*) FROM user_session u WHERE CAST(u.institute_id AS TEXT) = :instituteId AND u.login_time >= :startTime GROUP BY u.device_type", nativeQuery = true)
       List<Object[]> getDeviceUsageStats(@Param("instituteId") String instituteId,
                     @Param("startTime") LocalDateTime startTime);

       @Query(value = "SELECT AVG(u.session_duration_minutes) FROM user_session u WHERE CAST(u.institute_id AS TEXT) = :instituteId AND u.session_duration_minutes IS NOT NULL AND u.login_time >= :startTime", nativeQuery = true)
       Double getAverageSessionDuration(@Param("instituteId") String instituteId,
                     @Param("startTime") LocalDateTime startTime);

       @Query(value = "SELECT DATE(u.login_time), COUNT(DISTINCT u.user_id) FROM user_session u WHERE CAST(u.institute_id AS TEXT) = :instituteId AND u.login_time >= :startTime GROUP BY DATE(u.login_time) ORDER BY DATE(u.login_time)", nativeQuery = true)
       List<Object[]> getDailyUniqueLogins(@Param("instituteId") String instituteId,
                     @Param("startTime") LocalDateTime startTime);

       // Real-time monitoring - Cast UUID column to TEXT for comparison with VARCHAR
       // parameter
       @Query(value = "SELECT COUNT(u.*) FROM user_session u WHERE CAST(u.institute_id AS TEXT) = :instituteId AND u.is_active = true", nativeQuery = true)
       Long countCurrentlyActiveUsers(@Param("instituteId") String instituteId);

       @Query(value = "SELECT u.user_id, u.last_activity_time FROM user_session u WHERE CAST(u.institute_id AS TEXT) = :instituteId AND u.is_active = true ORDER BY u.last_activity_time DESC", nativeQuery = true)
       List<Object[]> getCurrentlyActiveUsersWithLastActivity(@Param("instituteId") String instituteId);

       // Session history for user
       List<UserSession> findByUserIdAndInstituteIdOrderByLoginTimeDesc(String userId, String instituteId);

       // Find sessions by login time range
       List<UserSession> findByLoginTimeBetween(LocalDateTime startTime, LocalDateTime endTime);

       // Student analysis queries - get login statistics for specific user and date
       // range
       @Query("SELECT COUNT(u) FROM UserSession u WHERE u.userId = :userId AND u.loginTime BETWEEN :startTime AND :endTime")
       Long countTotalLoginsByUserAndDateRange(@Param("userId") String userId,
                     @Param("startTime") LocalDateTime startTime,
                     @Param("endTime") LocalDateTime endTime);

       @Query("SELECT MAX(u.loginTime) FROM UserSession u WHERE u.userId = :userId AND u.loginTime BETWEEN :startTime AND :endTime")
       LocalDateTime findLastLoginTimeByUserAndDateRange(@Param("userId") String userId,
                     @Param("startTime") LocalDateTime startTime,
                     @Param("endTime") LocalDateTime endTime);

       @Query("SELECT AVG(u.sessionDurationMinutes) FROM UserSession u WHERE u.userId = :userId AND u.loginTime BETWEEN :startTime AND :endTime AND u.sessionDurationMinutes IS NOT NULL")
       Double findAvgSessionDurationByUserAndDateRange(@Param("userId") String userId,
                     @Param("startTime") LocalDateTime startTime,
                     @Param("endTime") LocalDateTime endTime);

       @Query("SELECT COALESCE(SUM(u.sessionDurationMinutes), 0) FROM UserSession u WHERE u.userId = :userId AND u.loginTime BETWEEN :startTime AND :endTime AND u.sessionDurationMinutes IS NOT NULL")
       Long findTotalActiveTimeByUserAndDateRange(@Param("userId") String userId,
                     @Param("startTime") LocalDateTime startTime,
                     @Param("endTime") LocalDateTime endTime);
}