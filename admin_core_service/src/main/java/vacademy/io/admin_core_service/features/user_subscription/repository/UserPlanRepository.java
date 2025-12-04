package vacademy.io.admin_core_service.features.user_subscription.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;

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
            """,
            countQuery = """
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
}
