package vacademy.io.admin_core_service.features.enroll_invite.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionEnrollInvitePaymentOptionPlanToReferralOption;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption;
import vacademy.io.admin_core_service.features.enroll_invite.repository.PackageSessionEnrollInvitePaymentOptionPlanToReferralOptionRepository;
import vacademy.io.admin_core_service.features.user_subscription.dto.ReferralOptionDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralOption;

import java.util.List;
import java.util.Optional;

@Service
public class PackageSessionEnrollInvitePaymentOptionPlanToReferralOptionService {

    @Autowired
    private PackageSessionEnrollInvitePaymentOptionPlanToReferralOptionRepository repository;

    public void saveInBulk(List<PackageSessionEnrollInvitePaymentOptionPlanToReferralOption> mappings) {
        repository.saveAll(mappings);
    }

    public List<PackageSessionEnrollInvitePaymentOptionPlanToReferralOption> findByReferralOptionIds(List<String> referralOptionIds) {
        return repository.findByReferralOptionIds(
                referralOptionIds,
                List.of(StatusEnum.ACTIVE.name()),
                List.of(StatusEnum.ACTIVE.name()),
                List.of(StatusEnum.ACTIVE.name())
        );
    }

    public Optional<ReferralOptionDTO> getReferralOptionsByPackageSessionLearnerInvitationToPaymentOptionAndPaymentPlan(
            PackageSessionLearnerInvitationToPaymentOption mapping,
            PaymentPlan paymentPlan) {

        return repository.findByPackageSessionLearnerInvitationToPaymentOptionAndPaymentPlanAndStatusIn(
                        mapping, paymentPlan, List.of(StatusEnum.ACTIVE.name()))
                .map(result -> result.getReferralOption().toReferralOptionDTO());
    }
}