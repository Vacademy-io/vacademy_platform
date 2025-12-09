package vacademy.io.admin_core_service.features.enrollment_policy.processor;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.EnrollmentPolicySettingsDTO;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.NotificationPolicyDTO;
import vacademy.io.admin_core_service.features.enrollment_policy.enums.NotificationTriggerType;
import vacademy.io.admin_core_service.features.enrollment_policy.enums.NotificationType;
import vacademy.io.admin_core_service.features.enrollment_policy.notification.NotificationServiceFactory;
import vacademy.io.admin_core_service.features.enrollment_policy.service.PaymentRenewalCheckService;
import vacademy.io.admin_core_service.features.enrollment_policy.service.SubOrgAdminService;
import vacademy.io.admin_core_service.features.enrollment_policy.service.SubOrgPaymentService;
import com.fasterxml.jackson.databind.ObjectMapper;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionSourceEnum;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionTypeEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.enums.PackageStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentLogRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanSourceEnum;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.service.UserPlanService;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class WaitingPeriodProcessor implements IEnrolmentPolicyProcessor {

    private final NotificationServiceFactory notificationServiceFactory;
    private final SubOrgAdminService subOrgAdminService;
    private final SubOrgPaymentService subOrgPaymentService;
    private final UserPlanService userPlanService;
    private final UserPlanRepository userPlanRepository;
    private final StudentSessionInstituteGroupMappingRepository mappingRepository;
    private final StudentSessionRepository studentSessionRepository;
    private final PackageSessionRepository packageSessionRepository;
    private final PaymentRenewalCheckService paymentRenewalCheckService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Add PaymentLogRepository for checking payment status
    private final PaymentLogRepository paymentLogRepository;

    @Override
    @Transactional
    public void process(EnrolmentContext context) {
        long daysPastExpiry = context.getDaysPastExpiry();
        UserPlan userPlan = context.getUserPlan();

        if (userPlan == null) {
            log.warn("No UserPlan found in context");
            return;
        }

        boolean isSubOrg = context.isSubOrg();
        String subOrgId = context.getSubOrgId();
        List<StudentSessionInstituteGroupMapping> allMappings = context.getMappings();

        if (allMappings == null || allMappings.isEmpty()) {
            log.warn("No mappings found for UserPlan: {}", userPlan.getId());
            return;
        }

        Integer waitingPeriod = context.getWaitingPeriod();

        // Handle ON_EXPIRY_DATE_REACHED trigger (Day 0 - daysPastExpiry == 0)
        if (daysPastExpiry == 0) {
            log.info("Day 0: Expiry date reached for UserPlan: {}", userPlan.getId());

            // Check if at least one package session policy allows auto-renewal
            boolean shouldAttemptPayment = allMappings.stream()
                    .map(StudentSessionInstituteGroupMapping::getPackageSession)
                    .filter(ps -> ps != null && ps.getId() != null)
                    .map(ps -> context.getPolicyForPackageSession(ps.getId()))
                    .filter(policy -> policy != null)
                    .anyMatch(policy -> paymentRenewalCheckService.shouldAttemptPayment(userPlan, policy));

            if (shouldAttemptPayment) {
                // Process payment once for all mappings (PAYMENT ATTEMPT #1)
                String packageSessionId = allMappings.get(0).getPackageSession().getId();
                processPaymentOnExpiry(context, userPlan, isSubOrg, subOrgId, packageSessionId);
            } else {
                // Payment not attempted (no policy allows auto-renewal, or FREE/DONATION/ONE_TIME)
                log.info("Payment not attempted for UserPlan: {} (no policy allows auto-renewal)", userPlan.getId());
                handleNonRenewableExpiry(context, userPlan, subOrgId, isSubOrg);
            }
        }

        // Handle LAST DAY OF WAITING PERIOD (PAYMENT RETRY #2)
        if (waitingPeriod != null && waitingPeriod > 0 && daysPastExpiry == waitingPeriod) {
            log.info("Last day of waiting period (Day {}): Checking if payment retry needed for UserPlan: {}",
                    waitingPeriod, userPlan.getId());

            // Check if at least one package session policy allows auto-renewal
            boolean shouldAttemptPayment = allMappings.stream()
                    .map(StudentSessionInstituteGroupMapping::getPackageSession)
                    .filter(ps -> ps != null && ps.getId() != null)
                    .map(ps -> context.getPolicyForPackageSession(ps.getId()))
                    .filter(policy -> policy != null)
                    .anyMatch(policy -> paymentRenewalCheckService.shouldAttemptPayment(userPlan, policy));

            if (shouldAttemptPayment) {
                // Check if first payment attempt FAILED
                boolean firstPaymentFailed = checkIfFirstPaymentFailed(userPlan);

                if (firstPaymentFailed) {
                    // Retry payment once for all mappings (PAYMENT ATTEMPT #2)
                    String packageSessionId = allMappings.get(0).getPackageSession().getId();
                    processPaymentRetryOnLastDay(context, userPlan, isSubOrg, subOrgId, packageSessionId);
                } else {
                    log.info("Skipping payment retry - first payment did not fail (either SUCCESS or PENDING). UserPlan: {}",
                            userPlan.getId());
                }
            } else {
                log.info("Payment retry not attempted for UserPlan: {} (no policy allows auto-renewal)",
                        userPlan.getId());
            }
        }

        // Process notifications based on each mapping's policy
        processNotifications(context, daysPastExpiry);
    }

    /**
     * Process notifications based on each mapping's policy.
     * For SUB_ORG: Send ONE notification to ROOT_ADMIN (context.user is already ROOT_ADMIN)
     * For Individual: Send notification to the user
     */
    private void processNotifications(EnrolmentContext context, long daysPastExpiry) {
        if (context.isSubOrg()) {
            // For SUB_ORG: Send one consolidated notification to ROOT_ADMIN
            processSubOrgNotifications(context, daysPastExpiry);
        } else {
            // For Individual: Process notifications per mapping's policy
            processIndividualNotifications(context, daysPastExpiry);
        }
    }

    /**
     * Send ONE notification to ROOT_ADMIN for all mappings
     */
    private void processSubOrgNotifications(EnrolmentContext context, long daysPastExpiry) {
        // Check if any policy has notifications for this day
        for (Map.Entry<String, EnrollmentPolicySettingsDTO> entry : context.getPoliciesByPackageSessionId().entrySet()) {
            EnrollmentPolicySettingsDTO policy = entry.getValue();

            if (policy.getNotifications() == null) {
                continue;
            }

            List<NotificationPolicyDTO> notifications = policy.getNotifications().stream()
                    .filter(n -> shouldSendNotification(n, daysPastExpiry))
                    .toList();

            if (!notifications.isEmpty()) {
                // Send to ROOT_ADMIN (context.user is already ROOT_ADMIN)
                for (NotificationPolicyDTO notification : notifications) {
                    try {
                        sendChannelNotifications(context, notification);
                        log.info("Sent notification to ROOT_ADMIN for SubOrg: {}", context.getSubOrgId());
                    } catch (Exception e) {
                        log.error("Error sending notification to ROOT_ADMIN", e);
                    }
                }
                break; // Send once, not per policy
            }
        }
    }

    /**
     * Send notifications per mapping's policy for individual users
     */
    private void processIndividualNotifications(EnrolmentContext context, long daysPastExpiry) {
        for (StudentSessionInstituteGroupMapping mapping : context.getMappings()) {
            String packageSessionId = mapping.getPackageSession().getId();
            EnrollmentPolicySettingsDTO policy = context.getPolicyForPackageSession(packageSessionId);

            if (policy == null || policy.getNotifications() == null) {
                continue;
            }

            List<NotificationPolicyDTO> notifications = policy.getNotifications().stream()
                    .filter(n -> shouldSendNotification(n, daysPastExpiry))
                    .toList();

            for (NotificationPolicyDTO notification : notifications) {
                try {
                    sendChannelNotifications(context, notification);
                } catch (Exception e) {
                    log.error("Error sending notification for mapping: {}", mapping.getId(), e);
                }
            }
        }
    }

    /**
     * Check if notification should be sent for this day
     */
    private boolean shouldSendNotification(NotificationPolicyDTO notification, long daysPastExpiry) {
        if (NotificationTriggerType.ON_EXPIRY_DATE_REACHED.equals(notification.getTrigger())) {
            return daysPastExpiry == 0;
        }
        if (NotificationTriggerType.DURING_WAITING_PERIOD.equals(notification.getTrigger())) {
            return notification.getSendEveryNDays() != null
                    && notification.getSendEveryNDays() > 0
                    && daysPastExpiry > 0
                    && daysPastExpiry % notification.getSendEveryNDays() == 0;
        }
        return false;
    }

    /**
     * Processes payment on expiry date (ON_EXPIRY_DATE_REACHED).
     * Payment is attempted only once per UserPlan.
     *
     * ⚠️ IMPORTANT: This method ONLY initiates payment and waits for webhook.
     * NO date extensions or status updates happen here.
     * All processing happens in RenewalPaymentService when webhook is received.
     */
    private void processPaymentOnExpiry(EnrolmentContext context, UserPlan userPlan,
                                        boolean isSubOrg, String subOrgId, String packageSessionId) {
        log.info("Initiating payment on expiry date for UserPlan: {} (SubOrg: {})",
                userPlan.getId(), isSubOrg);

        try {
            // Only initiate payment - do NOT process result here
            vacademy.io.common.payment.dto.PaymentResponseDTO paymentResponse = subOrgPaymentService
                    .processSubOrgPaymentOnExpiry(context, userPlan);

            log.info("Payment initiated for UserPlan: {}. Waiting for webhook confirmation. Response: {}",
                    userPlan.getId(), paymentResponse.getOrderId());

            userPlanRepository.save(userPlan);

            log.info("Payment status set to PENDING for UserPlan: {}. No further processing until webhook received.",
                    userPlan.getId());

        } catch (Exception e) {
            log.error("Failed to initiate payment on expiry date for UserPlan: {}", userPlan.getId(), e);

            userPlanRepository.save(userPlan);

            // Send failure notification
            if (isSubOrg && StringUtils.hasText(subOrgId)) {
                notifyAdminsOfPaymentFailure(subOrgId, packageSessionId, context);
            }

            log.warn("Payment initiation failed. UserPlan {} marked as FAILED. User/Admin notified.",
                    userPlan.getId());
        }
    }

    /**
     * Processes payment retry on last day of waiting period (PAYMENT ATTEMPT #2).
     * This is the final attempt before moving to INVITED.
     */
    private void processPaymentRetryOnLastDay(EnrolmentContext context, UserPlan userPlan,
                                              boolean isSubOrg, String subOrgId, String packageSessionId) {
        log.info("Retrying payment on last day of waiting period for UserPlan: {} (SubOrg: {})",
                userPlan.getId(), isSubOrg);

        try {
            // Retry payment - do NOT process result here
            vacademy.io.common.payment.dto.PaymentResponseDTO paymentResponse = subOrgPaymentService
                    .processSubOrgPaymentOnExpiry(context, userPlan);

            log.info("Payment retry initiated (ATTEMPT #2) for UserPlan: {}. Waiting for webhook confirmation. OrderId: {}",
                    userPlan.getId(), paymentResponse.getOrderId());

            // Payment is tracked via PaymentLog, webhook will handle the result

        } catch (Exception e) {
            log.error("Failed to initiate payment retry on last day for UserPlan: {}", userPlan.getId(), e);

            // Send failure notification
            if (isSubOrg && StringUtils.hasText(subOrgId)) {
                notifyAdminsOfPaymentFailure(subOrgId, packageSessionId, context);
            }
        }
    }

    /**
     * Handles successful payment - REMOVED
     * This logic now lives in RenewalPaymentService.handleRenewalPaymentConfirmation()
     * which is called by webhook handlers
     */
    @Deprecated
    private void handleSuccessfulPayment(EnrolmentContext context, UserPlan userPlan,
                                         boolean isSubOrg, String subOrgId, String packageSessionId) {
        // This method is deprecated - all processing happens via webhook
        log.warn("handleSuccessfulPayment called - this should not happen. Processing should be via webhook.");
    }

    /**
     * Handles failed payment - REMOVED
     * This logic now lives in RenewalPaymentService.handleRenewalPaymentConfirmation()
     * which is called by webhook handlers
     */
    @Deprecated
    private void handleFailedPayment(EnrolmentContext context, UserPlan userPlan,
                                     boolean isSubOrg, String subOrgId, String packageSessionId,
                                     List<StudentSessionInstituteGroupMapping> allMappings) {
        // This method is deprecated - all processing happens via webhook
        log.warn("handleFailedPayment called - this should not happen. Processing should be via webhook.");
    }

    /**
     * Handles payment result - extends UserPlan once, then extends mappings only if
     * their policy allows re-enrollment.
     * Uses mappings from context (no DB call needed).
     */
    private void handlePaymentResult(EnrolmentContext context, UserPlan userPlan,
                                     boolean isSubOrg, String subOrgId, String packageSessionId, boolean successful) {

        if (successful) {
            // Payment succeeded - extend UserPlan once, then extend mappings only if their
            // policy allows re-enrollment
            log.info(
                    "Payment successful on expiry date, extending UserPlan and checking re-enrollment policies for mappings");

            // Use mappings from context (already fetched, no DB call needed)
            List<StudentSessionInstituteGroupMapping> allMappings = context.getAllMappings();
            if (allMappings == null || allMappings.isEmpty()) {
                log.warn("No mappings found in context for UserPlan: {}", userPlan.getId());
                return;
            }

            // Extend only mappings whose policy allows re-enrollment
            for (StudentSessionInstituteGroupMapping mapping : allMappings) {
                // Get policy from this mapping's package session
                String policyJson = mapping.getPackageSession() != null
                        ? mapping.getPackageSession().getEnrollmentPolicySettings()
                        : null;

                if (policyJson != null && !policyJson.isBlank()) {
                    try {
                        // Parse policy to check re-enrollment setting
                        vacademy.io.admin_core_service.features.enrollment_policy.dto.EnrollmentPolicySettingsDTO policy = objectMapper
                                .readValue(policyJson,
                                        vacademy.io.admin_core_service.features.enrollment_policy.dto.EnrollmentPolicySettingsDTO.class);

                        // Check if re-enrollment is allowed
                        boolean allowReenrollment = policy.getReenrollmentPolicy() != null
                                && Boolean.TRUE
                                .equals(policy.getReenrollmentPolicy().getAllowReenrollmentAfterExpiry());

                        if (allowReenrollment) {
                            // Extend this mapping (only mapping expiryDate, not UserPlan)
                            extendSingleMapping(mapping, userPlan);
                            log.info("Extended mapping {} after successful payment (re-enrollment allowed by policy)",
                                    mapping.getId());
                        } else {
                            log.info("Skipping extension for mapping {} - re-enrollment not allowed by policy",
                                    mapping.getId());
                        }
                    } catch (Exception e) {
                        log.error("Failed to parse policy for mapping: {}", mapping.getId(), e);
                        // Default to not extending if policy parsing fails
                    }
                } else {
                    log.warn("No policy found for mapping: {}, skipping extension", mapping.getId());
                }
            }

            // Update UserPlan status to ACTIVE
            userPlan.setStatus(UserPlanStatusEnum.ACTIVE.name());
            userPlanRepository.save(userPlan);
        } else {
            // Payment failed - check waiting period
            // Use mappings from context (already fetched, no DB call needed)
            List<StudentSessionInstituteGroupMapping> allMappings = context.getAllMappings();
            if (allMappings == null || allMappings.isEmpty()) {
                log.warn("No mappings found in context for UserPlan: {}", userPlan.getId());
                return;
            }

            Integer waitingPeriod = context.getWaitingPeriod();
            if (waitingPeriod != null && waitingPeriod == 0) {
                // No waiting period - immediately move to INVITED
                log.warn("Payment failed on expiry date with waiting period = 0, moving to INVITED immediately");
                if (isSubOrg && StringUtils.hasText(subOrgId)) {
                    notifyAdminsOfPaymentFailure(subOrgId, packageSessionId, context);
                }
                moveAllMappingsToInvited(allMappings, userPlan);
            } else {
                // Has waiting period - mark UserPlan as EXPIRED, keep mappings ACTIVE
                log.warn("Payment failed on expiry date, marking UserPlan as EXPIRED (waiting period: {} days)",
                        waitingPeriod);
                if (isSubOrg && StringUtils.hasText(subOrgId)) {
                    notifyAdminsOfPaymentFailure(subOrgId, packageSessionId, context);
                }
                // Only mark UserPlan as EXPIRED, keep mappings ACTIVE during waiting period
                markUserPlanAsExpired(userPlan);
            }
        }
    }

    /**
     * Extends UserPlan once when payment succeeds.
     * UserPlan.startDate remains unchanged.
     * UserPlan.endDate is extended from current endDate + validityDays.
     */
    private void extendUserPlan(UserPlan userPlan) {
        if (userPlan.getPaymentPlan() == null) {
            log.warn("PaymentPlan not found for UserPlan: {}, cannot extend UserPlan", userPlan.getId());
            return;
        }

        Integer validityDays = userPlan.getPaymentPlan().getValidityInDays();
        if (validityDays == null || validityDays <= 0) {
            log.warn("Invalid validity days: {} for PaymentPlan: {}", validityDays, userPlan.getPaymentPlan().getId());
            return;
        }

        // Extend UserPlan.endDate from current endDate (or today if null)
        java.util.Date userPlanBaseDate = userPlan.getEndDate();
        if (userPlanBaseDate == null) {
            userPlanBaseDate = new java.util.Date();
            log.warn("UserPlan {} has no endDate, using today as base date", userPlan.getId());
        }
        java.util.Date newUserPlanEndDate = addDaysToDate(userPlanBaseDate, validityDays);

        // Update UserPlan: keep startDate unchanged, extend endDate
        userPlan.setEndDate(newUserPlanEndDate);
        userPlanRepository.save(userPlan);
        log.info("Extended UserPlan: {} endDate from {} to {} (startDate unchanged: {})",
                userPlan.getId(), userPlanBaseDate, newUserPlanEndDate, userPlan.getStartDate());
    }

    /**
     * Extends a single mapping's expiryDate when payment succeeds.
     * Only extends the mapping's expiryDate, NOT UserPlan (UserPlan is extended
     * separately once).
     * Mapping's expiryDate is extended from its own current expiryDate +
     * validityDays.
     */
    private void extendSingleMapping(StudentSessionInstituteGroupMapping mapping, UserPlan userPlan) {
        if (userPlan.getPaymentPlan() == null) {
            log.warn("PaymentPlan not found for UserPlan: {}, cannot extend mapping", userPlan.getId());
            return;
        }

        Integer validityDays = userPlan.getPaymentPlan().getValidityInDays();
        if (validityDays == null || validityDays <= 0) {
            log.warn("Invalid validity days: {} for PaymentPlan: {}", validityDays, userPlan.getPaymentPlan().getId());
            return;
        }

        // Update mapping: extend from mapping's current expiryDate
        java.util.Date mappingBaseDate = mapping.getExpiryDate();
        if (mappingBaseDate == null) {
            mappingBaseDate = new java.util.Date();
            log.warn("Mapping {} has no expiryDate, using today as base date", mapping.getId());
        }
        java.util.Date newMappingExpiryDate = addDaysToDate(mappingBaseDate, validityDays);

        mapping.setExpiryDate(newMappingExpiryDate);
        mapping.setStatus(
                vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum.ACTIVE
                        .name());
        mappingRepository.save(mapping);
        log.debug("Extended mapping: {} expiry from {} to {}", mapping.getId(), mappingBaseDate, newMappingExpiryDate);
    }

    /**
     * Extends expiry dates for all mappings and UserPlan when payment succeeds.
     * UserPlan.startDate remains unchanged.
     * UserPlan.endDate is extended from current endDate + validityDays.
     * Each mapping's expiryDate is extended from its own current expiryDate +
     * validityDays.
     *
     * @deprecated Use extendSingleMapping instead, which checks re-enrollment
     *             policy per mapping
     */
    @Deprecated
    private void extendAllMappings(List<StudentSessionInstituteGroupMapping> mappings, UserPlan userPlan) {
        if (userPlan.getPaymentPlan() == null) {
            log.warn("PaymentPlan not found for UserPlan: {}, cannot extend mappings", userPlan.getId());
            return;
        }

        Integer validityDays = userPlan.getPaymentPlan().getValidityInDays();
        if (validityDays == null || validityDays <= 0) {
            log.warn("Invalid validity days: {} for PaymentPlan: {}", validityDays, userPlan.getPaymentPlan().getId());
            return;
        }

        // Extend UserPlan.endDate from current endDate (or today if null)
        java.util.Date userPlanBaseDate = userPlan.getEndDate();
        if (userPlanBaseDate == null) {
            userPlanBaseDate = new java.util.Date();
            log.warn("UserPlan {} has no endDate, using today as base date", userPlan.getId());
        }
        java.util.Date newUserPlanEndDate = addDaysToDate(userPlanBaseDate, validityDays);

        // Update UserPlan: keep startDate unchanged, extend endDate
        // startDate remains the same (don't update it)
        userPlan.setEndDate(newUserPlanEndDate);
        userPlanRepository.save(userPlan);
        log.debug("Extended UserPlan: {} endDate from {} to {} (startDate unchanged: {})",
                userPlan.getId(), userPlanBaseDate, newUserPlanEndDate, userPlan.getStartDate());

        // Update all mappings: extend each mapping's expiryDate from its own current
        // expiryDate
        for (StudentSessionInstituteGroupMapping mapping : mappings) {
            java.util.Date mappingBaseDate = mapping.getExpiryDate();
            if (mappingBaseDate == null) {
                mappingBaseDate = new java.util.Date();
                log.warn("Mapping {} has no expiryDate, using today as base date", mapping.getId());
            }
            java.util.Date newMappingExpiryDate = addDaysToDate(mappingBaseDate, validityDays);

            mapping.setExpiryDate(newMappingExpiryDate);
            mapping.setStatus(
                    vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum.ACTIVE
                            .name());
            mappingRepository.save(mapping);
            log.debug("Extended mapping: {} expiry from {} to {}", mapping.getId(), mappingBaseDate,
                    newMappingExpiryDate);
        }

        log.info("Extended UserPlan endDate and {} mappings expiry dates by {} days", mappings.size(), validityDays);
    }

    /**
     * Handles expiry for non-renewable payment options
     */
    private void handleNonRenewableExpiry(EnrolmentContext context, UserPlan userPlan,
                                          String subOrgId, boolean isSubOrg) {
        log.info("Handling non-renewable expiry for UserPlan: {} (SUB_ORG: {})",
                userPlan.getId(), isSubOrg);

        markUserPlanAsExpired(userPlan);

        if (isSubOrg && StringUtils.hasText(subOrgId)) {
            notifyAdminsOfExpiry(context);
        }
    }

    // Remove old signature - replaced with one above
    @Deprecated
    private void handleNonRenewableExpiry(EnrolmentContext context, UserPlan userPlan,
                                          String subOrgId, String packageSessionId, boolean isSubOrg) {
        handleNonRenewableExpiry(context, userPlan, subOrgId, isSubOrg);
    }

    /**
     * Notifies ROOT_ADMIN of expiry (for non-renewable or auto-renewal disabled cases).
     */
    private void notifyAdminsOfExpiry(EnrolmentContext context) {
        try {
            sendExpiryNotificationsToAdmins(context);
            log.info("Sent expiry notifications to ROOT_ADMIN for sub-org: {}", context.getSubOrgId());
        } catch (Exception e) {
            log.error("Error notifying ROOT_ADMIN of expiry for sub-org: {}", context.getSubOrgId(), e);
        }
    }

    /**
     * Marks UserPlan as EXPIRED.
     * Mappings remain ACTIVE during waiting period - they will be moved to INVITED
     * by FinalExpiryProcessor after waiting period ends.
     */
    private void markUserPlanAsExpired(UserPlan userPlan) {
        userPlan.setStatus(UserPlanStatusEnum.EXPIRED.name());
        userPlanRepository.save(userPlan);
        log.info("Marked UserPlan {} as EXPIRED (mappings remain ACTIVE during waiting period)", userPlan.getId());
    }

    /**
     * Notifies ROOT_ADMIN of payment failure for SUB_ORG.
     * Context already has ROOT_ADMIN set, so just use it directly.
     */
    private void notifyAdminsOfPaymentFailure(String subOrgId, String packageSessionId, EnrolmentContext context) {
        try {
            // Context already has ROOT_ADMIN set (from PackageSessionEnrolmentService)
            // No need to fetch again
            sendExpiryNotificationsToAdmins(context);
            log.info("Sent payment failure notification to ROOT_ADMIN for sub-org: {}", subOrgId);
        } catch (Exception e) {
            log.error("Error notifying ROOT_ADMIN of payment failure for sub-org: {}", subOrgId, e);
        }
    }

    /**
     * Sends expiry notifications to admins.
     */
    private void sendExpiryNotificationsToAdmins(EnrolmentContext context) {
        // Get any policy (they all have similar notification settings)
        EnrollmentPolicySettingsDTO policy = context.getPoliciesByPackageSessionId().values().stream()
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
                log.error("Error sending expiry notification to admin: {}", context.getUser().getId(), e);
            }
        }
    }

    /**
     * Utility method to add days to a date.
     */
    private java.util.Date addDaysToDate(java.util.Date date, int days) {
        java.util.Calendar calendar = java.util.Calendar.getInstance();
        calendar.setTime(date);
        calendar.add(java.util.Calendar.DAY_OF_YEAR, days);
        return calendar.getTime();
    }

    /**
     * Sends waiting period notifications to individual user.
     */
    private void sendNotificationsToUser(EnrolmentContext context, List<NotificationPolicyDTO> notifications) {
        for (NotificationPolicyDTO notification : notifications) {
            try {
                // Send all channel notifications for this policy
                sendChannelNotifications(context, notification);
            } catch (Exception e) {
                log.error("Error sending waiting period notification to user: {}", context.getUser().getId(), e);
            }
        }
    }

    /**
     * Sends notifications for all channels in a notification policy.
     */
    private void sendChannelNotifications(EnrolmentContext context, NotificationPolicyDTO policy) {
        if (policy.getNotifications() == null || policy.getNotifications().isEmpty()) {
            log.warn("No channel notifications configured in policy for trigger: {}", policy.getTrigger());
            return;
        }

        for (vacademy.io.admin_core_service.features.enrollment_policy.dto.ChannelNotificationDTO channelNotification : policy
                .getNotifications()) {
            try {
                String channel = channelNotification.getChannel();
                if (!StringUtils.hasText(channel)) {
                    channel = NotificationType.EMAIL.name(); // Default
                }

                // Get the appropriate notification service for this channel
                vacademy.io.admin_core_service.features.enrollment_policy.enums.NotificationType notificationType;
                try {
                    notificationType = vacademy.io.admin_core_service.features.enrollment_policy.enums.NotificationType
                            .valueOf(channel.toUpperCase());
                } catch (IllegalArgumentException e) {
                    log.warn("Unsupported channel type: {}, skipping", channel);
                    continue;
                }

                // Create a NotificationPolicyDTO with only this channel's notification
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

    private List<NotificationPolicyDTO> findNotificationsToProcess(EnrolmentContext context, long daysPastExpiry) {
        // Get any policy to check notifications
        EnrollmentPolicySettingsDTO policy = context.getPoliciesByPackageSessionId().values().stream()
                .findFirst()
                .orElse(null);

        if (policy == null || policy.getNotifications() == null) {
            return List.of();
        }

        return policy.getNotifications().stream()
                .filter(p -> {
                    // Handle ON_EXPIRY_DATE_REACHED trigger (exactly on expiry date)
                    if (NotificationTriggerType.ON_EXPIRY_DATE_REACHED.equals(p.getTrigger())) {
                        return daysPastExpiry == 0;
                    }
                    // Handle DURING_WAITING_PERIOD trigger
                    if (NotificationTriggerType.DURING_WAITING_PERIOD.equals(p.getTrigger())) {
                        return p.getSendEveryNDays() != null && p.getSendEveryNDays() > 0
                                && daysPastExpiry > 0
                                && daysPastExpiry % p.getSendEveryNDays() == 0;
                    }
                    return false;
                })
                // TODO: Add logic to check maxSends against a notification log
                .toList();
    }

    /**
     * Moves all mappings to INVITED package session when waiting period is 0.
     * Only marks mappings as TERMINATED if their own expiryDate has been reached.
     * Marks UserPlan as EXPIRED, then creates INVITED entries for expired mappings.
     */
    private void moveAllMappingsToInvited(List<StudentSessionInstituteGroupMapping> mappings, UserPlan userPlan) {
        log.info("Moving {} mappings to INVITED (waiting period = 0)", mappings.size());

        java.util.Date today = new java.util.Date();
        int terminatedCount = 0;

        for (StudentSessionInstituteGroupMapping mapping : mappings) {
            // Only mark as TERMINATED if mapping's own expiryDate has been reached
            if (mapping.getExpiryDate() != null && !mapping.getExpiryDate().after(today)) {
                // Mapping's expiryDate has been reached - mark as TERMINATED
                mapping.setStatus(LearnerSessionStatusEnum.TERMINATED.name());
                mappingRepository.save(mapping);
                terminatedCount++;

                // Create INVITED entry
                createInvitedEntry(mapping);
                log.debug("Marked mapping {} as TERMINATED and created INVITED entry (expiryDate: {})",
                        mapping.getId(), mapping.getExpiryDate());
            } else {
                // Mapping's expiryDate is still in the future - keep it ACTIVE
                log.debug("Skipping mapping {} - expiryDate {} is still in the future",
                        mapping.getId(), mapping.getExpiryDate());
            }
        }

        // Update UserPlan status to EXPIRED
        userPlan.setStatus(UserPlanStatusEnum.EXPIRED.name());
        userPlanRepository.save(userPlan);

        log.info(
                "Moved {} mappings to INVITED (marked as TERMINATED) out of {} total mappings. UserPlan marked as EXPIRED",
                terminatedCount, mappings.size());
    }

    /**
     * Creates an INVITED entry for an expired mapping.
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

        // Copy additional identifiers
        invited.setUserPlanId(mapping.getUserPlanId());
        invited.setType(LearnerSessionTypeEnum.PACKAGE_SESSION.name());
        invited.setTypeId(mapping.getId()); // Set to original mapping ID
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

        // Delete old EXPIRED entries before creating new one (to handle constraint)
        studentSessionRepository.deleteByUserTypeSourcePackageInstitute(
                mapping.getUserId(),
                mapping.getPackageSession().getId(),
                LearnerSessionSourceEnum.EXPIRED.name(),
                LearnerSessionTypeEnum.PACKAGE_SESSION.name(),
                invited.getPackageSession().getId(),
                invited.getInstitute().getId());

        mappingRepository.save(invited);
        log.info("Created INVITED entry for expired mapping: {}, typeId set to original mapping ID: {}",
                invited.getId(), mapping.getId());
        return invited;
    }

    /**
     * Gets the INVITED package session for a given package session.
     */
    private PackageSession getInvitedPackageSession(PackageSession packageSession) {
        String packageSessionId = packageSession.getId();
        return packageSessionRepository
                .findInvitedPackageSessionForPackage(
                        packageSessionId,
                        "INVITED", // levelId (placeholder — ensure correct value)
                        "INVITED", // sessionId (placeholder — ensure correct value)
                        List.of(PackageSessionStatusEnum.INVITED.name()),
                        List.of(PackageSessionStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name()),
                        List.of(PackageStatusEnum.ACTIVE.name()))
                .orElseThrow(() -> new VacademyException("No Invited package session found"));
    }

    /**
     * Checks if the first payment attempt failed for this UserPlan.
     * Looks for the most recent payment log entry with status = FAILED.
     *
     * @return true if first payment failed, false if SUCCESS or PENDING or no payment found
     */
    private boolean checkIfFirstPaymentFailed(UserPlan userPlan) {
        try {
            // Find the most recent payment log for this UserPlan
            List<PaymentLog> paymentLogs =
                    paymentLogRepository.findByUserPlanIdOrderByCreatedAtDesc(userPlan.getId());

            if (paymentLogs == null || paymentLogs.isEmpty()) {
                log.warn("No payment log found for UserPlan: {} - assuming no payment attempt made", userPlan.getId());
                return false;
            }

            // Get most recent payment log
            PaymentLog latestPayment = paymentLogs.get(0);
            String paymentStatus = latestPayment.getStatus();

            log.info("Latest payment status for UserPlan {}: {}", userPlan.getId(), paymentStatus);

            // Only retry if status is FAILED
            if ("FAILED".equalsIgnoreCase(paymentStatus)) {
                log.info("First payment FAILED for UserPlan: {} - will retry", userPlan.getId());
                return true;
            } else if ("SUCCESS".equalsIgnoreCase(paymentStatus)) {
                log.info("First payment SUCCESS for UserPlan: {} - no retry needed", userPlan.getId());
                return false;
            } else if ("PENDING".equalsIgnoreCase(paymentStatus)) {
                log.info("First payment PENDING for UserPlan: {} - waiting for webhook, no retry", userPlan.getId());
                return false;
            } else {
                log.warn("Unknown payment status '{}' for UserPlan: {} - will not retry", paymentStatus, userPlan.getId());
                return false;
            }

        } catch (Exception e) {
            log.error("Error checking payment status for UserPlan: {}", userPlan.getId(), e);
            return false; // Default to not retrying on error
        }
    }
}
