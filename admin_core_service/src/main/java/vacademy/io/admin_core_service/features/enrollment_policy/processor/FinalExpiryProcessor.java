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
import java.util.Optional;

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
    private static final ThreadLocal<Map<String, PaymentAttemptResult>> paymentAttemptCache = ThreadLocal
            .withInitial(HashMap::new);
    private static final ThreadLocal<Map<String, Boolean>> userPlanExtendedCache = ThreadLocal
            .withInitial(HashMap::new);

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

        // Check for stacked PENDING plan
        Optional<UserPlan> stackedPlan = userPlanRepository
                .findTopByUserIdAndEnrollInviteIdAndStatusInOrderByCreatedAtAsc(
                        userPlan.getUserId(),
                        userPlan.getEnrollInvite().getId(),
                        List.of(UserPlanStatusEnum.PENDING.name()));

        if (stackedPlan.isPresent()) {
            log.info("Found stacked PENDING plan ID={} for user ID={}. Activating it instead of expiring.",
                    stackedPlan.get().getId(), userPlan.getUserId());
            userPlanService.activateStackedPlan(stackedPlan.get(), userPlan);

            // Mark current plan as EXPIRED
            userPlan.setStatus(UserPlanStatusEnum.EXPIRED.name());
            userPlanRepository.save(userPlan);
            log.info("Current UserPlan {} marked as EXPIRED after activating stacked plan.", userPlan.getId());
            return;
        }

        String packageSessionId = allSubOrgMappings.get(0).getPackageSession().getId();

        // NO PAYMENT ATTEMPT HERE - Payment is only attempted in WaitingPeriodProcessor
        // After waiting period ends, just move to INVITED and EXPIRE UserPlan
        log.info("Waiting period ended. Moving all mappings to INVITED and marking UserPlan as EXPIRED for SubOrg: {}",
                subOrgId);
        notifyAdminsOfExpiry(subOrgId, packageSessionId, context);
        moveAllMappingsToInvitedAndExpireUserPlan(allSubOrgMappings, userPlan);
    }

    private void handleIndividualUserExpiry(EnrolmentContext context, UserPlan userPlan) {
        List<StudentSessionInstituteGroupMapping> mappings = context.getMappings();
        if (mappings == null || mappings.isEmpty()) {
            log.warn("No mappings found for UserPlan: {}", userPlan.getId());
            return;
        }

        // Check for stacked PENDING plan
        Optional<UserPlan> stackedPlan = userPlanRepository
                .findTopByUserIdAndEnrollInviteIdAndStatusInOrderByCreatedAtAsc(
                        userPlan.getUserId(),
                        userPlan.getEnrollInvite().getId(),
                        List.of(UserPlanStatusEnum.PENDING.name()));

        if (stackedPlan.isPresent()) {
            log.info("Found stacked PENDING plan ID={} for user ID={}. Activating it instead of expiring.",
                    stackedPlan.get().getId(), userPlan.getUserId());
            userPlanService.activateStackedPlan(stackedPlan.get(), userPlan);

            // Mark current plan as EXPIRED
            userPlan.setStatus(UserPlanStatusEnum.EXPIRED.name());
            userPlanRepository.save(userPlan);
            log.info("Current UserPlan {} marked as EXPIRED after activating stacked plan.", userPlan.getId());
            return;
        }

        // NO PAYMENT ATTEMPT HERE - Payment is only attempted in WaitingPeriodProcessor
        // After waiting period ends, just move to INVITED and EXPIRE UserPlan
        log.info("Waiting period ended. Moving mappings to INVITED and marking UserPlan as EXPIRED for UserPlan: {}",
                userPlan.getId());
        sendExpiryNotificationsToUser(context);
        moveAllMappingsToInvitedAndExpireUserPlan(mappings, userPlan);
    }

    private void sendExpiryNotificationsToUser(EnrolmentContext context) {
        // Get any policy for notification settings
        vacademy.io.admin_core_service.features.enrollment_policy.dto.EnrollmentPolicySettingsDTO policy = context
                .getPoliciesByPackageSessionId().values().stream()
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

    /**
     * Moves all ACTIVE mappings to INVITED and marks UserPlan as EXPIRED.
     * Only processes mappings whose expiryDate has been reached (not future dates).
     * Soft deletes ACTIVE mapping (marks as TERMINATED) and creates/updates INVITED
     * mapping.
     */
    private void moveAllMappingsToInvitedAndExpireUserPlan(List<StudentSessionInstituteGroupMapping> mappings,
            UserPlan userPlan) {
        log.info("Moving {} mappings to INVITED after waiting period ended", mappings.size());

        Date today = new Date();
        int processedCount = 0;

        for (StudentSessionInstituteGroupMapping mapping : mappings) {
            // Skip if mapping has future expiryDate
            if (mapping.getExpiryDate() != null && mapping.getExpiryDate().after(today)) {
                log.info("Skipping mapping {} - expiryDate {} is in the future",
                        mapping.getId(), mapping.getExpiryDate());
                continue;
            }

            try {
                // Check if INVITED mapping already exists
                StudentSessionInstituteGroupMapping existingInvited = findExistingInvitedMapping(mapping);

                if (existingInvited != null) {
                    // Update existing INVITED mapping
                    log.info("Updating existing INVITED mapping {} for expired mapping {}",
                            existingInvited.getId(), mapping.getId());
                    updateInvitedMapping(existingInvited, mapping);
                } else {
                    // Create new INVITED mapping
                    log.info("Creating new INVITED mapping for expired mapping {}", mapping.getId());
                    createInvitedEntry(mapping);
                }

                // Soft delete ACTIVE mapping (mark as TERMINATED)
                mapping.setStatus(LearnerSessionStatusEnum.TERMINATED.name());
                mappingRepository.save(mapping);
                log.info("Marked mapping {} as TERMINATED", mapping.getId());

                processedCount++;
            } catch (Exception e) {
                log.error("Failed to process mapping {} to INVITED", mapping.getId(), e);
            }
        }

        // Mark UserPlan as EXPIRED (only after waiting period)
        userPlan.setStatus(UserPlanStatusEnum.EXPIRED.name());
        userPlanRepository.save(userPlan);

        log.info("Processed {} out of {} mappings. UserPlan {} marked as EXPIRED",
                processedCount, mappings.size(), userPlan.getId());
    }

    /**
     * Finds existing INVITED mapping for the same user, package session, and
     * institute.
     */
    private StudentSessionInstituteGroupMapping findExistingInvitedMapping(
            StudentSessionInstituteGroupMapping originalMapping) {
        try {
            // Get INVITED package session for the original package session
            PackageSession invitedPackageSession = getInvitedPackageSession(originalMapping.getPackageSession());

            // Find INVITED mapping with source=EXPIRED, typeId=original package session ID
            List<StudentSessionInstituteGroupMapping> existingMappings = mappingRepository
                    .findByUserIdAndPackageSessionIdAndInstituteIdAndStatusAndSourceAndType(
                            originalMapping.getUserId(),
                            invitedPackageSession.getId(),
                            originalMapping.getInstitute().getId(),
                            LearnerSessionStatusEnum.INVITED.name(),
                            LearnerSessionSourceEnum.EXPIRED.name(),
                            LearnerSessionTypeEnum.PACKAGE_SESSION.name());

            if (existingMappings != null && !existingMappings.isEmpty()) {
                // Return first match
                return existingMappings.get(0);
            }

            return null;
        } catch (Exception e) {
            log.error("Error finding existing INVITED mapping for {}", originalMapping.getId(), e);
            return null;
        }
    }

    /**
     * Updates existing INVITED mapping with new dates.
     */
    private void updateInvitedMapping(StudentSessionInstituteGroupMapping invitedMapping,
            StudentSessionInstituteGroupMapping originalMapping) {
        // Update enrolledDate to current date
        invitedMapping.setEnrolledDate(new Date());

        // Update typeId to point to the expired package session
        invitedMapping.setTypeId(originalMapping.getPackageSession().getId());

        // Update destinationPackageSession
        invitedMapping.setDestinationPackageSession(originalMapping.getPackageSession());

        // Copy UserPlanId
        invitedMapping.setUserPlanId(originalMapping.getUserPlanId());

        // Copy sub-org info if exists
        if (originalMapping.getSubOrg() != null) {
            invitedMapping.setSubOrg(originalMapping.getSubOrg());
        }
        if (StringUtils.hasText(originalMapping.getCommaSeparatedOrgRoles())) {
            invitedMapping.setCommaSeparatedOrgRoles(originalMapping.getCommaSeparatedOrgRoles());
        }

        mappingRepository.save(invitedMapping);
        log.info("Updated INVITED mapping: {} with new enrolledDate and typeId from expired mapping: {}",
                invitedMapping.getId(), originalMapping.getId());
    }

    /**
     * Creates new INVITED entry for an expired mapping.
     */
    private StudentSessionInstituteGroupMapping createInvitedEntry(StudentSessionInstituteGroupMapping mapping) {
        StudentSessionInstituteGroupMapping invited = new StudentSessionInstituteGroupMapping();

        invited.setUserId(mapping.getUserId());
        invited.setInstituteEnrolledNumber(mapping.getInstituteEnrolledNumber());
        invited.setEnrolledDate(new Date());
        invited.setStatus(LearnerSessionStatusEnum.INVITED.name());

        invited.setGroup(mapping.getGroup());
        invited.setInstitute(mapping.getInstitute());
        invited.setPackageSession(getInvitedPackageSession(mapping.getPackageSession()));
        invited.setDestinationPackageSession(mapping.getPackageSession());

        // Set type, typeId, and source
        invited.setUserPlanId(mapping.getUserPlanId());
        invited.setType(LearnerSessionTypeEnum.PACKAGE_SESSION.name());
        invited.setTypeId(mapping.getPackageSession().getId()); // Original expired package session ID
        invited.setSource(LearnerSessionSourceEnum.EXPIRED.name());
        invited.setDesiredLevelId(mapping.getDesiredLevelId());
        invited.setDesiredPackageId(mapping.getDesiredPackageId());
        invited.setAutomatedCompletionCertificateFileId(mapping.getAutomatedCompletionCertificateFileId());

        // Copy sub-org if exists
        if (mapping.getSubOrg() != null) {
            invited.setSubOrg(mapping.getSubOrg());
        }
        if (StringUtils.hasText(mapping.getCommaSeparatedOrgRoles())) {
            invited.setCommaSeparatedOrgRoles(mapping.getCommaSeparatedOrgRoles());
        }

        mappingRepository.save(invited);
        log.info("Created INVITED entry for expired mapping: {}, typeId set to original package session ID: {}",
                invited.getId(), mapping.getPackageSession().getId());
        return invited;
    }

    /**
     * Gets the INVITED package session for a given ACTIVE package session.
     * INVITED package session is identified by levelId="INVITED" and
     * sessionId="INVITED".
     */
    private PackageSession getInvitedPackageSession(PackageSession activePackageSession) {

        return packageSessionRepository
                .findInvitedPackageSessionForPackage(
                        activePackageSession.getId(),
                        "INVITED", // levelId
                        "INVITED", // sessionId
                        List.of(PackageSessionStatusEnum.INVITED.name()),
                        List.of(PackageSessionStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name()),
                        List.of(PackageStatusEnum.ACTIVE.name()))
                .orElseThrow(() -> new VacademyException(
                        "No INVITED package session found for package: " + activePackageSession.getId() +
                                " (levelId=INVITED, sessionId=INVITED)"));
    }

    private void notifyAdminsOfExpiry(String subOrgId, String packageSessionId, EnrolmentContext context) {
        try {
            sendExpiryNotificationsToUser(context);
            log.info("Sent expiry notifications to ROOT_ADMIN for sub-org: {}", subOrgId);
        } catch (Exception e) {
            log.error("Error notifying ROOT_ADMIN of expiry for sub-org: {}", subOrgId, e);
        }
    }

    // ...existing code for notifications...
}
