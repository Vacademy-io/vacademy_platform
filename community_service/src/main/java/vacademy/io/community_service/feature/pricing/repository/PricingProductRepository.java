package vacademy.io.community_service.feature.pricing.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.community_service.feature.pricing.entity.PricingProduct;

import java.util.List;
import java.util.Optional;

public interface PricingProductRepository extends JpaRepository<PricingProduct, String> {
    List<PricingProduct> findByActiveTrueOrderBySortOrderAsc();

    List<PricingProduct> findAllByOrderBySortOrderAsc();

    Optional<PricingProduct> findByCode(String code);
}
