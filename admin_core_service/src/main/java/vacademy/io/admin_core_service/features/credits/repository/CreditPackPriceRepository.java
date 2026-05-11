package vacademy.io.admin_core_service.features.credits.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.credits.entity.CreditPackPrice;

import java.util.List;
import java.util.Optional;

public interface CreditPackPriceRepository extends JpaRepository<CreditPackPrice, String> {

    /** Active price for a given pack in a given currency, if any. */
    Optional<CreditPackPrice> findByPackIdAndCurrencyAndIsActiveTrue(String packId, String currency);

    /** All active prices for a given pack across all currencies. */
    List<CreditPackPrice> findByPackIdAndIsActiveTrue(String packId);
}
