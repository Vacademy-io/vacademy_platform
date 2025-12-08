package vacademy.io.admin_core_service.features.enrollment_policy.processor;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.ChannelNotificationDTO;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.NotificationPolicyDTO;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.OnExpiryPolicyDTO;
import vacademy.io.admin_core_service.features.enrollment_policy.enums.NotificationTriggerType;
import vacademy.io.admin_core_service.features.enrollment_policy.enums.NotificationType;
import vacademy.io.admin_core_service.features.enrollment_policy.notification.NotificationServiceFactory;
import vacademy.io.admin_core_service.features.enrollment_policy.service.PaymentRenewalCheckService;
import vacademy.io.admin_core_service.features.enrollment_policy.service.SubOrgPaymentService;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionSourceEnum;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionTypeEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.enums.PackageStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanSourceEnum;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
import vacademy.io.admin_core_service.features.user_subscription.service.UserPlanService;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.session.PackageSession;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class FinalExpiryProcessor implements IEnrolmentPolicyProcessor {

    private final ObjectMapper objectMapper = new ObjectMapper();

    private final StudentSessionInstituteGroupMappingRepository mappingRepository;
    private final PackageSessionRepository packageSessionRepository;
    private final StudentSessionRepository studentSessionRepository;
    private final UserPlanService userPlanService;
    private final UserPlanRepository userPlanRepository;
    private final SubOrgPaymentService subOrgPaymentService;
    private final NotificationServiceFactory notificationServiceFactory;
    private final PaymentRenewalCheckService paymentRenewalCheckService;

    // ThreadLocal caches to prevent duplicate payment attempts and extensions
    private static final ThreadLocal<Map<String, PaymentAttemptResult>> paymentAttemptCache = 
        ThreadLocal.withInitial(HashMap::new);
    private static final ThreadLocal<Map<String, Boolean>> userPlanExtendedCache = 
        ThreadLocal.withInitial(HashMap::new);

    @Override
    @Transactional
    public void process(EnrolmentContext context) {
        try {
            UserPlan userPlan = context.getUserPlan();
            
            if (userPlan == null) {
                log.warn("UserPlan not found in context");
                return;
            }
            
            long daysPastExpiry = context.getDaysPastExpiry();
            Integer waitingPeriod = context.getWaitingPeriod();

            // Only process if waiting period has ended
            if (waitingPeriod == null || daysPastExpiry <= waitingPeriod) {
                return; // Still in waiting period
            }

            log.info("Waiting period ended ({} days), processing final expiry for UserPlan: {}", 
                    waitingPeriod, userPlan.getId());

            boolean isSubOrg = context.isSubOrg();

            if (isSubOrg) {
                log.info("Processing SUB_ORG expiry for UserPlan: {}, SubOrg: {}", 
                        userPlan.getId(), context.getSubOrgId());
                handleSubOrgExpiry(context, userPlan);
            } else {
                log.info("Processing individual USER expiry for UserPlan: {}", userPlan.getId());
                handleIndividualUserExpiry(context, userPlan);
            }
        } finally {
            paymentAttemptCache.remove();
            userPlanExtendedCache.remove();
        }
    }

    private void handleSubOrgExpiry(EnrolmentContext context, UserPlan userPlan) {
        String subOrgId = context.getSubOrgId();
        List<StudentSessionInstituteGroupMapping> allSubOrgMappings = context.getMappings();
        
        if (allSubOrgMappings == null || allSubOrgMappings.isEmpty()) {
            log.warn("No mappings found for UserPlan: {}", userPlan.getId());
            return;
        }
        
        String packageSessionId = allSubOrgMappings.get(0).getPackageSession().getId();
        
        // ... existing payment logic using allSubOrgMappings...
    }
    
    private void handleIndividualUserExpiry(EnrolmentContext context, UserPlan userPlan) {
        List<StudentSessionInstituteGroupMapping> mappings = context.getMappings();
        if (mappings == null || mappings.isEmpty()) {
            log.warn("No mappings found for UserPlan: {}", userPlan.getId());
            return;
        }
        
        StudentSessionInstituteGroupMapping mapping = mappings.get(0); // Get first mapping
        
        // Get policy for this mapping
        String packageSessionId = mapping.getPackageSession().getId();
        vacademy.io.admin_core_service.features.enrollment_policy.dto.EnrollmentPolicySettingsDTO policy = 
            context.getPolicyForPackageSession(packageSessionId);
            
        if (policy == null) {
            log.warn("No policy found for package session: {}", packageSessionId);
            return;
        }
        
        boolean shouldAttemptPayment = paymentRenewalCheckService.shouldAttemptPayment(userPlan, policy);
        
        // ... existing payment logic...
    }
    
    private void sendExpiryNotificationsToUser(EnrolmentContext context) {
        // Get any policy for notification settings
        vacademy.io.admin_core_service.features.enrollment_policy.dto.EnrollmentPolicySettingsDTO policy = 
            context.getPoliciesByPackageSessionId().values().stream()
                .findFirst()
                .orElse(null);
                
        if (policy == null || policy.getNotifications() == null) {
            return;
        }

        List<NotificationPolicyDTO> expiryNotifications = policy.getNotifications().stream()
                .filter(p -> NotificationTriggerType.ON_EXPIRY_DATE_REACHED.equals(p.getTrigger()))
                .toList();

        for (NotificationPolicyDTO notification : expiryNotifications) {
            try {
                sendChannelNotifications(context, notification);
            } catch (Exception e) {
                log.error("Error sending expiry notification to user: {}", context.getUser().getId(), e);
            }
        }
    }
    
    private void sendExpiryNotificationsToAdmins(EnrolmentContext context) {
        // Same as sendExpiryNotificationsToUser - get policy from map
        sendExpiryNotificationsToUser(context);
    }

    private void sendChannelNotifications(EnrolmentContext context, NotificationPolicyDTO policy) {
        if (policy.getNotifications() == null || policy.getNotifications().isEmpty()) {
            log.warn("No channel notifications configured in policy for trigger: {}", policy.getTrigger());
            return;
        }

        for (ChannelNotificationDTO channelNotification : policy.getNotifications()) {
            try {
                String channel = channelNotification.getChannel();
                if (!StringUtils.hasText(channel)) {
                    channel = NotificationType.EMAIL.name(); // Default
                }

                NotificationType notificationType;
                try {
                    notificationType = NotificationType.valueOf(channel.toUpperCase());
                } catch (IllegalArgumentException e) {
                    log.warn("Unsupported channel type: {}, skipping", channel);
                    continue;
                }

                NotificationPolicyDTO channelPolicy = NotificationPolicyDTO.builder()
                        .trigger(policy.getTrigger())
                        .daysBefore(policy.getDaysBefore())
                        .sendEveryNDays(policy.getSendEveryNDays())
                        .maxSends(policy.getMaxSends())
                        .notifications(List.of(channelNotification))
                        .build();

                notificationServiceFactory
                        .getService(notificationType)
                        .sendNotification(context, channelPolicy);
            } catch (Exception e) {
                log.error("Error sending notification for channel: {}", channelNotification.getChannel(), e);
            }
        }
    }

    // ... existing code for other methods...
}
