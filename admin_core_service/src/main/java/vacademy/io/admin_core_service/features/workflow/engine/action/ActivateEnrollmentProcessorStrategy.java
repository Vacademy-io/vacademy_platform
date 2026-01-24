package vacademy.io.admin_core_service.features.workflow.engine.action;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.audience.service.AudienceService;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionTypeEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.audience.dto.UserWithCustomFieldsDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
import vacademy.io.admin_core_service.features.notification.service.DynamicNotificationService;
import vacademy.io.admin_core_service.features.notification.enums.NotificationEventType;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.repository.EnrollInviteRepository;
import vacademy.io.admin_core_service.features.enroll_invite.enums.EnrollInviteTag;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.*;

/**
 * Data processor strategy that activates student enrollment.
 * 
 * This strategy:
 * 1. Finds user by phone number
 * 2. Finds ABANDONED_CART entry matching the criteria
 * 3. Marks it as DELETED
 * 4. Creates new ACTIVE entry in the actual package session
 * 
 * Context variables required:
 * - phone_number: User's phone number
 * - package_session_id: INVITED package session ID
 * - destination_package_session_id: Actual package session ID
 */
@Slf4j
@Component
public class ActivateEnrollmentProcessorStrategy implements DataProcessorStrategy {

    private static final String OPERATION_TYPE = "ACTIVATE_ENROLLMENT";

    @Autowired
    @Lazy
    private AudienceService audienceService;

    @Autowired
    private StudentSessionRepository studentSessionRepository;

    @Autowired
    private PackageSessionRepository packageSessionRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserPlanRepository userPlanRepository;

    @Autowired
    @Lazy
    private DynamicNotificationService dynamicNotificationService;

    @Autowired
    private EnrollInviteRepository enrollInviteRepository;

    @Override
    public boolean canHandle(String operation) {
        return OPERATION_TYPE.equalsIgnoreCase(operation);
    }

    @Override
    public String getOperationType() {
        return OPERATION_TYPE;
    }

