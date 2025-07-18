package vacademy.io.admin_core_service.features.user_subscription.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentLogRepository extends JpaRepository<PaymentLog, String> {
    // Example: Find payment logs by user ID
    List<PaymentLog> findByUserId(String userId);

    // Example: Find a payment log by order ID
    Optional<PaymentLog> findByOrderId(String orderId);

    // Example: Find payment logs by payment status
    // List<PaymentLog> findByPaymentStatus(String paymentStatus);
}