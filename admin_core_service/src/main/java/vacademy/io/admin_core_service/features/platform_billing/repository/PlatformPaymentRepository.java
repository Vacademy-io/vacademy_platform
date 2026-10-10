package vacademy.io.admin_core_service.features.platform_billing.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.platform_billing.entity.PlatformPayment;
import vacademy.io.admin_core_service.features.platform_billing.enums.PlatformPaymentResult;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PlatformPaymentRepository extends JpaRepository<PlatformPayment, String> {

    Optional<PlatformPayment> findByVendorOrderId(String vendorOrderId);

    Optional<PlatformPayment> findByVendorPaymentId(String vendorPaymentId);

    List<PlatformPayment> findByInstituteIdAndPaymentStatusInOrderByCreatedAtDesc(
            String instituteId, Collection<PlatformPaymentResult> paymentStatuses);
}
