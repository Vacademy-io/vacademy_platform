package vacademy.io.admin_core_service.features.enroll_invite.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption;
import vacademy.io.admin_core_service.features.enroll_invite.enums.EnrollInviteTag;
import vacademy.io.admin_core_service.features.enroll_invite.repository.EnrollInviteRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentOptionSource;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentOptionTag;
import vacademy.io.admin_core_service.features.user_subscription.service.AppliedCouponDiscountService;
import vacademy.io.admin_core_service.features.user_subscription.service.EnrollInviteDiscountOptionService;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentOptionService;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.security.SecureRandom;
import java.sql.Date;
import java.util.List;
import java.util.Optional;

@Service
public class DefaultEnrollInviteService {

    @Autowired
    private EnrollInviteRepository repository;

    @Autowired
    private AppliedCouponDiscountService appliedCouponDiscountService;

    @Autowired
    private EnrollInviteCoursePreviewService enrollInviteCoursePreviewService;
    
    @Autowired
    private PaymentOptionService paymentOptionService;

    @Autowired
    private PackageSessionLearnerInvitationToPaymentOptionService packageSessionLearnerInvitationToPaymentOptionService;

    @Autowired
    private EnrollInviteDiscountOptionService enrollInviteDiscountOptionService;

    public void createDefaultEnrollInvite(PackageSession packageSession, String instituteId) {
        EnrollInvite enrollInvite = new EnrollInvite();
        enrollInvite.setName(getNameForDefaultEnrollInvite(packageSession));
        enrollInvite.setEndDate(null);
        enrollInvite.setStartDate(new Date(System.currentTimeMillis()));
        enrollInvite.setInviteCode(getInviteCode());
        enrollInvite.setStatus(StatusEnum.ACTIVE.name());
        enrollInvite.setInstituteId(instituteId);

        // TODO: vendor id and vendor name
        enrollInvite.setVendor("Vacademy");
        enrollInvite.setVendorId("Vacademy");
        enrollInvite.setTag(EnrollInviteTag.DEFAULT.name());
        enrollInvite.setWebPageMetaDataJson(enrollInviteCoursePreviewService.createPreview(packageSession.getId()));
        // TODO: Referral Option

        Optional<PaymentOption> optionalPaymentOption = paymentOptionService.getPaymentOption(
                PaymentOptionSource.INSTITUTE.name(),
                instituteId,
                PaymentOptionTag.DEFAULT.name(),
                List.of(StatusEnum.ACTIVE.name())
        );

        if (optionalPaymentOption.isPresent()) {
            PaymentOption paymentOption = optionalPaymentOption.get();
            if (paymentOption.getPaymentPlans() != null && !paymentOption.getPaymentPlans().isEmpty()) {
                enrollInvite.setCurrency(paymentOption.getPaymentPlans().get(0).getCurrency());
            }
            PackageSessionLearnerInvitationToPaymentOption packageSessionLearnerInvitationToPaymentOption = new PackageSessionLearnerInvitationToPaymentOption(enrollInvite, packageSession, paymentOption,StatusEnum.ACTIVE.name());
            packageSessionLearnerInvitationToPaymentOption = packageSessionLearnerInvitationToPaymentOptionService.create(packageSessionLearnerInvitationToPaymentOption);
        } else {
            return;
        }

        repository.save(enrollInvite);
    }

    private String getNameForDefaultEnrollInvite(PackageSession packageSession) {
        return "To do name";
    }

    private String getInviteCode() {
        String chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder(6);

        for (int i = 0; i < 6; i++) {
            int index = random.nextInt(chars.length());
            sb.append(chars.charAt(index));
        }

        return sb.toString();
    }
}
