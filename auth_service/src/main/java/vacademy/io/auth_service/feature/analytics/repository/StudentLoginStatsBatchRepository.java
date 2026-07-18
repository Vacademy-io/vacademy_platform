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
        // NATIVE + CAST, not JPQL: daily_user_activity_summary.user_id is a UUID column, but the
        // entity field (and every caller) is String — so JPQL "d.userId IN :userIds" bound the
        // Strings as varchar and Postgres threw "operator does not exist: uuid = character varying"
        // at EXECUTION (a compile-clean, run-fatal type mismatch; user_session.user_id is varchar,
        // which is why the sibling login query above does NOT hit this). CAST(user_id AS varchar)
        // makes both sides varchar. SQL-standard cast() — never "::varchar", which Spring Data would
        // mangle to a ":varchar" named-parameter. Returns [0]=userId(String), [1]=minutes.
        @Query(value = """
                        SELECT CAST(d.user_id AS varchar), COALESCE(SUM(d.total_activity_time_minutes), 0)
                          FROM daily_user_activity_summary d
                         WHERE CAST(d.user_id AS varchar) IN (:userIds)
                           AND d.activity_date >= :sinceDate
                         GROUP BY CAST(d.user_id AS varchar)
                        """, nativeQuery = true)
        List<Object[]> findActivityMinutesByUserIdsSince(
                        @Param("userIds") Collection<String> userIds,
                        @Param("sinceDate") LocalDate sinceDate);
}
