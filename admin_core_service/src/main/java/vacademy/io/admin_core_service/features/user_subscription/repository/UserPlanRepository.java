package vacademy.io.admin_core_service.features.user_subscription.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;

import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;

public interface UserPlanRepository extends JpaRepository<UserPlan, String> {
    @Query(value = """
                SELECT DISTINCT up FROM UserPlan up
                JOIN FETCH up.enrollInvite ei
                LEFT JOIN FETCH up.paymentOption po
                LEFT JOIN FETCH up.paymentPlan pp
                WHERE up.userId = :userId
                  AND ei.instituteId = :instituteId
                  AND (:statuses IS NULL OR up.status IN :statuses)
            """, countQuery = """
                SELECT COUNT(up) FROM UserPlan up
                JOIN up.enrollInvite ei
                WHERE up.userId = :userId
                  AND ei.instituteId = :instituteId
                  AND (:statuses IS NULL OR up.status IN :statuses)
            """)
    Page<UserPlan> findByUserIdAndInstituteIdWithFilters(
            @Param("userId") String userId,
            @Param("instituteId") String instituteId,
            @Param("statuses") List<String> statuses,
            Pageable pageable);

    Optional<UserPlan> findFirstByUserIdAndEnrollInviteIdAndCreatedAtAfterOrderByCreatedAtAsc(
            String userId,
            String enrollInviteId,
            LocalDateTime createdAt);

    @Query(value = """
                SELECT up.id,
                       CASE
                           WHEN up.end_date IS NULL THEN 'LIFETIME'
                           WHEN up.end_date < CURRENT_TIMESTAMP THEN 'ENDED'
                           ELSE 'ABOUT_TO_END'
                       END as computedStatus,
                       up.end_date as actualEndDate
                FROM user_plan up
                JOIN enroll_invite ei ON ei.id = up.enroll_invite_id
                WHERE ei.institute_id = :instituteId

                -- Explicit CAST to TIMESTAMP is still good practice for dynamic null checks
                AND (CAST(:startDate AS TIMESTAMP) IS NULL OR up.end_date >= CAST(:startDate AS TIMESTAMP))
                AND (CAST(:endDate AS TIMESTAMP) IS NULL OR up.end_date <= CAST(:endDate AS TIMESTAMP))

                AND (
                    :#{#statuses == null || #statuses.isEmpty() ? 1 : 0} = 1
                    OR
                    CASE
                       WHEN up.end_date IS NULL THEN 'LIFETIME'
                       WHEN up.end_date < CURRENT_TIMESTAMP THEN 'ENDED'
                       ELSE 'ABOUT_TO_END'
                    END IN (:statuses)
                )
            """, countQuery = """
                SELECT COUNT(up.id)
                FROM user_plan up
                JOIN enroll_invite ei ON ei.id = up.enroll_invite_id
                WHERE ei.institute_id = :instituteId
                AND (CAST(:startDate AS TIMESTAMP) IS NULL OR up.end_date >= CAST(:startDate AS TIMESTAMP))
                AND (CAST(:endDate AS TIMESTAMP) IS NULL OR up.end_date <= CAST(:endDate AS TIMESTAMP))
                AND (
                    :#{#statuses == null || #statuses.isEmpty() ? 1 : 0} = 1
                    OR
                    CASE
                       WHEN up.end_date IS NULL THEN 'LIFETIME'
                       WHEN up.end_date < CURRENT_TIMESTAMP THEN 'ENDED'
                       ELSE 'ABOUT_TO_END'
                    END IN (:statuses)
                )
            """, nativeQuery = true)
    Page<Object[]> findMembershipDetailsWithDynamicStatus(
            @Param("instituteId") String instituteId,
            @Param("startDate") Timestamp startDate, // Changed
            @Param("endDate") Timestamp endDate, // Changed
            @Param("statuses") List<String> statuses,
            Pageable pageable);

    /**
     * Find UserPlan entities by IDs without loading payment logs (optimized for
     * membership details).
     * Uses EntityGraph to control which associations to fetch.
     */
    @EntityGraph(attributePaths = { "enrollInvite", "paymentOption", "paymentPlan" })
    @Query("SELECT up FROM UserPlan up WHERE up.id IN :ids")
    List<UserPlan> findByIdsWithoutPaymentLogs(@Param("ids") List<String> ids);

    Optional<UserPlan> findTopByUserIdAndEnrollInviteIdAndStatusInOrderByEndDateDesc(
            String userId,
            String enrollInviteId,
            List<String> statuses);

    Optional<UserPlan> findTopByUserIdAndEnrollInviteIdAndStatusInAndIdNotInOrderByEndDateDesc(
            String userId,
            String enrollInviteId,
            List<String> statuses,
            List<String> excludeIds);

    Optional<UserPlan> findTopByUserIdAndEnrollInviteIdAndStatusInOrderByCreatedAtAsc(
            String userId,
            String enrollInviteId,
            List<String> statuses);
}
