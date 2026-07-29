package vacademy.io.community_service.feature.pricing.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.community_service.feature.pricing.entity.PricingSetting;

public interface PricingSettingRepository extends JpaRepository<PricingSetting, String> {
}
