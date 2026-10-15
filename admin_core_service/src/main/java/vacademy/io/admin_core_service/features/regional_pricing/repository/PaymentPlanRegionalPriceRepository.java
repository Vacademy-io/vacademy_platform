package vacademy.io.admin_core_service.features.regional_pricing.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.regional_pricing.entity.PaymentPlanRegionalPrice;

import java.util.Collection;
import java.util.List;

@Repository
public interface PaymentPlanRegionalPriceRepository extends JpaRepository<PaymentPlanRegionalPrice, String> {

    List<PaymentPlanRegionalPrice> findByPaymentPlanIdInAndStatus(Collection<String> paymentPlanIds, String status);

    List<PaymentPlanRegionalPrice> findByPaymentPlanIdAndStatus(String paymentPlanId, String status);

    /** AUTO rows on options that still have regional pricing switched on — the daily refresh set. */
    @Query(value = """
            SELECT r.* FROM payment_plan_regional_price r
            JOIN payment_plan pp ON pp.id = r.payment_plan_id
            JOIN payment_option po ON po.id = pp.payment_option_id
            WHERE r.status = 'ACTIVE'
              AND r.price_source = 'AUTO'
              AND pp.status = 'ACTIVE'
              AND po.regional_pricing_enabled = TRUE
            """, nativeQuery = true)
    List<PaymentPlanRegionalPrice> findActiveAutoRowsOnEnabledOptions();

    /** Whether any payment option uses regional pricing — the daily job does nothing otherwise. */
    @Query(value = "SELECT EXISTS (SELECT 1 FROM payment_option WHERE regional_pricing_enabled = TRUE)",
            nativeQuery = true)
    boolean anyOptionEnabled();
}
