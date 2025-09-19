package vacademy.io.admin_core_service.features.user_subscription.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralMapping;

import java.util.List;
import java.util.Optional;

public interface ReferralMappingRepository extends JpaRepository<ReferralMapping,String> {
    @Query("SELECT COUNT(rm) FROM ReferralMapping rm WHERE rm.referrerUserId = :referrerUserId AND rm.status = 'ACTIVE'")
    long countActiveReferralsByReferrerUserId(@Param("referrerUserId") String referrerUserId);

    @Query("""
    SELECT rm
    FROM ReferralMapping rm
    WHERE rm.userPlan.id = :userPlanId
      AND rm.status IN :status
""")
    Optional<ReferralMapping> findByUserPlanIdAndStatusIn(@Param("userPlanId") String userPlanId,
                                                          @Param("status") List<String> status);
}
