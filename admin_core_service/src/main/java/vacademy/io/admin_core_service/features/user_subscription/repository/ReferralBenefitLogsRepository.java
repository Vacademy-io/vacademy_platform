package vacademy.io.admin_core_service.features.user_subscription.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralBenefitLogs;

import java.util.List;

@Repository
public interface ReferralBenefitLogsRepository extends JpaRepository<ReferralBenefitLogs, String> {

    @Query("SELECT rbl FROM ReferralBenefitLogs rbl WHERE rbl.userPlan.id = :userPlanId")
    List<ReferralBenefitLogs> findByUserPlanId(@Param("userPlanId") String userPlanId);
}
