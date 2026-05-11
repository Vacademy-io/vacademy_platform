package vacademy.io.admin_core_service.features.platform_billing.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.platform_billing.entity.PlatformPaymentConfig;

import java.util.Optional;

public interface PlatformPaymentConfigRepository extends JpaRepository<PlatformPaymentConfig, String> {

    /** Returns the singleton row, or empty if not yet bootstrapped. */
    Optional<PlatformPaymentConfig> findFirstByIsActiveTrue();
}
