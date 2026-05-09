package vacademy.io.admin_core_service.features.platform_billing.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.platform_billing.entity.PlatformPaymentItem;

import java.util.List;

public interface PlatformPaymentItemRepository extends JpaRepository<PlatformPaymentItem, String> {

    List<PlatformPaymentItem> findByPlatformPaymentId(String platformPaymentId);
}
