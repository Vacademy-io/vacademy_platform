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
                OnExpiryPolicyDTO expiryPolicy = context.getPolicy().getOnExpiry();
                if (expiryPolicy == null) {
                    log.warn("No onExpiry policy for mapping {}. No final action taken.", context.getMapping().getId());
                    return;
                }

            StudentSessionInstituteGroupMapping mapping = context.getMapping();
            String userPlanId = mapping.getUserPlanId();

            if (!StringUtils.hasText(userPlanId)) {
                log.warn("No userPlanId found for mapping: {}, moving to INVITED", mapping.getId());
                // No UserPlan, so just move to INVITED without payment attempt
                moveIndividualUserToInvited(mapping, context);
                return;
            }

            UserPlan userPlan = userPlanService.findById(userPlanId);
            if (userPlan == null) {
                log.warn("UserPlan not found: {}, moving to INVITED", userPlanId);
                // UserPlan not found, so just move to INVITED without payment attempt
                moveIndividualUserToInvited(mapping, context);
                return;
            }

            // Check if this is a SUB_ORG source UserPlan
            boolean isSubOrg = UserPlanSourceEnum.SUB_ORG.name().equals(userPlan.getSource())
                    && StringUtils.hasText(userPlan.getSubOrgId());

            if (isSubOrg) {
                log.info("Processing SUB_ORG expiry for UserPlan: {}, SubOrg: {}", userPlan.getId(),
                        userPlan.getSubOrgId());
                handleSubOrgExpiry(mapping, userPlan, context, expiryPolicy);
            } else {
                log.info("Processing individual USER expiry for UserPlan: {}", userPlan.getId());
                handleIndividualUserExpiry(mapping, userPlan, context, expiryPolicy);
            }
        } finally {
            // Clear ThreadLocal cache after processing to prevent memory leaks
            paymentAttemptCache.remove();
            userPlanExtendedCache.remove();
        }
    }

    /**
     * Handles expiry for SUB_ORG source UserPlans.
     * Processes payment, extends mappings if successful, or moves all to INVITED if
     * payment fails.
     * Uses mappings from context (no DB call needed).
     */
    private void handleSubOrgExpiry(StudentSessionInstituteGroupMapping mapping,
            UserPlan userPlan,
            EnrolmentContext context,
            @SuppressWarnings("unused") OnExpiryPolicyDTO expiryPolicy) {
        // expiryPolicy parameter kept for future use
        String subOrgId = userPlan.getSubOrgId();
        String packageSessionId = mapping.getPackageSession().getId();

        // Use mappings from context (already fetched, no DB call needed)
        List<StudentSessionInstituteGroupMapping> allSubOrgMappings = context.getAllMappings();
        if (allSubOrgMappings == null || allSubOrgMappings.isEmpty()) {
            log.warn("No mappings found in context for UserPlan: {}", userPlan.getId());
            return;
        }

        log.info("Found {} mappings for sub-org: {} in package session: {} (from context)",
                allSubOrgMappings.size(), subOrgId, packageSessionId);

        // Check if at least one package session policy allows auto-renewal
        boolean shouldAttemptPayment = false;
        for (StudentSessionInstituteGroupMapping mappingItem : allSubOrgMappings) {
            String policyJson = mappingItem.getPackageSession() != null
                    ? mappingItem.getPackageSession().getEnrollmentPolicySettings()
                    : null;
            if (policyJson != null && !policyJson.isBlank()) {
                try {
                    vacademy.io.admin_core_service.features.enrollment_policy.dto.EnrollmentPolicySettingsDTO policy = objectMapper
                            .readValue(policyJson,
                                    vacademy.io.admin_core_service.features.enrollment_policy.dto.EnrollmentPolicySettingsDTO.class);
                    if (paymentRenewalCheckService.shouldAttemptPayment(userPlan, policy)) {
                        shouldAttemptPayment = true;
                        break; // Found at least one policy that allows payment
                    }
                } catch (Exception e) {
                    log.debug("Failed to parse policy for mapping: {}", mappingItem.getId(), e);
                }
            }
        }

        // 3. After waiting period ended, try payment again if at least one policy
        // allows
        if (shouldAttemptPayment) {
            // Check if payment was already attempted for this UserPlan
            Map<String, PaymentAttemptResult> cache = paymentAttemptCache.get();
            PaymentAttemptResult existingResult = cache.get(userPlan.getId());

            if (existingResult != null) {
                // Payment already attempted - check webhook status
                log.info("Payment was already initiated for UserPlan: {}. Checking current status.",
                        userPlan.getId());
                // Do nothing - webhook will handle the result
                return;
            }

            // Try to process payment again (retry after waiting period)
            try {
                vacademy.io.common.payment.dto.PaymentResponseDTO paymentResponse = subOrgPaymentService
                        .processSubOrgPaymentOnExpiry(context, userPlan);

                log.info("Payment retry initiated for UserPlan: {}. Waiting for webhook. OrderId: {}", 
                        userPlan.getId(), paymentResponse.getOrderId());
                
                // Mark that payment attempt was made
                PaymentAttemptResult result = new PaymentAttemptResult(true, false, paymentResponse);
                cache.put(userPlan.getId(), result);

                userPlanRepository.save(userPlan);
                
                log.info("Payment retry marked as PENDING. Waiting for webhook confirmation.");
                
                // DO NOT process result here - wait for webhook
                return;

            } catch (Exception e) {
                log.error("Payment retry failed for sub-org: {} after waiting period", subOrgId, e);
                PaymentAttemptResult result = new PaymentAttemptResult(true, false, null);
                cache.put(userPlan.getId(), result);

                userPlanRepository.save(userPlan);
                
                notifyAdminsOfPaymentFailure(subOrgId, packageSessionId, context);
                // After waiting period ended, move all to INVITED only if payment initiation failed
                moveAllMappingsToInvited(allSubOrgMappings, userPlan);
            }
        } else {
            // Payment not attempted (no policy allows auto-renewal, or
            // FREE/DONATION/ONE_TIME)
            // Move to INVITED after waiting period ended
            log.info(
                    "Payment not attempted for sub-org: {} (no policy allows auto-renewal or PaymentOption type). Moving to INVITED after waiting period.",
                    subOrgId);
            notifyAdminsOfExpiry(subOrgId, packageSessionId, context);
            moveAllMappingsToInvited(allSubOrgMappings, userPlan);
        }
    }

    /**
     * Handles expiry for individual USER source UserPlans after waiting period
     * ended.
     * Same flow as SubOrg: Try payment again, then move to INVITED if fails.
     */
    private void handleIndividualUserExpiry(StudentSessionInstituteGroupMapping mapping,
            UserPlan userPlan,
            EnrolmentContext context,
            @SuppressWarnings("unused") OnExpiryPolicyDTO expiryPolicy) {
        // expiryPolicy parameter kept for future use

        // Check if payment should be attempted (check this mapping's policy)
        boolean shouldAttemptPayment = paymentRenewalCheckService.shouldAttemptPayment(userPlan, context.getPolicy());

        if (shouldAttemptPayment) {
            // Check if payment was already attempted for this UserPlan
            Map<String, PaymentAttemptResult> cache = paymentAttemptCache.get();
            PaymentAttemptResult existingResult = cache.get(userPlan.getId());

            if (existingResult != null) {
                // Payment already attempted - check status
                log.info("Payment was already initiated for UserPlan: {}. Waiting for webhook.",
                        userPlan.getId());
                return;
            }

            // Try to process payment again (retry after waiting period)
            try {
                vacademy.io.common.payment.dto.PaymentResponseDTO paymentResponse = subOrgPaymentService
                        .processSubOrgPaymentOnExpiry(context, userPlan);

                log.info("Payment retry initiated for individual UserPlan: {}. OrderId: {}", 
                        userPlan.getId(), paymentResponse.getOrderId());
                
                PaymentAttemptResult result = new PaymentAttemptResult(true, false, paymentResponse);
                cache.put(userPlan.getId(), result);

                userPlanRepository.save(userPlan);
                
                log.info("Payment retry marked as PENDING. Waiting for webhook confirmation.");
                
                // DO NOT process result here - wait for webhook
                return;

            } catch (Exception e) {
                log.error("Payment processing failed for individual user after waiting period", e);
                PaymentAttemptResult result = new PaymentAttemptResult(true, false, null);
                cache.put(userPlan.getId(), result);

                userPlanRepository.save(userPlan);
                // Payment failed, will move to INVITED below
            }
        } else {
            // Payment not attempted (no policy allows auto-renewal, or
            // FREE/DONATION/ONE_TIME)
            log.info(
                    "Payment not attempted for individual user (no policy allows auto-renewal or PaymentOption type). Moving to INVITED.");
        }

        // Move to INVITED (payment failed or not attempted)
        sendExpiryNotificationsToUser(context);

        // Only mark as TERMINATED if mapping's own expiryDate has been reached
        Date today = new Date();
        if (mapping.getExpiryDate() != null && !mapping.getExpiryDate().after(today)) {
            // Mapping's expiryDate has been reached - mark as TERMINATED
            mapping.setStatus(LearnerSessionStatusEnum.TERMINATED.name());
            mappingRepository.save(mapping);
            log.info("Updated mapping {} to status TERMINATED (expiryDate: {} has been reached)",
                    mapping.getId(), mapping.getExpiryDate());

            // Create INVITED entry
            createInvitedEntry(mapping);
        } else {
            // Mapping's expiryDate is still in the future - keep it ACTIVE
            log.info("Skipping TERMINATED status for mapping {} - expiryDate {} is still in the future",
                    mapping.getId(), mapping.getExpiryDate());
        }

        // Ensure UserPlan is marked as EXPIRED
        if (!UserPlanStatusEnum.EXPIRED.name().equals(userPlan.getStatus())) {
            userPlan.setStatus(UserPlanStatusEnum.EXPIRED.name());
            userPlanRepository.save(userPlan);
        }
    }

    /**
     * Handles payment result for SubOrg - extends UserPlan once, then extends
     * mappings only if their policy allows re-enrollment.
     * Uses mappings from context (no DB call needed).
     */
    private void handlePaymentResultForSubOrg(EnrolmentContext context, UserPlan userPlan,
            String subOrgId, String packageSessionId,
            List<StudentSessionInstituteGroupMapping> allMappings, PaymentAttemptResult result) {

        if (result.successful) {
            // Payment succeeded - extend UserPlan once, then extend mappings only if their
            // policy allows re-enrollment
            log.info(
                    "Payment successful after waiting period, extending UserPlan and checking re-enrollment policies for mappings");

            // Check if UserPlan was already extended
            Map<String, Boolean> extendedCache = userPlanExtendedCache.get();
            if (Boolean.TRUE.equals(extendedCache.get(userPlan.getId()))) {
                log.info("UserPlan {} already extended, skipping UserPlan extension", userPlan.getId());
            } else {
                // Extend UserPlan once
                extendUserPlan(userPlan);
                extendedCache.put(userPlan.getId(), true);
            }

            // Use mappings from context if allMappings parameter is null/empty
            List<StudentSessionInstituteGroupMapping> mappingsToProcess = (allMappings != null
                    && !allMappings.isEmpty())
                            ? allMappings
                            : context.getAllMappings();

            if (mappingsToProcess == null || mappingsToProcess.isEmpty()) {
                log.warn("No mappings found for UserPlan: {}", userPlan.getId());
                return;
            }

            // Extend only mappings whose policy allows re-enrollment
            for (StudentSessionInstituteGroupMapping mapping : mappingsToProcess) {
                String policyJson = mapping.getPackageSession() != null
                        ? mapping.getPackageSession().getEnrollmentPolicySettings()
                        : null;

                if (policyJson != null && !policyJson.isBlank()) {
                    try {
                        vacademy.io.admin_core_service.features.enrollment_policy.dto.EnrollmentPolicySettingsDTO policy = objectMapper
                                .readValue(policyJson,
                                        vacademy.io.admin_core_service.features.enrollment_policy.dto.EnrollmentPolicySettingsDTO.class);

                        boolean allowReenrollment = policy.getReenrollmentPolicy() != null
                                && Boolean.TRUE
                                        .equals(policy.getReenrollmentPolicy().getAllowReenrollmentAfterExpiry());

                        if (allowReenrollment) {
                            extendSingleMapping(mapping, userPlan);
                            log.info("Extended mapping {} after successful payment (re-enrollment allowed by policy)",
                                    mapping.getId());
                        } else {
                            log.info("Skipping extension for mapping {} - re-enrollment not allowed by policy",
                                    mapping.getId());
                        }
                    } catch (Exception e) {
                        log.error("Failed to parse policy for mapping: {}", mapping.getId(), e);
                    }
                }
            }

            // Update UserPlan status to ACTIVE
            userPlan.setStatus(UserPlanStatusEnum.ACTIVE.name());
            userPlanRepository.save(userPlan);
        } else {
            // Payment failed after waiting period - move all to INVITED
            log.warn("Payment failed for sub-org: {} after waiting period, moving to INVITED", subOrgId);
            notifyAdminsOfPaymentFailure(subOrgId, packageSessionId, context);
            moveAllMappingsToInvited(allMappings, userPlan);
        }
    }

    /**
     * Handles payment result for Individual User - extends UserPlan once, then
     * extends mapping if policy allows re-enrollment.
     */
    private void handlePaymentResultForIndividual(EnrolmentContext context, UserPlan userPlan,
            StudentSessionInstituteGroupMapping mapping, PaymentAttemptResult result) {

        if (result.successful) {
            // Payment succeeded - extend UserPlan once, then extend mapping if policy
            // allows re-enrollment
            log.info("Payment successful after waiting period, extending UserPlan and checking re-enrollment policy");

            // Check if UserPlan was already extended
            Map<String, Boolean> extendedCache = userPlanExtendedCache.get();
            if (Boolean.TRUE.equals(extendedCache.get(userPlan.getId()))) {
                log.info("UserPlan {} already extended, skipping UserPlan extension", userPlan.getId());
            } else {
                // Extend UserPlan once
                extendUserPlan(userPlan);
                extendedCache.put(userPlan.getId(), true);
            }

            // Check if this mapping's policy allows re-enrollment
            String policyJson = mapping.getPackageSession() != null
                    ? mapping.getPackageSession().getEnrollmentPolicySettings()
                    : null;

            if (policyJson != null && !policyJson.isBlank()) {
                try {
                    vacademy.io.admin_core_service.features.enrollment_policy.dto.EnrollmentPolicySettingsDTO policy = objectMapper
                            .readValue(policyJson,
                                    vacademy.io.admin_core_service.features.enrollment_policy.dto.EnrollmentPolicySettingsDTO.class);

                    boolean allowReenrollment = policy.getReenrollmentPolicy() != null
                            && Boolean.TRUE.equals(policy.getReenrollmentPolicy().getAllowReenrollmentAfterExpiry());

                    if (allowReenrollment) {
                        extendSingleMapping(mapping, userPlan);
                        log.info("Extended mapping {} after successful payment (re-enrollment allowed by policy)",
                                mapping.getId());
                    } else {
                        log.info("Skipping extension for mapping {} - re-enrollment not allowed by policy",
                                mapping.getId());
                    }
                } catch (Exception e) {
                    log.error("Failed to parse policy for mapping: {}", mapping.getId(), e);
                }
            }

            // Update UserPlan status to ACTIVE
            userPlan.setStatus(UserPlanStatusEnum.ACTIVE.name());
            userPlanRepository.save(userPlan);
        } else {
            // Payment failed after waiting period - move to INVITED
            log.warn("Payment failed for individual user after waiting period, moving to INVITED");
            // Will move to INVITED in the calling method
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
        Date userPlanBaseDate = userPlan.getEndDate();
        if (userPlanBaseDate == null) {
            userPlanBaseDate = new Date();
            log.warn("UserPlan {} has no endDate, using today as base date", userPlan.getId());
        }
        Date newUserPlanEndDate = addDaysToDate(userPlanBaseDate, validityDays);

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
        Date mappingBaseDate = mapping.getExpiryDate();
        if (mappingBaseDate == null) {
            mappingBaseDate = new Date();
            log.warn("Mapping {} has no expiryDate, using today as base date", mapping.getId());
        }
        Date newMappingExpiryDate = addDaysToDate(mappingBaseDate, validityDays);

        mapping.setExpiryDate(newMappingExpiryDate);
        mapping.setStatus(LearnerSessionStatusEnum.ACTIVE.name());
        mappingRepository.save(mapping);
        log.debug("Extended mapping: {} expiry from {} to {}", mapping.getId(), mappingBaseDate, newMappingExpiryDate);
    }

    /**
     * Moves individual user to INVITED when UserPlan is not available.
     * Only marks mapping as TERMINATED if its own expiryDate has been reached.
     */
    private void moveIndividualUserToInvited(StudentSessionInstituteGroupMapping mapping, EnrolmentContext context) {
        // Send notifications to user
        sendExpiryNotificationsToUser(context);

        // Only mark as TERMINATED if mapping's own expiryDate has been reached
        Date today = new Date();
        if (mapping.getExpiryDate() != null && !mapping.getExpiryDate().after(today)) {
            // Mapping's expiryDate has been reached - mark as TERMINATED
            mapping.setStatus(LearnerSessionStatusEnum.TERMINATED.name());
            mappingRepository.save(mapping);
            log.info("Marked mapping {} as TERMINATED (expiryDate: {} has been reached)",
                    mapping.getId(), mapping.getExpiryDate());

            // Create INVITED entry
            createInvitedEntry(mapping);
        } else {
            // Mapping's expiryDate is still in the future - keep it ACTIVE
            log.info("Skipping TERMINATED status for mapping {} - expiryDate {} is still in the future",
                    mapping.getId(), mapping.getExpiryDate());
        }
    }

    /**
     * Notifies ROOT_ADMIN of expiry (for non-renewable or auto-renewal disabled
     * cases).
     * Context already has ROOT_ADMIN set, so just use it directly.
     */
    private void notifyAdminsOfExpiry(@SuppressWarnings("unused") String subOrgId,
            @SuppressWarnings("unused") String packageSessionId, EnrolmentContext context) {
        try {
            // Context already has ROOT_ADMIN set (from PackageSessionEnrolmentService)
            // No need to fetch again
            sendExpiryNotificationsToAdmins(context);
            log.info("Sent expiry notifications to ROOT_ADMIN for sub-org: {}", subOrgId);
        } catch (Exception e) {
            log.error("Error notifying ROOT_ADMIN of expiry for sub-org: {}", subOrgId, e);
        }
    }

    /**
     * Extends expiry dates for all mappings and UserPlan when payment succeeds.
     * UserPlan.startDate remains unchanged.
     * UserPlan.endDate is extended from current endDate + validityDays.
     * Each mapping's expiryDate is extended from its own current expiryDate +
     * validityDays.
     * 
     * @deprecated Use extendUserPlan() and extendSingleMapping() instead, which
     *             check re-enrollment policy per mapping
     */
    @Deprecated(since = "2.0", forRemoval = true)
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
        Date userPlanBaseDate = userPlan.getEndDate();
        if (userPlanBaseDate == null) {
            userPlanBaseDate = new Date();
            log.warn("UserPlan {} has no endDate, using today as base date", userPlan.getId());
        }
        Date newUserPlanEndDate = addDaysToDate(userPlanBaseDate, validityDays);

        // Update UserPlan: keep startDate unchanged, extend endDate
        // startDate remains the same (don't update it)
        userPlan.setEndDate(newUserPlanEndDate);
        userPlanRepository.save(userPlan);
        log.debug("Extended UserPlan: {} endDate from {} to {} (startDate unchanged: {})",
                userPlan.getId(), userPlanBaseDate, newUserPlanEndDate, userPlan.getStartDate());

        // Update all mappings: extend each mapping's expiryDate from its own current
        // expiryDate
        for (StudentSessionInstituteGroupMapping mapping : mappings) {
            Date mappingBaseDate = mapping.getExpiryDate();
            if (mappingBaseDate == null) {
                mappingBaseDate = new Date();
                log.warn("Mapping {} has no expiryDate, using today as base date", mapping.getId());
            }
            Date newMappingExpiryDate = addDaysToDate(mappingBaseDate, validityDays);

            mapping.setExpiryDate(newMappingExpiryDate);
            mapping.setStatus(LearnerSessionStatusEnum.ACTIVE.name());
            mappingRepository.save(mapping);
            log.debug("Extended mapping: {} expiry from {} to {}", mapping.getId(), mappingBaseDate,
                    newMappingExpiryDate);
        }

        log.info("Extended UserPlan endDate and {} mappings expiry dates by {} days", mappings.size(), validityDays);
    }

    /**
     * Moves all mappings to INVITED package session after waiting period ended.
     * This is called when FinalExpiryProcessor runs (after waiting period).
     * Only marks mappings as TERMINATED if their own expiryDate has been reached.
     * Marks UserPlan as EXPIRED.
     */
    private void moveAllMappingsToInvited(List<StudentSessionInstituteGroupMapping> mappings, UserPlan userPlan) {
        log.info("Moving {} mappings to INVITED after waiting period ended", mappings.size());

        Date today = new Date();
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
     * Notifies ROOT_ADMIN of payment failure for SUB_ORG.
     * Context already has ROOT_ADMIN set, so just use it directly.
     */
    private void notifyAdminsOfPaymentFailure(String subOrgId, @SuppressWarnings("unused") String packageSessionId,
            EnrolmentContext context) {
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
     * Sends expiry notifications to individual user.
     */
    private void sendExpiryNotificationsToUser(EnrolmentContext context) {
        if (context.getPolicy().getNotifications() == null) {
            return;
        }

        List<NotificationPolicyDTO> expiryNotifications = context.getPolicy().getNotifications().stream()
                .filter(p -> NotificationTriggerType.ON_EXPIRY_DATE_REACHED.equals(p.getTrigger()))
                .toList();

        for (NotificationPolicyDTO notification : expiryNotifications) {
            try {
                // Send all channel notifications for this policy
                sendChannelNotifications(context, notification);
            } catch (Exception e) {
                log.error("Error sending expiry notification to user: {}", context.getUser().getId(), e);
            }
        }
    }

    /**
     * Sends expiry notifications to admins.
     */
    private void sendExpiryNotificationsToAdmins(EnrolmentContext context) {
        if (context.getPolicy().getNotifications() == null) {
            return;
        }

        List<NotificationPolicyDTO> expiryNotifications = context.getPolicy().getNotifications().stream()
                .filter(p -> NotificationTriggerType.ON_EXPIRY_DATE_REACHED.equals(p.getTrigger()))
                .toList();

        for (NotificationPolicyDTO notification : expiryNotifications) {
            try {
                // Send all channel notifications for this policy
                sendChannelNotifications(context, notification);
            } catch (Exception e) {
                log.error("Error sending expiry notification to admin: {}", context.getUser().getId(), e);
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

    /**
     * Utility method to add days to a date.
     */
    private Date addDaysToDate(Date date, int days) {
        Calendar calendar = Calendar.getInstance();
        calendar.setTime(date);
        calendar.add(Calendar.DAY_OF_YEAR, days);
        return calendar.getTime();
            }

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
        invited.setTypeId(mapping.getId()); // Set to original mapping ID (as per requirements)
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

}
