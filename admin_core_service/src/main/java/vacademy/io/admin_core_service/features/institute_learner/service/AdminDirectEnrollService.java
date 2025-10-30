package vacademy.io.admin_core_service.features.institute_learner.service;

import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.service.EnrollInviteService;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteStudentDetails;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerStatusEnum;
import vacademy.io.admin_core_service.features.notification.enums.NotificationEventType;
import vacademy.io.admin_core_service.features.notification.service.DynamicNotificationService;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentLogStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentLogService;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentOptionService;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentPlanService;
import vacademy.io.admin_core_service.features.user_subscription.service.UserPlanService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerEnrollRequestDTO;
import vacademy.io.common.auth.dto.learner.LearnerEnrollResponseDTO;
import vacademy.io.common.auth.dto.learner.LearnerPackageSessionsEnrollDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.payment.dto.ManualPaymentDTO;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.enums.PaymentGateway;
import vacademy.io.common.payment.enums.PaymentStatusEnum;

import java.util.*;

@Service
@Transactional
@Slf4j
public class AdminDirectEnrollService {

    @Autowired
    private EnrollInviteService enrollInviteService;

    @Autowired
    private PaymentOptionService paymentOptionService;

    @Autowired
    private PaymentPlanService paymentPlanService;

    @Autowired
    private UserPlanService userPlanService;

    @Autowired
    private LearnerBatchEnrollService learnerBatchEnrollService;

    @Autowired
    private PaymentLogService paymentLogService;

    @Autowired
    private AuthService authService;

    @Autowired
    private DynamicNotificationService dynamicNotificationService;

    @Transactional
    public LearnerEnrollResponseDTO adminEnrollLearner(LearnerEnrollRequestDTO request) {
        UserDTO user = createUserOrGetExistingUser(request.getUser(),request.getInstituteId());
        LearnerPackageSessionsEnrollDTO enrollDTO = request.getLearnerPackageSessionEnroll();
        String instituteId = request.getInstituteId();

        validate(enrollDTO, user, instituteId);

        EnrollInvite enrollInvite = enrollInviteService.findById(enrollDTO.getEnrollInviteId());
        PaymentOption paymentOption = paymentOptionService.findById(enrollDTO.getPaymentOptionId());
        PaymentPlan paymentPlan = null;
        if (enrollDTO.getPlanId() != null) {
            paymentPlan = paymentPlanService.findById(enrollDTO.getPlanId()).orElse(null);
        }
		sendNotificationsForEnrollment(
				instituteId,
				user,
				paymentOption,
				enrollInvite,
				enrollDTO.getPackageSessionIds().get(0)
		);
        UserPlan userPlan = userPlanService.createUserPlan(
                user.getId(),
                paymentPlan,
                null,
                enrollInvite,
                paymentOption,
                enrollDTO.getPaymentInitiationRequest(),
                UserPlanStatusEnum.ACTIVE.name());

        List<InstituteStudentDetails> instituteStudentDetails = new ArrayList<>();
        for (String packageSessionId : enrollDTO.getPackageSessionIds()) {
            instituteStudentDetails.add(InstituteStudentDetails.builder()
                    .instituteId(instituteId)
                    .packageSessionId(packageSessionId)
                    .enrollmentStatus(LearnerStatusEnum.ACTIVE.name())
                    .enrollmentDate(new Date())
                    .accessDays(
                            enrollInvite.getLearnerAccessDays() != null ? enrollInvite.getLearnerAccessDays().toString()
                                    : null)
                    .destinationPackageSessionId(null)
                    .userPlanId(userPlan.getId())
                    .build());
        }

        UserDTO createdUser = learnerBatchEnrollService.checkAndCreateStudentAndAddToBatch(
                user,
                instituteId,
                instituteStudentDetails,
                enrollDTO.getCustomFieldValues(),
                Map.of());

        handleManualPaymentIfAny(enrollDTO.getPaymentInitiationRequest(), createdUser, userPlan, paymentPlan,
                enrollInvite);

        LearnerEnrollResponseDTO response = new LearnerEnrollResponseDTO();
        response.setUser(createdUser);
        return response;
    }

	private void sendNotificationsForEnrollment(
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
					enrollInvite
			);
		} catch (Exception e) {
			log.error("Error sending dynamic notification for admin enroll", e);
		}

		try {
			dynamicNotificationService.sendReferralInvitationNotification(
					instituteId,
					user,
					enrollInvite
			);
		} catch (Exception e) {
			log.error("Error sending referral invitation notification for admin enroll", e);
		}
	}

    private void validate(LearnerPackageSessionsEnrollDTO enrollDTO, UserDTO user, String instituteId) {
        if (enrollDTO == null || user == null || !StringUtils.hasText(instituteId)) {
            throw new VacademyException("learnerPackageSessionEnroll, user and instituteId are required");
        }
        if (enrollDTO.getPackageSessionIds() == null || enrollDTO.getPackageSessionIds().isEmpty()) {
            throw new VacademyException("packageSessionIds are required");
        }
        if (!StringUtils.hasText(enrollDTO.getEnrollInviteId()) ||
                !StringUtils.hasText(enrollDTO.getPaymentOptionId())) {
            throw new VacademyException("enrollInviteId, paymentOptionId are required");
        }
    }

    private void handleManualPaymentIfAny(PaymentInitiationRequestDTO pir,
            UserDTO createdUser,
            UserPlan userPlan,
            PaymentPlan paymentPlan,
            EnrollInvite enrollInvite) {
        if (pir == null)
            return;
        ManualPaymentDTO manual = pir.getManualRequest();
        if (manual == null)
            return;

        Double amount = paymentPlan != null ? paymentPlan.getActualPrice() : pir.getAmount();
        String currency = paymentPlan != null ? paymentPlan.getCurrency() : enrollInvite.getCurrency();

        String paymentLogId = paymentLogService.createPaymentLog(
                createdUser.getId(),
                amount != null ? amount : 0.0,
                PaymentGateway.MANUAL.name(),
                PaymentGateway.MANUAL.name(),
                currency,
                userPlan);

        Map<String, Object> paymentSpecificData = new HashMap<>();
        paymentSpecificData.put("originalRequest", pir);
        paymentSpecificData.put("manual", manual);

        paymentLogService.updatePaymentLog(
                paymentLogId,
                PaymentLogStatusEnum.SUCCESS.name(),
                PaymentStatusEnum.PAID.name(),
                JsonUtil.toJson(paymentSpecificData));
    }

    private UserDTO createUserOrGetExistingUser(UserDTO user,String instituteId) {
        return authService.createUserFromAuthService(user,instituteId,false);
    }
}