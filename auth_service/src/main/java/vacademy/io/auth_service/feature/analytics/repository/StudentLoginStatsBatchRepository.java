package vacademy.io.auth_service.feature.analytics.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.common.auth.entity.UserSession;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

/**
 * Batched (GROUP BY user_id) analytics queries for the internal
 * student-login-stats batch endpoint. Lives in auth_service (auth DB owns
 * user_session / daily_user_activity_summary) so common_service stays
 * untouched.
 *
 * Login source: user_session.login_time — same source the single-user
 * /auth-service/analytics/student-login-stats endpoint uses
 * (UserSessionRepository.countTotalLoginsByUserAndDateRange /
 * findLastLoginTimeByUserAndDateRange).
 */
@Repository
public interface StudentLoginStatsBatchRepository extends JpaRepository<UserSession, String> {

        /**
         * Per-user login count and most recent login within the window, for the whole
         * cohort in one query. Rows: [0]=userId (String), [1]=loginCount (Long),
         * [2]=lastLoginTime (LocalDateTime).
         */
        @Query("SELECT u.userId, COUNT(u), MAX(u.loginTime) FROM UserSession u " +
                        "WHERE u.userId IN :userIds AND u.loginTime >= :since " +
                        "GROUP BY u.userId")
        List<Object[]> findLoginAggregatesByUserIdsSince(
                        @Param("userIds") Collection<String> userIds,
                        @Param("since") LocalDateTime since);

        /**
         * Per-user total activity minutes within the window from
         * daily_user_activity_summary, for the whole cohort in one query.
         * Rows: [0]=userId (String), [1]=totalActivityMinutes (Long).
         */
        @Query("SELECT d.userId, COALESCE(SUM(d.totalActivityTimeMinutes), 0) FROM DailyUserActivitySummary d " +
                        "WHERE d.userId IN :userIds AND d.activityDate >= :sinceDate " +
                        "GROUP BY d.userId")
        List<Object[]> findActivityMinutesByUserIdsSince(
                        @Param("userIds") Collection<String> userIds,
                        @Param("sinceDate") LocalDate sinceDate);
}
