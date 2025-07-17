package vacademy.io.admin_core_service.features.enroll_invite.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.enroll_invite.dto.EnrollInviteDTO;
import vacademy.io.admin_core_service.features.enroll_invite.dto.PackageSessionToPaymentOptionDTO;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption;
import vacademy.io.admin_core_service.features.enroll_invite.enums.EnrollInviteTag;
import vacademy.io.admin_core_service.features.enroll_invite.repository.EnrollInviteRepository;
import vacademy.io.admin_core_service.features.packages.service.PackageSessionService;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentOptionSource;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentOptionTag;
import vacademy.io.admin_core_service.features.user_subscription.service.AppliedCouponDiscountService;
import vacademy.io.admin_core_service.features.user_subscription.service.EnrollInviteDiscountOptionService;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentOptionService;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.sql.Date;
import java.util.List;
import java.util.Optional;

@Service
public class EnrollInviteService {
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

    @Autowired
    private PackageSessionService packageSessionService;

    public String createEnrollInvite(EnrollInviteDTO enrollInviteDTO){
        EnrollInvite enrollInvite = new EnrollInvite(enrollInviteDTO);
        if (enrollInviteDTO.getPackageSessionToPaymentOptions() == null || enrollInviteDTO.getPackageSessionToPaymentOptions().isEmpty()) {
            throw new VacademyException("Package session to payment options cannot be empty");
        }
        enrollInvite = repository.save(enrollInvite);
        List<PackageSessionToPaymentOptionDTO>packageSessionToPaymentOptionDTOS = enrollInviteDTO.getPackageSessionToPaymentOptions();
        List<PackageSessionLearnerInvitationToPaymentOption>packageSessionLearnerInvitationToPaymentOptions = new  java.util.ArrayList<>();
        for(PackageSessionToPaymentOptionDTO packageSessionToPaymentOptionDTO : packageSessionToPaymentOptionDTOS){
            PaymentOption paymentOption = paymentOptionService.findById(packageSessionToPaymentOptionDTO.getPaymentOption().getId());
            PackageSession packageSession = packageSessionService.findById(packageSessionToPaymentOptionDTO.getPackageSessionId());
            PackageSessionLearnerInvitationToPaymentOption packageSessionLearnerInvitationToPaymentOption = new PackageSessionLearnerInvitationToPaymentOption(enrollInvite,packageSession,paymentOption,StatusEnum.ACTIVE.name());
            packageSessionLearnerInvitationToPaymentOptions.add(packageSessionLearnerInvitationToPaymentOption);
        }
        packageSessionLearnerInvitationToPaymentOptionService.createPackageSessionLearnerInvitationToPaymentOptions(packageSessionLearnerInvitationToPaymentOptions);
        repository.save(enrollInvite);
        return enrollInvite.getId();
    }
}
