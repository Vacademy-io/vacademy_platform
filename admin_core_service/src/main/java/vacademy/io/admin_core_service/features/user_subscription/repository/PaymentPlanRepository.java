package vacademy.io.admin_core_service.features.user_subscription.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption; // Import PaymentOption

import java.util.List;

@Repository
public interface PaymentPlanRepository extends JpaRepository<PaymentPlan, String> {
    // Example: Find payment plans by associated payment option
    List<PaymentPlan> findByPaymentOption(PaymentOption paymentOption);

    // Example: Find payment plans by status and currency
    // List<PaymentPlan> findByStatusAndCurrency(String status, String currency);
}