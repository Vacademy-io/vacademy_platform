package vacademy.io.admin_core_service.features.learner.service;

import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.service.EnrollInviteService;
import vacademy.io.admin_core_service.features.enroll_invite.service.SubOrgService;
import vacademy.io.admin_core_service.features.learner_payment_option_operation.service.PaymentOptionOperationFactory;
import vacademy.io.admin_core_service.features.learner_payment_option_operation.service.PaymentOptionOperationStrategy;
import vacademy.io.admin_core_service.features.notification.service.DynamicNotificationService;
import vacademy.io.admin_core_service.features.notification.enums.NotificationEventType;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentOptionType;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanSourceEnum;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentOptionService;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentPlanService;
import vacademy.io.admin_core_service.features.user_subscription.service.UserPlanService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerEnrollResponseDTO;
import vacademy.io.common.auth.dto.learner.LearnerPackageSessionsEnrollDTO;
import vacademy.io.common.auth.dto.learner.LearnerEnrollRequestDTO;
import vacademy.io.common.common.dto.CustomFieldValueDTO;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
public class LearnerEnrollRequestService {

    @Autowired
    private EnrollInviteService enrollInviteService;

    @Autowired
    private PaymentOptionService paymentOptionService;

    @Autowired
    private PaymentOptionOperationFactory paymentOptionOperationFactory;

    @Autowired
    private UserPlanService userPlanService;

    @Autowired
    private PaymentPlanService paymentPlanService;

    @Autowired
    private AuthService authService;

    @Autowired
    private LearnerCouponService learnerCouponService;

    @Autowired
    private DynamicNotificationService dynamicNotificationService;

    @Autowired
    private SubOrgService subOrgService;

    @Autowired
    private PackageSessionRepository packageSessionRepository;

    @Transactional
    public LearnerEnrollResponseDTO recordLearnerRequest(LearnerEnrollRequestDTO learnerEnrollRequestDTO) {
        LearnerPackageSessionsEnrollDTO enrollDTO = learnerEnrollRequestDTO.getLearnerPackageSessionEnroll();
        if (!StringUtils.hasText(learnerEnrollRequestDTO.getUser().getId())) {
            UserDTO user = authService.createUserFromAuthService(learnerEnrollRequestDTO.getUser(),
                    learnerEnrollRequestDTO.getInstituteId(), true);
            learnerEnrollRequestDTO.setUser(user);
            // Generate coupon code for new learner enrollment
            learnerCouponService.generateCouponCodeForLearner(user.getId());
        }
        EnrollInvite enrollInvite = getValidatedEnrollInvite(enrollDTO.getEnrollInviteId());
        PaymentOption paymentOption = getValidatedPaymentOption(enrollDTO.getPaymentOptionId(), enrollInvite);
        PaymentPlan paymentPlan = getOptionalPaymentPlan(enrollDTO.getPlanId());

        // Determine if this is a SubOrg enrollment and create SubOrg if needed
        String userPlanSource = UserPlanSourceEnum.USER.name();
        String subOrgId = null;

        if (enrollDTO.getPackageSessionIds() != null && enrollDTO.getPackageSessionIds().size() == 1) {
            // Fetch the package session to check isOrgAssociated
            List<PackageSession> packageSessions = packageSessionRepository
                    .findPackageSessionsByIds(enrollDTO.getPackageSessionIds());
            if (!packageSessions.isEmpty()) {
                PackageSession packageSession = packageSessions.get(0);
                if (Boolean.TRUE.equals(packageSession.getIsOrgAssociated())) {
                    // This is a SubOrg enrollment - create SubOrg before creating UserPlan
                    log.info("Detected SubOrg enrollment for package session: {}", packageSession.getId());
                    List<CustomFieldValueDTO> customFieldValues = enrollDTO.getCustomFieldValues();
                    if (customFieldValues == null || customFieldValues.isEmpty()) {
                        log.warn("Custom field values are required for SubOrg creation but were not provided");
                    } else {
                        Institute subOrg = subOrgService.createOrGetSubOrg(
                                customFieldValues,
                                enrollInvite.getSettingJson(),
                                learnerEnrollRequestDTO.getUser().getId(),
                                packageSession.getId(),
                                learnerEnrollRequestDTO.getInstituteId());
                        if (subOrg != null) {
                            subOrgId = subOrg.getId();
                            userPlanSource = UserPlanSourceEnum.SUB_ORG.name();
                            log.info("Created/retrieved SubOrg with ID: {} for UserPlan", subOrgId);
                        } else {
                            log.warn("SubOrg creation returned null, falling back to USER source");
                        }
                    }
                }
            }
        }

        UserPlan userPlan = createUserPlan(
                learnerEnrollRequestDTO.getUser().getId(),
                enrollDTO,
                enrollInvite,
                paymentOption,
                paymentPlan,
                userPlanSource,
                subOrgId);

        LearnerEnrollResponseDTO response = enrollLearnerToBatch(
                learnerEnrollRequestDTO,
                enrollDTO,
                enrollInvite,
                paymentOption,
                userPlan);
        // Send enrollment notifications ONLY for FREE enrollments (status = ACTIVE)
        // For PAID enrollments, notifications will be sent after webhook confirms
        // payment
        if (UserPlanStatusEnum.ACTIVE.name().equals(userPlan.getStatus())) {
            log.info("FREE enrollment completed. Sending enrollment notifications for user: {}",
                    learnerEnrollRequestDTO.getUser().getId());
            sendDynamicNotificationForEnrollment(
                    learnerEnrollRequestDTO.getInstituteId(),
                    learnerEnrollRequestDTO.getUser(),
                    paymentOption,
                    enrollInvite,
                    enrollDTO.getPackageSessionIds().get(0) // Get first package session ID
            );

            sendReferralInvitationEmail(
                    learnerEnrollRequestDTO.getInstituteId(),
                    learnerEnrollRequestDTO.getUser(),
                    enrollInvite);
        } else {
            log.info(
                    "PAID enrollment initiated. Notifications will be sent after payment confirmation. UserPlan ID: {}",
                    userPlan.getId());
        }

        return response;
    }

