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
import java.util.Optional;

@Repository
public interface UserSessionRepository extends JpaRepository<UserSession, String> {

    // Find active sessions
    @Query("SELECT COUNT(DISTINCT u.userId) FROM UserSession u WHERE u.instituteId = :instituteId AND u.isActive = true AND u.lastActivityTime >= :cutoffTime")
    Long countActiveUsersInInstitute(@Param("instituteId") String instituteId, @Param("cutoffTime") LocalDateTime cutoffTime);

    @Query("SELECT u FROM UserSession u WHERE u.instituteId = :instituteId AND u.isActive = true AND u.lastActivityTime >= :cutoffTime")
    List<UserSession> findActiveSessionsInInstitute(@Param("instituteId") String instituteId, @Param("cutoffTime") LocalDateTime cutoffTime);

    // Find user's active sessions
    @Query("SELECT u FROM UserSession u WHERE u.userId = :userId AND u.isActive = true ORDER BY u.lastActivityTime DESC")
    List<UserSession> findActiveSessionsByUserId(@Param("userId") String userId);

    // Find session by token
    Optional<UserSession> findBySessionTokenAndIsActive(String sessionToken, Boolean isActive);

    // Update last activity time
    @Modifying
    @Transactional
    @Query("UPDATE UserSession u SET u.lastActivityTime = :activityTime WHERE u.sessionToken = :sessionToken AND u.isActive = true")
    void updateLastActivityTime(@Param("sessionToken") String sessionToken, @Param("activityTime") LocalDateTime activityTime);

    // End session
    @Modifying
    @Transactional
    @Query("UPDATE UserSession u SET u.isActive = false, u.logoutTime = :logoutTime WHERE u.sessionToken = :sessionToken")
    void endSession(@Param("sessionToken") String sessionToken, @Param("logoutTime") LocalDateTime logoutTime);

    // End inactive sessions
    @Modifying
    @Transactional
    @Query("UPDATE UserSession u SET u.isActive = false, u.logoutTime = :logoutTime WHERE u.isActive = true AND u.lastActivityTime < :cutoffTime")
    void endInactiveSessions(@Param("cutoffTime") LocalDateTime cutoffTime, @Param("logoutTime") LocalDateTime logoutTime);

    // Analytics queries
    @Query("SELECT u.deviceType, COUNT(u) FROM UserSession u WHERE u.instituteId = :instituteId AND u.loginTime >= :startTime GROUP BY u.deviceType")
    List<Object[]> getDeviceUsageStats(@Param("instituteId") String instituteId, @Param("startTime") LocalDateTime startTime);

    @Query("SELECT AVG(u.sessionDurationMinutes) FROM UserSession u WHERE u.instituteId = :instituteId AND u.sessionDurationMinutes IS NOT NULL AND u.loginTime >= :startTime")
    Double getAverageSessionDuration(@Param("instituteId") String instituteId, @Param("startTime") LocalDateTime startTime);

    @Query("SELECT DATE(u.loginTime), COUNT(DISTINCT u.userId) FROM UserSession u WHERE u.instituteId = :instituteId AND u.loginTime >= :startTime GROUP BY DATE(u.loginTime) ORDER BY DATE(u.loginTime)")
    List<Object[]> getDailyUniqueLogins(@Param("instituteId") String instituteId, @Param("startTime") LocalDateTime startTime);

    // Real-time monitoring
    @Query("SELECT COUNT(u) FROM UserSession u WHERE u.instituteId = :instituteId AND u.isActive = true")
    Long countCurrentlyActiveUsers(@Param("instituteId") String instituteId);

    @Query("SELECT u.userId, u.lastActivityTime FROM UserSession u WHERE u.instituteId = :instituteId AND u.isActive = true ORDER BY u.lastActivityTime DESC")
    List<Object[]> getCurrentlyActiveUsersWithLastActivity(@Param("instituteId") String instituteId);

    // Session history for user
    List<UserSession> findByUserIdAndInstituteIdOrderByLoginTimeDesc(String userId, String instituteId);

    // Find sessions by login time range
    List<UserSession> findByLoginTimeBetween(LocalDateTime startTime, LocalDateTime endTime);
} 