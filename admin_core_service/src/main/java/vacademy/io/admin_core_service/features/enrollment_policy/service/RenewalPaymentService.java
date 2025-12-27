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
     * Calculates new end date based on subscription period
     */
    private Date calculateNewEndDate(UserPlan userPlan) {
        Date currentEndDate = userPlan.getEndDate();
        if (currentEndDate == null) {
            currentEndDate = new Date();
        }

        // Calculate extension period based on payment plan
        // This is a simplified version - adjust based on your actual plan structure
        int daysToAdd = 30; // Default 30 days
        
        // TODO: Extract actual period from paymentPlan or planJson
        
        Calendar calendar = Calendar.getInstance();
        calendar.setTime(currentEndDate);
        calendar.add(Calendar.DAY_OF_MONTH, daysToAdd);
        
        return calendar.getTime();
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
        }
    }
}
