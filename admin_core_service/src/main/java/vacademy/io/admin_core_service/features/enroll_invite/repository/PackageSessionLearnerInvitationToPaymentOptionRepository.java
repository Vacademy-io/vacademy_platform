package vacademy.io.admin_core_service.features.enroll_invite.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption;

import java.util.List;

@Repository
public interface PackageSessionLearnerInvitationToPaymentOptionRepository extends JpaRepository<PackageSessionLearnerInvitationToPaymentOption, String> {
    List<PackageSessionLearnerInvitationToPaymentOption> findByEnrollInviteAndStatusIn(
            EnrollInvite enrollInvite,
            List<String> statusList
    );
}