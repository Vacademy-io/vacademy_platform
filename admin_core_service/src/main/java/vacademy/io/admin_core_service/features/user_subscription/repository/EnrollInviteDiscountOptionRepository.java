package vacademy.io.admin_core_service.features.user_subscription.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.user_subscription.entity.EnrollInviteDiscountOption;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption; // Import

import java.util.List;

@Repository
public interface DiscountOptionRepository extends JpaRepository<EnrollInviteDiscountOption, String> {
    // Example: Find discount options related to a specific invitation
    List<EnrollInviteDiscountOption> findByPackageSessionLearnerInvitationToPaymentOption(PackageSessionLearnerInvitationToPaymentOption invitation);

    // Example: Find discount options by payment plan
    // List<DiscountOption> findByPaymentPlan(PaymentPlan paymentPlan);
}