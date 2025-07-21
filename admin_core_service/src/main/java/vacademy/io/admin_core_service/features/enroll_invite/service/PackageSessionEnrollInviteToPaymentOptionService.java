package vacademy.io.admin_core_service.features.enroll_invite.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.enroll_invite.dto.PackageSessionToPaymentOptionDTO;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption;
import vacademy.io.admin_core_service.features.enroll_invite.repository.PackageSessionLearnerInvitationToPaymentOptionRepository;

import java.util.List;

@Service
public class PackageSessionEnrollInviteToPaymentOptionService {

    @Autowired
    private PackageSessionLearnerInvitationToPaymentOptionRepository packageSessionLearnerInvitationToPaymentOptionRepository;

    public PackageSessionLearnerInvitationToPaymentOption create(PackageSessionLearnerInvitationToPaymentOption packageSessionEnrollInviteToPaymentOption) {
        return packageSessionLearnerInvitationToPaymentOptionRepository.save(packageSessionEnrollInviteToPaymentOption);
    }

    public void createPackageSessionLearnerInvitationToPaymentOptions(List<PackageSessionLearnerInvitationToPaymentOption> packageSessionEnrollInviteToPaymentOptions) {
        packageSessionLearnerInvitationToPaymentOptionRepository.saveAll(packageSessionEnrollInviteToPaymentOptions);
    }

    public List<PackageSessionToPaymentOptionDTO>findByInvite(EnrollInvite enrollInvite) {
        List<PackageSessionLearnerInvitationToPaymentOption> packageSessionEnrollInviteToPaymentOptions = packageSessionLearnerInvitationToPaymentOptionRepository.findByEnrollInviteAndStatusIn(enrollInvite,List.of(StatusEnum.ACTIVE.name()));
        return packageSessionEnrollInviteToPaymentOptions.stream().map((packageSessionEnrollInviteToPaymentOption) -> packageSessionEnrollInviteToPaymentOption.mapToPackageSessionToPaymentOptionDTO()).toList();
    }
}
