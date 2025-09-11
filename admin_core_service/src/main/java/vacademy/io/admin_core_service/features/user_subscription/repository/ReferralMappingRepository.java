package vacademy.io.admin_core_service.features.user_subscription.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralMapping;

public interface ReferralMappingRepository extends JpaRepository<ReferralMapping,String> {
}