    private void sendDynamicNotificationForEnrollment(
            String instituteId,
            UserDTO user,
            PaymentOption paymentOption,
            EnrollInvite enrollInvite,
            String packageSessionId) {

        try {
            dynamicNotificationService.sendDynamicNotification(
                    NotificationEventType.LEARNER_ENROLL,
                    packageSessionId,
                    instituteId,
                    user,
                    paymentOption,
                    enrollInvite);
        } catch (Exception e) {
            log.error("Error sending dynamic notification for enrollment", e);
        }
    }

    private void sendReferralInvitationEmail(
            String instituteId,
            UserDTO user,
            EnrollInvite enrollInvite) {

        try {
            dynamicNotificationService.sendReferralInvitationNotification(
                    instituteId,
                    user,
                    enrollInvite);
        } catch (Exception e) {
            log.error("Error sending referral invitation email", e);
        }
    }

    private EnrollInvite getValidatedEnrollInvite(String enrollInviteId) {
        return Optional.ofNullable(enrollInviteId)
                .map(enrollInviteService::findById)
                .orElseThrow(() -> new IllegalArgumentException("Enroll Invite ID is required."));
    }

    private PaymentOption getValidatedPaymentOption(String paymentOptionId, EnrollInvite enrollInvite) {
        if ("default".equalsIgnoreCase(paymentOptionId)) {
            return enrollInviteService.getDefaultPaymentOption(enrollInvite);
        }
        return Optional.ofNullable(paymentOptionId)
                .map(paymentOptionService::findById)
                .orElseThrow(() -> new IllegalArgumentException("Payment Option ID is required."));
    }

    private PaymentPlan getOptionalPaymentPlan(String planId) {
        return Optional.ofNullable(planId)
                .flatMap(paymentPlanService::findById)
                .orElse(null); // It's okay if there's no plan
    }

    private UserPlan createUserPlan(
            String userId,
            LearnerPackageSessionsEnrollDTO enrollDTO,
            EnrollInvite enrollInvite,
            PaymentOption paymentOption,
            PaymentPlan paymentPlan,
            String source,
            String subOrgId) {
        String userPlanStatus = null;
        if (PaymentOptionType.SUBSCRIPTION.name().equalsIgnoreCase(paymentOption.getType())
                || PaymentOptionType.ONE_TIME.name().equalsIgnoreCase(paymentOption.getType())) {
            userPlanStatus = UserPlanStatusEnum.PENDING_FOR_PAYMENT.name();
        } else {
            userPlanStatus = UserPlanStatusEnum.ACTIVE.name();
        }
        return userPlanService.createUserPlan(
                userId,
                paymentPlan,
                null, // coupon can be handled later if needed
                enrollInvite,
                paymentOption,
                enrollDTO.getPaymentInitiationRequest(),
                userPlanStatus,
                source,
                subOrgId,
                enrollDTO.getStartDate());
    }

    private LearnerEnrollResponseDTO enrollLearnerToBatch(
            LearnerEnrollRequestDTO learnerEnrollRequestDTO,
            LearnerPackageSessionsEnrollDTO enrollDTO,
            EnrollInvite enrollInvite,
            PaymentOption paymentOption,
            UserPlan userPlan) {
        PaymentOptionOperationStrategy strategy = paymentOptionOperationFactory
                .getStrategy(PaymentOptionType.fromString(paymentOption.getType()));

        return strategy.enrollLearnerToBatch(
                learnerEnrollRequestDTO.getUser(),
                enrollDTO,
                learnerEnrollRequestDTO.getInstituteId(),
                enrollInvite,
                paymentOption,
                userPlan,
                Map.of(), // optional extra data,
                learnerEnrollRequestDTO.getLearnerExtraDetails());
    }

}
