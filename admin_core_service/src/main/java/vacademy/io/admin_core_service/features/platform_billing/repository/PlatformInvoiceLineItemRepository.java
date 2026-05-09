package vacademy.io.admin_core_service.features.platform_billing.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.platform_billing.entity.PlatformInvoiceLineItem;

import java.util.List;

public interface PlatformInvoiceLineItemRepository extends JpaRepository<PlatformInvoiceLineItem, String> {

    List<PlatformInvoiceLineItem> findByPlatformInvoiceId(String platformInvoiceId);
}
