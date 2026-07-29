package vacademy.io.community_service.feature.pricing.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.community_service.feature.pricing.entity.PricingPlan;

import java.util.List;
import java.util.Optional;

public interface PricingPlanRepository extends JpaRepository<PricingPlan, String> {
    List<PricingPlan> findByActiveTrueOrderByProductCodeAscSortOrderAsc();

    List<PricingPlan> findByProductCodeOrderBySortOrderAsc(String productCode);

    Optional<PricingPlan> findByProductCodeAndCode(String productCode, String code);
}
