package vacademy.io.admin_core_service.features.user_subscription.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLogLineItem;

import java.util.List;

@Repository
public interface PaymentLogLineItemRepository extends JpaRepository<PaymentLogLineItem, String> {
    // Example: Find line items for a specific payment log
    List<PaymentLogLineItem> findByPaymentLog(PaymentLog paymentLog);

    // Example: Find line items by type
    // List<PaymentLogLineItem> findByType(String type);
}