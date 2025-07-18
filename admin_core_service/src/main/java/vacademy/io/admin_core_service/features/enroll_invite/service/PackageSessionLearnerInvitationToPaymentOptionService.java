package vacademy.io.admin_core_service.features.enroll_invite.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.w3c.dom.stylesheets.LinkStyle;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption;
import vacademy.io.admin_core_service.features.enroll_invite.repository.PackageSessionLearnerInvitationToPaymentOptionRepository;

import java.util.List;

@Service
public class PackageSessionLearnerInvitationToPaymentOptionService {

    @Autowired
    private PackageSessionLearnerInvitationToPaymentOptionRepository packageSessionLearnerInvitationToPaymentOptionRepository;

    public PackageSessionLearnerInvitationToPaymentOption create(PackageSessionLearnerInvitationToPaymentOption packageSessionLearnerInvitationToPaymentOption) {
        return packageSessionLearnerInvitationToPaymentOptionRepository.save(packageSessionLearnerInvitationToPaymentOption);
    }

    public void createPackageSessionLearnerInvitationToPaymentOptions(List<PackageSessionLearnerInvitationToPaymentOption>packageSessionLearnerInvitationToPaymentOptions) {
        packageSessionLearnerInvitationToPaymentOptionRepository.saveAll(packageSessionLearnerInvitationToPaymentOptions);
    }
}
