package vacademy.io.admin_core_service.features.enroll_invite.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption;

import java.util.List;

@Repository
public interface PackageSessionLearnerInvitationToPaymentOptionRepository extends JpaRepository<PackageSessionLearnerInvitationToPaymentOption, String> {
    // Example: Find invitations by enroll invite ID
    // List<PackageSessionLearnerInvitationToPaymentOption> findByEnrollInviteId(String enrollInviteId);

    // Example: Find invitations by package session ID and payment option ID
    // Optional<PackageSessionLearnerInvitationToPaymentOption> findByPackageSessionIdAndPaymentOptionId(String packageSessionId, String paymentOptionId);
}