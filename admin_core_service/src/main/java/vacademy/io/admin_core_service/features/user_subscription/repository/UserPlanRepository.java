package vacademy.io.admin_core_service.features.user_subscription.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;

public interface UserPlanRepository extends JpaRepository<UserPlan, String> {
}
