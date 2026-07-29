package vacademy.io.community_service.feature.pricing.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.community_service.feature.pricing.entity.PricingPlanFeature;

import java.util.List;

public interface PricingPlanFeatureRepository extends JpaRepository<PricingPlanFeature, String> {
    List<PricingPlanFeature> findByPlanIdInOrderBySortOrderAsc(List<String> planIds);

    List<PricingPlanFeature> findByPlanIdOrderBySortOrderAsc(String planId);
}
