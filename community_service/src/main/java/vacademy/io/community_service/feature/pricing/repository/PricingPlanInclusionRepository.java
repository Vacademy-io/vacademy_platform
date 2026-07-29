package vacademy.io.community_service.feature.pricing.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.community_service.feature.pricing.entity.PricingPlanInclusion;

import java.util.List;

public interface PricingPlanInclusionRepository extends JpaRepository<PricingPlanInclusion, String> {
    List<PricingPlanInclusion> findByPlanIdInOrderBySortOrderAsc(List<String> planIds);

    List<PricingPlanInclusion> findByPlanIdOrderBySortOrderAsc(String planId);
}
