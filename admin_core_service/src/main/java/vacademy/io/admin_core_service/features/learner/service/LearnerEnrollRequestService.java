package vacademy.io.admin_core_service.features.learner.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.service.EnrollInviteService;
import vacademy.io.admin_core_service.features.enroll_invite.service.SubOrgService;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
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
import vacademy.io.admin_core_service.features.enrollment_policy.service.ReenrollmentGapValidationService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerEnrollResponseDTO;
import vacademy.io.common.auth.dto.learner.LearnerPackageSessionsEnrollDTO;
import vacademy.io.common.auth.dto.learner.LearnerEnrollRequestDTO;
import vacademy.io.common.common.dto.CustomFieldValueDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.text.SimpleDateFormat;

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

    @Autowired
    private ReenrollmentGapValidationService reenrollmentGapValidationService;

    @Autowired
    private InstituteRepository instituteRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Transactional
    public LearnerEnrollResponseDTO recordLearnerRequest(LearnerEnrollRequestDTO learnerEnrollRequestDTO) {
        LearnerPackageSessionsEnrollDTO enrollDTO = learnerEnrollRequestDTO.getLearnerPackageSessionEnroll();
        if (!StringUtils.hasText(learnerEnrollRequestDTO.getUser().getId())) {
            boolean sendCredentials = getSendCredentialsFlag(
                    learnerEnrollRequestDTO.getInstituteId(),
                    enrollDTO.getPackageSessionIds());
            UserDTO user = authService.createUserFromAuthService(learnerEnrollRequestDTO.getUser(),
                    learnerEnrollRequestDTO.getInstituteId(), sendCredentials);
            learnerEnrollRequestDTO.setUser(user);
            // Generate coupon code for new learner enrollment
            learnerCouponService.generateCouponCodeForLearner(user.getId());
        }
        EnrollInvite enrollInvite = getValidatedEnrollInvite(enrollDTO.getEnrollInviteId());
        PaymentOption paymentOption = getValidatedPaymentOption(enrollDTO.getPaymentOptionId());
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

        // Validate re-enrollment gap before creating UserPlan
        List<PackageSession> packageSessions = packageSessionRepository
                .findPackageSessionsByIds(enrollDTO.getPackageSessionIds());

        ReenrollmentGapValidationService.GapValidationResult gapValidationResult = reenrollmentGapValidationService
                .validateGapForPackageSessions(
                        learnerEnrollRequestDTO.getUser().getId(),
                        learnerEnrollRequestDTO.getInstituteId(),
                        packageSessions,
                        new java.util.Date());

        // Handle validation results
        boolean isSinglePackageSession = enrollDTO.getPackageSessionIds().size() == 1;

        if (!gapValidationResult.isAllowed()) {
            // Some or all package sessions are blocked
            if (isSinglePackageSession) {
                // Single package session - throw error with retry date
                ReenrollmentGapValidationService.GapBlockedPackageSession blocked = gapValidationResult
                        .getBlockedPackageSessions().get(0);
                String retryDateStr = new SimpleDateFormat("yyyy-MM-dd").format(blocked.getRetryDate());
                throw new VacademyException(
                        String.format("You can retry operation on %s", retryDateStr));
            } else {
                // Multiple package sessions - check if at least one is allowed
                if (gapValidationResult.getAllowedPackageSessionIds().isEmpty()) {
                    // All are blocked - throw error
                    // Find the earliest retry date
                    java.util.Date earliestRetryDate = gapValidationResult.getBlockedPackageSessions().stream()
                            .map(ReenrollmentGapValidationService.GapBlockedPackageSession::getRetryDate)
                            .min(java.util.Date::compareTo)
                            .orElse(new java.util.Date());
                    String retryDateStr = new SimpleDateFormat("yyyy-MM-dd").format(earliestRetryDate);
                    throw new VacademyException(
                            String.format("You can retry operation on %s", retryDateStr));
                } else {
                    // At least one is allowed - filter out blocked ones
                    log.info("Filtering out {} blocked package sessions due to gap violation. " +
                                    "Proceeding with {} allowed package sessions.",
                            gapValidationResult.getBlockedPackageSessions().size(),
                            gapValidationResult.getAllowedPackageSessionIds().size());

                    // Update enrollDTO to only include allowed package sessions
                    enrollDTO.setPackageSessionIds(gapValidationResult.getAllowedPackageSessionIds());
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

        LearnerEnrollResponseDTO response;
        response = enrollLearnerToBatch(
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
        } else if (UserPlanStatusEnum.PENDING.name().equals(userPlan.getStatus())) {
            log.info(
                    "Stacked enrollment created with PENDING status for user: {}. Skipping notifications and session mapping.",
                    learnerEnrollRequestDTO.getUser().getId());
            // Explicitly do nothing else for PENDING plans
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

    private PaymentOption getValidatedPaymentOption(String paymentOptionId) {
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
        if (paymentOption.getType().equals(PaymentOptionType.SUBSCRIPTION.name())
                || paymentOption.getType().equals(PaymentOptionType.ONE_TIME.name())) {
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

    /**
     * Extract sendCredentials flag using two-level policy:
     * 1. Institute-level setting (short-circuits if NO)
     * 2. Package-level setting (returns YES if at least one package says YES)
     *
     * Institute setting JSON structure:
     * {
     * "setting": {
     * "LEARNER_ENROLLMENT_SETTING": {
     * "key": "LEARNER_ENROLLMENT_SETTING",
     * "name": "Learner Enrollment Settings",
     * "data": {
     * "sendCredentials": true/false
     * }
     * }
     * }
     * }
     *
     * Package setting JSON structure (in course_setting column):
     * {
     * "setting": {
     * "LEARNER_ENROLLMENT_SETTING": {
     * "key": "LEARNER_ENROLLMENT_SETTING",
     * "name": "Learner Enrollment Settings",
     * "data": {
     * "sendCredentials": true/false
     * }
     * }
     * }
     * }
     *
     * @param instituteId       The institute ID
     * @param packageSessionIds List of package session IDs for enrollment
     * @return true if credentials should be sent (default), false otherwise
     */
    private boolean getSendCredentialsFlag(String instituteId, List<String> packageSessionIds) {
        try {
            // LEVEL 1: Check institute-level setting first
            boolean instituteSendCredentials = checkInstituteSendCredentialsFlag(instituteId);

            // If institute says NO, short-circuit and return false immediately
            if (!instituteSendCredentials) {
                log.info("Institute {} has sendCredentials=false. Skipping package-level checks.", instituteId);
                return false;
            }

            // LEVEL 2: Institute says YES, now check package-level settings
            // If at least one package says YES, return true
            boolean packageSendCredentials = checkPackageSendCredentialsFlag(packageSessionIds);

            log.info("Final sendCredentials decision for institute {}: {}",
                    instituteId, packageSendCredentials);
            return packageSendCredentials;

        } catch (Exception e) {
            log.error("Error in getSendCredentialsFlag for institute: {} - defaulting to sendCredentials=true",
                    instituteId, e);
            return true;
        }
    }

    /**
     * Check institute-level sendCredentials flag
     *
     * @param instituteId The institute ID
     * @return true if credentials should be sent at institute level (default),
     *         false otherwise
     */
    private boolean checkInstituteSendCredentialsFlag(String instituteId) {
        try {
            Optional<Institute> instituteOpt = instituteRepository.findById(instituteId);

            if (instituteOpt.isEmpty()) {
                log.warn("Institute not found with id: {} - defaulting to sendCredentials=true", instituteId);
                return true;
            }

            Institute institute = instituteOpt.get();
            String settingJson = institute.getSetting();

            if (!StringUtils.hasText(settingJson)) {
                log.info("No setting_json found for institute: {} - defaulting to sendCredentials=true", instituteId);
                return true;
            }

            JsonNode rootNode = objectMapper.readTree(settingJson);

            // Check each level of the path to provide better error messages
            if (!rootNode.has("setting")) {
                log.info(
                        "'setting' object not found in setting_json for institute: {} - defaulting to sendCredentials=true",
                        instituteId);
                return true;
            }

            JsonNode settingNode = rootNode.path("setting");
            if (!settingNode.has("LEARNER_ENROLLMENT_SETTING")) {
                log.info(
                        "'LEARNER_ENROLLMENT_SETTING' not found in setting_json for institute: {} - defaulting to sendCredentials=true",
                        instituteId);
                return true;
            }

            JsonNode enrollmentSettingNode = settingNode.path("LEARNER_ENROLLMENT_SETTING");
            if (!enrollmentSettingNode.has("data")) {
                log.info(
                        "'data' object not found in LEARNER_ENROLLMENT_SETTING for institute: {} - defaulting to sendCredentials=true",
                        instituteId);
                return true;
            }

            JsonNode dataNode = enrollmentSettingNode.path("data");
            if (!dataNode.has("sendCredentials")) {
                log.info(
                        "'sendCredentials' field not found in LEARNER_ENROLLMENT_SETTING.data for institute: {} - defaulting to sendCredentials=true",
                        instituteId);
                return true;
            }

            JsonNode sendCredentialsNode = dataNode.path("sendCredentials");
            boolean sendCredentials = sendCredentialsNode.asBoolean(true);
            log.info("Institute {} sendCredentials setting found: {}", instituteId, sendCredentials);
            return sendCredentials;

        } catch (Exception e) {
            log.error("Error parsing institute setting_json for institute: {} - defaulting to sendCredentials=true",
                    instituteId, e);
            return true;
        }
    }

    /**
     * Check package-level sendCredentials flag for all packages in the enrollment
     * Returns true if at least one package has sendCredentials=true
     *
     * @param packageSessionIds List of package session IDs
     * @return true if at least one package says to send credentials (default),
     *         false otherwise
     */
    private boolean checkPackageSendCredentialsFlag(List<String> packageSessionIds) {
        try {
            // If no package sessions provided, default to true
            if (packageSessionIds == null || packageSessionIds.isEmpty()) {
                log.info("No package sessions provided - defaulting to sendCredentials=true");
                return true;
            }

            // Fetch all package sessions to get their package IDs
            List<PackageSession> packageSessions = packageSessionRepository
                    .findPackageSessionsByIds(packageSessionIds);

            if (packageSessions.isEmpty()) {
                log.warn("No package sessions found for provided IDs - defaulting to sendCredentials=true");
                return true;
            }

            // Check each package's course_setting for sendCredentials flag
            for (PackageSession packageSession : packageSessions) {
                try {
                    if (packageSession.getPackageEntity() == null) {
                        log.warn("Package entity is null for package session: {} - skipping",
                                packageSession.getId());
                        continue;
                    }

                    String packageId = packageSession.getPackageEntity().getId();
                    String courseSetting = packageSession.getPackageEntity().getCourseSetting();

                    // If courseSetting is null or empty, treat as sendCredentials=true for this
                    // package
                    if (!StringUtils.hasText(courseSetting)) {
                        log.info("No course_setting found for package: {} - treating as sendCredentials=true",
                                packageId);
                        return true; // At least one package says YES (by default)
                    }

                    // Parse the course_setting JSON
                    JsonNode rootNode = objectMapper.readTree(courseSetting);

                    // Navigate through the JSON structure
                    if (!rootNode.has("setting")) {
                        log.info(
                                "'setting' object not found in course_setting for package: {} - treating as sendCredentials=true",
                                packageId);
                        return true; // At least one package says YES (by default)
                    }

                    JsonNode settingNode = rootNode.path("setting");
                    if (!settingNode.has("LEARNER_ENROLLMENT_SETTING")) {
                        log.info(
                                "'LEARNER_ENROLLMENT_SETTING' not found in course_setting for package: {} - treating as sendCredentials=true",
                                packageId);
                        return true; // At least one package says YES (by default)
                    }

                    JsonNode enrollmentSettingNode = settingNode.path("LEARNER_ENROLLMENT_SETTING");
                    if (!enrollmentSettingNode.has("data")) {
                        log.info(
                                "'data' object not found in LEARNER_ENROLLMENT_SETTING for package: {} - treating as sendCredentials=true",
                                packageId);
                        return true; // At least one package says YES (by default)
                    }

                    JsonNode dataNode = enrollmentSettingNode.path("data");
                    if (!dataNode.has("sendCredentials")) {
                        log.info(
                                "'sendCredentials' field not found in LEARNER_ENROLLMENT_SETTING.data for package: {} - treating as sendCredentials=true",
                                packageId);
                        return true; // At least one package says YES (by default)
                    }

                    JsonNode sendCredentialsNode = dataNode.path("sendCredentials");
                    boolean packageSendCredentials = sendCredentialsNode.asBoolean(true);

                    log.info("Package {} sendCredentials setting found: {}", packageId, packageSendCredentials);

                    // If at least one package says YES, return true
                    if (packageSendCredentials) {
                        log.info("At least one package ({}) has sendCredentials=true - returning true", packageId);
                        return true;
                    }

                } catch (Exception e) {
                    log.error("Error parsing course_setting for package session: {} - treating as sendCredentials=true",
                            packageSession.getId(), e);
                    return true; // Error in parsing, default to true
                }
            }

            // If we reach here, all packages explicitly said NO
            log.info("All packages have sendCredentials=false - returning false");
            return false;

        } catch (Exception e) {
            log.error("Error in checkPackageSendCredentialsFlag - defaulting to sendCredentials=true", e);
            return true;
        }
    }

}
