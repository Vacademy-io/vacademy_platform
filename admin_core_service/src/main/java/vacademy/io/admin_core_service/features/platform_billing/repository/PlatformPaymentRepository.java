package vacademy.io.admin_core_service.features.platform_billing.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.platform_billing.entity.PlatformPayment;

import java.util.Optional;

public interface PlatformPaymentRepository extends JpaRepository<PlatformPayment, String> {

    Optional<PlatformPayment> findByVendorOrderId(String vendorOrderId);

    Optional<PlatformPayment> findByVendorPaymentId(String vendorPaymentId);
}
