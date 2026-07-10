package vacademy.io.admin_core_service.features.enrollment_policy.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.enroll_invite.service.SubOrgService;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentLogRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanSourceEnum;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.payment.enums.PaymentStatusEnum;

import java.util.Calendar;
import java.util.Date;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class RenewalPaymentService {

    private final UserPlanRepository userPlanRepository;
    private final StudentSessionInstituteGroupMappingRepository mappingRepository;
    private final SubOrgService subOrgService;
    private final PaymentLogRepository paymentLogRepository;

    /**
     * Handles renewal payment confirmation from webhook
     */
    @Transactional
    public void handleRenewalPaymentConfirmation(String orderId, String instituteId, 
                                                  PaymentStatusEnum paymentStatus, Object paymentDetails) {
        log.info("Handling renewal payment confirmation: orderId={}, status={}", orderId, paymentStatus);

        // Find UserPlan by orderId (assuming orderId maps to UserPlan)
        // You may need to adjust this based on how orderId relates to UserPlan
        PaymentLog paymentLog = paymentLogRepository.findById(orderId).orElseThrow(()->new VacademyException("Payment Log not found with id "+orderId));
        if (paymentLog == null) {
            log.warn("No UserPlan found for orderId: {}", orderId);
            return;
        }
        UserPlan userPlan = paymentLog.getUserPlan();
        if (paymentStatus == PaymentStatusEnum.PAID) {
            handleSuccessfulRenewal(userPlan, instituteId);
        } else if (paymentStatus == PaymentStatusEnum.FAILED) {
            handleFailedRenewal(userPlan, instituteId);
        } else {
            log.info("Payment status is PENDING for orderId: {}, waiting for final status", orderId);
        }
    }

    /**
     * Handles successful renewal payment
     */
    private void handleSuccessfulRenewal(UserPlan userPlan, String instituteId) {
        log.info("Processing successful renewal for UserPlan: {}", userPlan.getId());

        try {
            // Extend UserPlan endDate based on subscription period
            Date newEndDate = calculateNewEndDate(userPlan);
            userPlan.setEndDate(newEndDate);
            // Successful renewal clears the trial flag and dunning counters, and
            // moves the next charge to the new end date so the cycle repeats.
            userPlan.setIsTrial(false);
            userPlan.setRenewalAttemptCount(0);
            userPlan.setLastRenewalAttemptAt(null);
            userPlan.setNextChargeAt(newEndDate);
            userPlanRepository.save(userPlan);

            log.info("Extended UserPlan {} endDate to: {}", userPlan.getId(), newEndDate);

            // Extend all ACTIVE mappings for this UserPlan
            List<StudentSessionInstituteGroupMapping> activeMappings =
                mappingRepository.findByUserPlanIdAndStatus(userPlan.getId(), LearnerSessionStatusEnum.ACTIVE.name());

            for (StudentSessionInstituteGroupMapping mapping : activeMappings) {
                mapping.setExpiryDate(newEndDate);
                mappingRepository.save(mapping);
                log.info("Extended mapping {} expiryDate to: {}", mapping.getId(), newEndDate);
            }

            // Send success notification
            sendRenewalSuccessNotification(userPlan, instituteId, newEndDate);

        } catch (Exception e) {
            log.error("Error processing successful renewal for UserPlan: {}", userPlan.getId(), e);
        }
    }

    /**
     * Handles failed renewal payment
     */
    private void handleFailedRenewal(UserPlan userPlan, String instituteId) {
        log.info("Processing failed renewal for UserPlan: {}", userPlan.getId());

        try {
            // Send failure notification to user or ROOT_ADMIN (for SUB_ORG)
            sendRenewalFailureNotification(userPlan, instituteId);

        } catch (Exception e) {
            log.error("Error processing failed renewal for UserPlan: {}", userPlan.getId(), e);
        }
    }

    /**
     * Calculates the new end date from the payment plan's real validity, not a
     * hardcoded 30 days. Extends from the current end date when it's still in
     * the future (so consecutive cycles don't drift), otherwise from today.
     */
    private Date calculateNewEndDate(UserPlan userPlan) {
        Date now = new Date();
        Date base = userPlan.getEndDate();
        if (base == null || base.before(now)) {
            base = now;
        }

        int daysToAdd = resolveValidityDays(userPlan);

        Calendar calendar = Calendar.getInstance();
        calendar.setTime(base);
        calendar.add(Calendar.DAY_OF_MONTH, daysToAdd);
        return calendar.getTime();
    }

    /**
     * Validity days for the plan, from the linked PaymentPlan (falling back to
     * the plan snapshot on user_plan.plan_json), defaulting to 30 only if
     * nothing is resolvable.
     */
    private int resolveValidityDays(UserPlan userPlan) {
        if (userPlan.getPaymentPlan() != null && userPlan.getPaymentPlan().getValidityInDays() != null
                && userPlan.getPaymentPlan().getValidityInDays() > 0) {
            return userPlan.getPaymentPlan().getValidityInDays();
        }
        if (StringUtils.hasText(userPlan.getPlanJson())) {
            try {
                var node = new com.fasterxml.jackson.databind.ObjectMapper().readTree(userPlan.getPlanJson());
                var v = node.get("validityInDays");
                if (v == null) {
                    v = node.get("validity_in_days");
                }
                if (v != null && v.asInt() > 0) {
                    return v.asInt();
                }
            } catch (Exception e) {
                log.debug("Could not read validityInDays from plan_json for UserPlan: {}", userPlan.getId());
            }
        }
        log.warn("No validity_in_days resolvable for UserPlan: {} — defaulting to 30 days", userPlan.getId());
        return 30;
    }

    /**
     * Sends renewal success notification
     */
    private void sendRenewalSuccessNotification(UserPlan userPlan, String instituteId, Date newEndDate) {
        boolean isSubOrg = UserPlanSourceEnum.SUB_ORG.name().equals(userPlan.getSource()) 
            && StringUtils.hasText(userPlan.getSubOrgId());

        if (isSubOrg) {
            // Send to ROOT_ADMIN for SUB_ORG
            log.info("Sending renewal success notification to ROOT_ADMIN for SubOrg: {}", userPlan.getSubOrgId());
            // TODO: Get ROOT_ADMIN and send notification
            // UserDTO rootAdmin = subOrgService.getRootAdminForSubOrg(userPlan.getSubOrgId());
            // notificationService.sendRenewalSuccessEmail(rootAdmin, userPlan, newEndDate);
        } else {
            // Send to individual user
            log.info("Sending renewal success notification to user: {}", userPlan.getUserId());
            // TODO: Get user and send notification
            // UserDTO user = authService.getUserById(userPlan.getUserId());
            // notificationService.sendRenewalSuccessEmail(user, userPlan, newEndDate);
            // When implementing, also append a billing-contact recipient via
            // BillingContactRecipientResolver.buildBillingContactRecipient(userPlan.getUserId(), user.getEmail())
            // so renewal confirmations reach the same billing inbox as the initial invoice.
        }
    }

    /**
     * Sends renewal failure notification
     */
    private void sendRenewalFailureNotification(UserPlan userPlan, String instituteId) {
        boolean isSubOrg = UserPlanSourceEnum.SUB_ORG.name().equals(userPlan.getSource()) 
            && StringUtils.hasText(userPlan.getSubOrgId());

        if (isSubOrg) {
            // Send to ROOT_ADMIN only for SUB_ORG
            log.info("Sending renewal failure notification to ROOT_ADMIN for SubOrg: {}", userPlan.getSubOrgId());
            // TODO: Get ROOT_ADMIN and send notification
            // UserDTO rootAdmin = subOrgService.getRootAdminForSubOrg(userPlan.getSubOrgId());
            // notificationService.sendRenewalFailureEmail(rootAdmin, userPlan);
        } else {
            // Send to individual user
            log.info("Sending renewal failure notification to user: {}", userPlan.getUserId());
            // TODO: Get user and send notification
            // UserDTO user = authService.getUserById(userPlan.getUserId());
            // notificationService.sendRenewalFailureEmail(user, userPlan);
            // When implementing, also append a billing-contact recipient via
            // BillingContactRecipientResolver.buildBillingContactRecipient(userPlan.getUserId(), user.getEmail())
            // so dunning / failed-renewal emails reach the same billing inbox.
        }
    }
}