    @Override
    public Map<String, Object> execute(Map<String, Object> context, Object config, Map<String, Object> itemContext) {
        Map<String, Object> result = new HashMap<>();

        try {
            // Extract required parameters from context
            String phoneNumber = getContextValue(context, itemContext, "phone_number");
            String packageSessionId = getContextValue(context, itemContext, "package_session_id");
            String destinationPackageSessionId = getContextValue(context, itemContext,
                    "destination_package_session_id");

            log.info("ACTIVATE_ENROLLMENT: Processing for phone={}, packageSession={}, destination={}",
                    phoneNumber, packageSessionId, destinationPackageSessionId);

            // Validate required parameters
            if (phoneNumber == null || phoneNumber.isBlank()) {
                throw new IllegalArgumentException("phone_number is required");
            }
            if (packageSessionId == null || packageSessionId.isBlank()) {
                throw new IllegalArgumentException("package_session_id is required");
            }
            if (destinationPackageSessionId == null || destinationPackageSessionId.isBlank()) {
                throw new IllegalArgumentException("destination_package_session_id is required");
            }

            // Step 1: Find user by phone number
            UserWithCustomFieldsDTO userDTO = audienceService.getUserByPhoneNumber(phoneNumber);
            String userId = userDTO.getUser().getId();
            log.info("ACTIVATE_ENROLLMENT: Found user ID: {} for phone: {}", userId, phoneNumber);

            // Step 2: Find ABANDONED_CART entry
            List<StudentSessionInstituteGroupMapping> entries = studentSessionRepository
                    .findByUserAndPackageSessionAndDestinationAndTypeAndStatus(
                            userId,
                            packageSessionId,
                            destinationPackageSessionId,
                            LearnerSessionTypeEnum.ABANDONED_CART.name(),
                            LearnerSessionStatusEnum.ACTIVE.name());

            if (entries.isEmpty()) {
                log.warn("ACTIVATE_ENROLLMENT: No ABANDONED_CART entry found for user={}, package={}, destination={}",
                        userId, packageSessionId, destinationPackageSessionId);
                result.put("success", false);
                result.put("error", "No ABANDONED_CART entry found");
                return result;
            }

            StudentSessionInstituteGroupMapping originalEntry = entries.get(0);
            log.info("ACTIVATE_ENROLLMENT: Found ABANDONED_CART entry with ID: {}", originalEntry.getId());

            // Step 3: Mark ABANDONED_CART as DELETED
            originalEntry.setStatus(LearnerSessionStatusEnum.DELETED.name());
            studentSessionRepository.save(originalEntry);
            log.info("ACTIVATE_ENROLLMENT: Marked entry {} as DELETED", originalEntry.getId());

            // Step 4: Get the destination package session entity
            PackageSession destinationSession = packageSessionRepository.findById(destinationPackageSessionId)
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Destination package session not found: " + destinationPackageSessionId));

            // Step 5: Create new ACTIVE entry in actual package session
            StudentSessionInstituteGroupMapping newEntry = new StudentSessionInstituteGroupMapping();
            newEntry.setUserId(userId);
            newEntry.setPackageSession(destinationSession); // package_session_id = destination
            newEntry.setDestinationPackageSession(destinationSession); // destination = destination
            newEntry.setType(LearnerSessionTypeEnum.PACKAGE_SESSION.name());
            newEntry.setStatus(LearnerSessionStatusEnum.ACTIVE.name());

            Date enrollmentDate = new Date();
            newEntry.setEnrolledDate(enrollmentDate);

            // Copy fields from original entry
            newEntry.setInstitute(originalEntry.getInstitute());
            newEntry.setUserPlanId(originalEntry.getUserPlanId());
            newEntry.setGroup(originalEntry.getGroup());
            newEntry.setSubOrg(originalEntry.getSubOrg());
            newEntry.setCommaSeparatedOrgRoles(originalEntry.getCommaSeparatedOrgRoles());
            newEntry.setInstituteEnrolledNumber(originalEntry.getInstituteEnrolledNumber());

            // Calculate expiry date from UserPlan's validity days
            String userPlanId = originalEntry.getUserPlanId();
            if (userPlanId != null) {
                UserPlan userPlan = userPlanRepository.findById(userPlanId).orElse(null);
                if (userPlan != null && userPlan.getPaymentPlan() != null
                        && userPlan.getPaymentPlan().getValidityInDays() != null) {
                    Integer validityDays = userPlan.getPaymentPlan().getValidityInDays();
                    Date expiryDate = new Date(enrollmentDate.getTime() + (long) validityDays * 24 * 60 * 60 * 1000);
                    newEntry.setExpiryDate(expiryDate);
                    log.info("ACTIVATE_ENROLLMENT: Calculated expiry date: {} (validity: {} days)", expiryDate,
                            validityDays);
                } else {
                    log.warn("ACTIVATE_ENROLLMENT: Could not calculate expiry date - no payment plan or validity days");
                }
            }

            StudentSessionInstituteGroupMapping savedEntry = studentSessionRepository.save(newEntry);
            log.info("ACTIVATE_ENROLLMENT: Created new ACTIVE entry with ID: {} in package session: {}",
                    savedEntry.getId(), destinationPackageSessionId);

            // Return success
            result.put("success", true);
            result.put("userId", userId);
            result.put("deletedEntryId", originalEntry.getId());
            result.put("newEntryId", savedEntry.getId());
            result.put("packageSessionId", destinationPackageSessionId);

            // Step 6: Send enrollment notifications
            try {
                String instituteId = originalEntry.getInstitute() != null
                        ? originalEntry.getInstitute().getId()
                        : (String) context.get("instituteIdForWhatsapp");

                // Use the userDTO already retrieved from AudienceService
                UserDTO userForNotification = userDTO.getUser();

                // Try to get EnrollInvite if available
                EnrollInvite enrollInvite = null;
                try {
                    enrollInvite = enrollInviteRepository.findLatestForPackageSessionWithFilters(
                            destinationPackageSessionId,
                            List.of(StatusEnum.ACTIVE.name()),
                            List.of(EnrollInviteTag.DEFAULT.name()),
                            List.of(StatusEnum.ACTIVE.name()))
                            .orElse(null);
                } catch (Exception e) {
                    log.debug("No EnrollInvite found for package session: {}", destinationPackageSessionId);
                }

                // Send dynamic enrollment notification
                dynamicNotificationService.sendDynamicNotification(
                        NotificationEventType.LEARNER_ENROLL,
                        destinationPackageSessionId,
                        instituteId,
                        userForNotification,
                        null, // PaymentOption not available in workflow context
                        enrollInvite);

                log.info("ACTIVATE_ENROLLMENT: Sent enrollment notification for user: {}", userId);

                // Send referral invitation notification
                if (enrollInvite != null) {
                    dynamicNotificationService.sendReferralInvitationNotification(
                            instituteId,
                            userForNotification,
                            enrollInvite);
                    log.info("ACTIVATE_ENROLLMENT: Sent referral invitation for user: {}", userId);
                }

            } catch (Exception e) {
                log.warn("ACTIVATE_ENROLLMENT: Failed to send notifications for user {}: {}",
                        userId, e.getMessage());
                // Don't fail the whole operation if notifications fail
            }

        } catch (Exception e) {
            log.error("ACTIVATE_ENROLLMENT: Error activating enrollment", e);
            result.put("success", false);
            result.put("error", e.getMessage());
        }

        return result;
    }

    /**
     * Gets a value from context or itemContext, preferring itemContext.
     */
    private String getContextValue(Map<String, Object> context, Map<String, Object> itemContext, String key) {
        Object value = itemContext.get(key);
        if (value == null) {
            value = context.get(key);
        }
        return value != null ? value.toString() : null;
    }
}
