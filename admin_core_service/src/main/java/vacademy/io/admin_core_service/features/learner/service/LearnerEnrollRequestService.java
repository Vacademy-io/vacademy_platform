package vacademy.io.admin_core_service.features.learner.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.enroll_invite.dto.EnrollInviteSettingDTO;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.enums.EnrollInviteTag;
import vacademy.io.admin_core_service.features.enroll_invite.service.EnrollInviteService;
import vacademy.io.admin_core_service.features.enroll_invite.service.SubOrgService;
import vacademy.io.admin_core_service.features.faculty.dto.AddUserAccessDTO;
import vacademy.io.admin_core_service.features.faculty.service.FacultyService;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSubOrg;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.enums.StudentSubOrgLinkType;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSubOrgRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.learner_payment_option_operation.service.PaymentOptionOperationFactory;
import vacademy.io.admin_core_service.features.learner_payment_option_operation.service.PaymentOptionOperationStrategy;
import vacademy.io.admin_core_service.features.notification.service.DynamicNotificationService;
import vacademy.io.admin_core_service.features.notification.enums.NotificationEventType;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.user_subscription.dto.coupon.CouponValidateRequestDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.coupon.CouponValidateResponseDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.AppliedCouponDiscount;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentOptionType;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanSourceEnum;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.repository.AppliedCouponDiscountRepository;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentOptionService;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentPlanService;
import vacademy.io.admin_core_service.features.user_subscription.service.UserPlanService;
import vacademy.io.admin_core_service.features.user_subscription.service.coupon.CouponValidationService;
import vacademy.io.admin_core_service.features.enrollment_policy.service.ReenrollmentGapValidationService;
import vacademy.io.admin_core_service.features.institute_learner.service.LearnerEnrollmentEntryService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerEnrollResponseDTO;
import vacademy.io.common.auth.dto.learner.LearnerPackageSessionsEnrollDTO;
import vacademy.io.common.auth.dto.learner.LearnerEnrollRequestDTO;
import vacademy.io.common.common.dto.CustomFieldValueDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowEngineService;
import vacademy.io.common.logging.SentryLogger;

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
    private vacademy.io.admin_core_service.features.enroll_invite.repository.EnrollInviteRepository enrollInviteRepository;

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
    private CouponValidationService couponValidationService;

    @Autowired
    private AppliedCouponDiscountRepository appliedCouponDiscountRepository;

    @Autowired
    private DynamicNotificationService dynamicNotificationService;

    @Autowired
    private SubOrgService subOrgService;

    @Autowired
    private PackageSessionRepository packageSessionRepository;

    @Autowired
    private vacademy.io.admin_core_service.features.enroll_invite.repository.PackageSessionLearnerInvitationToPaymentOptionRepository packageSessionLearnerInvitationToPaymentOptionRepository;

    @Autowired
    private ReenrollmentGapValidationService reenrollmentGapValidationService;

    @Autowired
    private LearnerEnrollmentEntryService learnerEnrollmentEntryService;

    @Autowired
    private InstituteRepository instituteRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private WorkflowEngineService workflowEngineService;

    @Autowired
    private LearnerInvitationLinkService learnerInvitationLinkService;

    @Autowired
    private vacademy.io.admin_core_service.features.suborg.service.SubOrgSubscriptionService subOrgSubscriptionService;

    @Autowired
    private FacultyService facultyService;

    @Autowired
    private StudentSubOrgRepository studentSubOrgRepository;

    @Autowired
    private InstituteStudentRepository instituteStudentRepository;

    @Autowired
    private StudentSessionInstituteGroupMappingRepository ssigmRepository;

    @Autowired
    private vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository userPlanRepository;

    @Autowired
    private vacademy.io.admin_core_service.features.packages.service.PackageSessionService packageSessionService;

    @Autowired
    private vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService instituteSettingService;

    @Transactional
    public LearnerEnrollResponseDTO recordLearnerRequest(LearnerEnrollRequestDTO learnerEnrollRequestDTO) {
        return recordLearnerRequest(learnerEnrollRequestDTO, Map.of());
    }

    @Transactional
    public LearnerEnrollResponseDTO recordLearnerRequest(LearnerEnrollRequestDTO learnerEnrollRequestDTO,
            Map<String, Object> extraData) {
        LearnerPackageSessionsEnrollDTO enrollDTO = learnerEnrollRequestDTO.getLearnerPackageSessionEnroll();
        if (!StringUtils.hasText(learnerEnrollRequestDTO.getUser().getId())) {
            // B2B: Override auth roles from invite settingJson if it's a SUB_ORG invite
            if (StringUtils.hasText(enrollDTO.getEnrollInviteId())) {
                EnrollInvite preCheckInvite = getValidatedEnrollInvite(enrollDTO.getEnrollInviteId());
                if (EnrollInviteTag.SUB_ORG.name().equals(preCheckInvite.getTag())) {
                    boolean rolesResolved = false;
                    if (StringUtils.hasText(preCheckInvite.getSettingJson())) {
                        try {
                            ObjectMapper mapper = new ObjectMapper();
                            EnrollInviteSettingDTO settingDTO = mapper.readValue(
                                    preCheckInvite.getSettingJson(), EnrollInviteSettingDTO.class);
                            if (settingDTO.getSetting() != null
                                    && settingDTO.getSetting().getSubOrgSetting() != null
                                    && settingDTO.getSetting().getSubOrgSetting().getAuthRoles() != null
                                    && !settingDTO.getSetting().getSubOrgSetting().getAuthRoles().isEmpty()) {
                                learnerEnrollRequestDTO.getUser().setRoles(
                                        settingDTO.getSetting().getSubOrgSetting().getAuthRoles());
                                rolesResolved = true;
                                log.info("Overrode user roles from SUB_ORG invite settingJson: {}",
                                        settingDTO.getSetting().getSubOrgSetting().getAuthRoles());
                            }
                        } catch (Exception e) {
                            log.warn("Failed to parse settingJson for role override: {}", e.getMessage());
                        }
                    }
                    if (!rolesResolved) {
                        throw new VacademyException(
                                "Sub-org invite does not have admin roles configured. Please contact the organization admin.");
                    }
                }
            }

            boolean sendCredentials = getSendCredentialsFlag(
                    learnerEnrollRequestDTO.getInstituteId(),
                    enrollDTO.getPackageSessionIds());

            // Suppress credential email for PAID enrollments — will be sent after payment
            // confirmation
            if (sendCredentials && StringUtils.hasText(enrollDTO.getPaymentOptionId())) {
                try {
                    PaymentOption earlyPaymentOption = paymentOptionService.findById(enrollDTO.getPaymentOptionId());
                    if (earlyPaymentOption != null
                            && !PaymentOptionType.FREE.name().equals(earlyPaymentOption.getType())) {
                        log.info(
                                "Non-free enrollment detected (type={}). Suppressing credential email until payment confirmed.",
                                earlyPaymentOption.getType());
                        sendCredentials = false;
                    }
                } catch (Exception e) {
                    log.warn("Could not determine payment type for credential email suppression: {}", e.getMessage());
                }
            }

            String learndashBaseUrl = resolveLearnerPortalUrl(
                    enrollDTO.getPackageSessionIds(), learnerEnrollRequestDTO.getInstituteId());
            UserDTO user = authService.createUserFromAuthServiceForLearnerEnrollment(learnerEnrollRequestDTO.getUser(),
                    learnerEnrollRequestDTO.getInstituteId(), sendCredentials, learndashBaseUrl);
            learnerEnrollRequestDTO.setUser(user);
            EnrollInvite enrollInvite = getValidatedEnrollInvite(enrollDTO.getEnrollInviteId());
            // Generate coupon code for new learner enrollment
            learnerCouponService.generateCouponCodeForLearner(user.getId(), learnerEnrollRequestDTO.getInstituteId(),
                    enrollInvite.getInviteCode());
        }
        EnrollInvite enrollInvite = getValidatedEnrollInvite(enrollDTO.getEnrollInviteId());
        PaymentOption paymentOption = getValidatedPaymentOption(enrollDTO.getPaymentOptionId());
        PaymentPlan paymentPlan = getOptionalPaymentPlan(enrollDTO.getPlanId());

        // Verify the FE-supplied (plan, option, package_session) triple all
        // belong to the FE-supplied enroll_invite. Without this, a learner
        // could combine a free invite's path with a paid plan's IDs and
        // enroll into a paid course for nothing. See validateEnrollmentReferences
        // for the per-rule rationale.
        validateEnrollmentReferences(enrollInvite, paymentOption, paymentPlan,
                enrollDTO.getPackageSessionIds());

        // Determine if this is a SubOrg enrollment and create SubOrg if needed
        String userPlanSource = UserPlanSourceEnum.USER.name();
        String subOrgId = null;

        // B2B: Detect SUB_ORG invite (org-level purchase by sub-org admin)
        if (EnrollInviteTag.SUB_ORG.name().equals(enrollInvite.getTag())
                && enrollInvite.getSubOrgId() != null) {
            log.info("Detected SUB_ORG invite purchase. Invite={}, SubOrg={}",
                    enrollInvite.getId(), enrollInvite.getSubOrgId());
            userPlanSource = UserPlanSourceEnum.SUB_ORG.name();
            subOrgId = enrollInvite.getSubOrgId();
        } else if (enrollDTO.getPackageSessionIds() != null && enrollDTO.getPackageSessionIds().size() == 1) {
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
                        new String("You are already enrolled in this demo. Please complete your current trial first."));
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

        // Ensure PaymentInitiationRequest has user's email if not already set
        // This is critical for payment receipt emails to be sent correctly
        if (enrollDTO.getPaymentInitiationRequest() != null
                && !StringUtils.hasText(enrollDTO.getPaymentInitiationRequest().getEmail())
                && StringUtils.hasText(learnerEnrollRequestDTO.getUser().getEmail())) {
            log.info("Setting user email {} in PaymentInitiationRequest for payment receipt emails",
                    learnerEnrollRequestDTO.getUser().getEmail());
            enrollDTO.getPaymentInitiationRequest().setEmail(learnerEnrollRequestDTO.getUser().getEmail());
        }

        // B2B: Validate seat limit for SUBORG_LEARNER invites (per PS independently)
        if (EnrollInviteTag.SUBORG_LEARNER.name().equals(enrollInvite.getTag())
                && enrollInvite.getSubOrgId() != null) {
            for (String psId : enrollDTO.getPackageSessionIds()) {
                validateSubOrgSeatLimit(enrollInvite.getSubOrgId(), psId);
            }
        }

        UserPlan userPlan = createUserPlan(
                learnerEnrollRequestDTO.getUser().getId(),
                learnerEnrollRequestDTO.getInstituteId(),
                learnerEnrollRequestDTO.getUser() != null ? learnerEnrollRequestDTO.getUser().getEmail() : null,
                enrollDTO,
                enrollInvite,
                paymentOption,
                paymentPlan,
                userPlanSource,
                subOrgId);

        // B2B: After org-level UserPlan creation, create scoped FREE invites
        // For FREE plans (status=ACTIVE), do it now. For PAID plans, webhook handles
        // it.
        if (EnrollInviteTag.SUB_ORG.name().equals(enrollInvite.getTag())
                && enrollInvite.getSubOrgId() != null
                && UserPlanStatusEnum.ACTIVE.name().equals(userPlan.getStatus())) {
            log.info("SUB_ORG FREE plan activated. Creating scoped free invites for sub-org={}",
                    enrollInvite.getSubOrgId());
            subOrgSubscriptionService.createScopedFreeInvites(enrollInvite, userPlan, paymentPlan);
        }

        LearnerEnrollResponseDTO response;
        response = enrollLearnerToBatch(
                learnerEnrollRequestDTO,
                enrollDTO,
                enrollInvite,
                paymentOption,
                userPlan,
                extraData);

        // B2B: Post-processing for SUB_ORG invite enrollment
        // Creates ROOT_ADMIN mappings, StudentSubOrg entry, and faculty mappings
        if (EnrollInviteTag.SUB_ORG.name().equals(enrollInvite.getTag())
                && enrollInvite.getSubOrgId() != null) {
            postProcessSubOrgEnrollment(
                    learnerEnrollRequestDTO.getUser(),
                    enrollDTO.getPackageSessionIds(),
                    enrollInvite,
                    userPlan);
        }

        // Send enrollment notifications ONLY for FREE enrollments (status = ACTIVE)
        // For PAID enrollments, notifications will be sent after webhook confirms
        // payment
        if (UserPlanStatusEnum.ACTIVE.name().equals(userPlan.getStatus())) {

            // Decrement inventory (available slots) for each enrolled package session
            // For FREE enrollments, decrement immediately since no payment webhook follows
            for (String packageSessionId : enrollDTO.getPackageSessionIds()) {
                try {
                    packageSessionService.decrementAvailability(packageSessionId, 1);
                } catch (Exception e) {
                    log.warn("Failed to decrement inventory for packageSession {} on free enrollment: {}",
                            packageSessionId, e.getMessage());
                    // Don't block enrollment if inventory update fails
                }
            }
            // Check if workflow is configured for the package session
            // If workflow exists, skip notifications - workflow will handle them
            boolean hasWorkflow = false;
            for (String packageSessionId : enrollDTO.getPackageSessionIds()) {
                PackageSession ps = packageSessionRepository.findById(packageSessionId).orElse(null);
                if (ps != null && learnerEnrollmentEntryService.hasWorkflowConfiguration(ps)) {
                    hasWorkflow = true;
                    log.info(
                            "Workflow configured for package session {}. Skipping notifications - workflow will handle.",
                            packageSessionId);
                    break;
                }
            }

            if (!hasWorkflow) {
                log.info("FREE enrollment completed. Sending enrollment notifications for user: {}",
                        learnerEnrollRequestDTO.getUser().getId());
                // sendDynamicNotificationForEnrollment(
                // learnerEnrollRequestDTO.getInstituteId(),
                // learnerEnrollRequestDTO.getUser(),
                // paymentOption,
                // enrollInvite,
                // enrollDTO.getPackageSessionIds().get(0) // Get first package session ID
                // );
                //
                // sendReferralInvitationEmail(
                // learnerEnrollRequestDTO.getInstituteId(),
                // learnerEnrollRequestDTO.getUser(),
                // enrollInvite);
            } else {
                log.info(
                        "FREE enrollment with workflow. Notifications skipped for user: {}. Workflow will handle enrollment.",
                        learnerEnrollRequestDTO.getUser().getId());

                // Trigger workflow for each package session
                for (String packageSessionId : enrollDTO.getPackageSessionIds()) {
                    PackageSession ps = packageSessionRepository.findById(packageSessionId).orElse(null);
                    if (ps != null) {
                        List<String> workflowIds = learnerEnrollmentEntryService.getWorkflowIds(ps);
                        for (String workflowId : workflowIds) {
                            try {
                                // Build context for workflow - ONLY essential data
                                // Template name, language code, and template vars are configured in TRANSFORM
                                // node
                                Map<String, Object> workflowContext = new java.util.HashMap<>();
                                workflowContext.put("instituteIdForWhatsapp", learnerEnrollRequestDTO.getInstituteId());
                                workflowContext.put("package_session_id", packageSessionId);
                                workflowContext.put("destination_package_session_id", packageSessionId);
                                workflowContext.put("name", learnerEnrollRequestDTO.getUser().getFullName());

                                // Build users list with essential data only
                                Map<String, Object> userMap = new java.util.HashMap<>();
                                String rawPhone = learnerEnrollRequestDTO.getUser().getMobileNumber();
                                userMap.put("phone_number", rawPhone);
                                // Layer 1: warn Sentry when phone is missing or too short to be valid
                                if (rawPhone == null || rawPhone.isEmpty()
                                        || rawPhone.replaceAll("[^0-9]", "").length() < 10) {
                                    SentryLogger.logWarning(
                                            "WhatsApp enrollment skipped: invalid or missing phone number",
                                            Map.of(
                                                    "user.id", learnerEnrollRequestDTO.getUser().getId(),
                                                    "phone", rawPhone != null ? rawPhone : "null",
                                                    "workflow.id", workflowId,
                                                    "package_session.id", packageSessionId,
                                                    "layer", "1-enrollment-trigger"));
                                }
                                userMap.put("name", learnerEnrollRequestDTO.getUser().getFullName());
                                userMap.put("username", learnerEnrollRequestDTO.getUser().getEmail() != null
                                        ? learnerEnrollRequestDTO.getUser().getEmail().split("@")[0]
                                        : learnerEnrollRequestDTO.getUser().getId());
                                userMap.put("user_id", learnerEnrollRequestDTO.getUser().getId());
                                userMap.put("email", learnerEnrollRequestDTO.getUser().getEmail());

                                // Populating referral variables for workflow emails
                                String invitationLink = learnerInvitationLinkService
                                        .generateLearnerInvitationResponseLink(
                                                learnerEnrollRequestDTO.getInstituteId(), enrollInvite,
                                                learnerEnrollRequestDTO.getUser().getId());
                                String shortRefLink = learnerInvitationLinkService
                                        .generateShortLearnerInvitationResponseLink(
                                                learnerEnrollRequestDTO.getInstituteId(), enrollInvite,
                                                learnerEnrollRequestDTO.getUser().getId());
                                String refCode = learnerInvitationLinkService
                                        .getRefFromUserCoupon(learnerEnrollRequestDTO.getUser().getId());

                                userMap.put("referral_link", invitationLink);
                                userMap.put("short_referral_link", shortRefLink);
                                userMap.put("ref_code", refCode);
                                userMap.put("invite_code", enrollInvite != null ? enrollInvite.getInviteCode() : "");

                                // Extract learndash_base_url from this package's courseSetting
                                String wfLearndashBaseUrl = getLearndashBaseUrlFromPackage(List.of(packageSessionId));
                                if (StringUtils.hasText(wfLearndashBaseUrl)) {
                                    userMap.put("learndash_base_url", wfLearndashBaseUrl);
                                    workflowContext.put("learndash_base_url", wfLearndashBaseUrl);
                                }

                                workflowContext.put("users", List.of(userMap));

                                log.info("Triggering workflow {} for user {} on package session {}",
                                        workflowId, learnerEnrollRequestDTO.getUser().getId(), packageSessionId);

                                workflowEngineService.run(workflowId, workflowContext);

                            } catch (Exception e) {
                                log.error("Failed to trigger workflow {} for user {}: {}",
                                        workflowId, learnerEnrollRequestDTO.getUser().getId(), e.getMessage(), e);
                                SentryLogger.logError(e, "WhatsApp workflow trigger failed",
                                        Map.of(
                                                "workflow.id", workflowId,
                                                "user.id", learnerEnrollRequestDTO.getUser().getId(),
                                                "package_session.id", packageSessionId,
                                                "layer", "1-enrollment-trigger"));
                            }
                        }
                    }
                }
            }
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

        response.setUserPlanId(userPlan.getId());
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

    /**
     * Post-process SUB_ORG invite enrollment:
     * 1. Update SSIGM entries to ROOT_ADMIN role + set subOrg
     * 2. Create StudentSubOrg junction entry
     * 3. Create faculty mappings for admin portal access
     */
    private void postProcessSubOrgEnrollment(
            UserDTO user,
            List<String> packageSessionIds,
            EnrollInvite enrollInvite,
            UserPlan userPlan) {
        String subOrgId = enrollInvite.getSubOrgId();
        String userId = user.getId();

        try {
            // 1. Update created SSIGM entries: set ROOT_ADMIN role and subOrg
            List<StudentSessionInstituteGroupMapping> mappings = ssigmRepository
                    .findByUserPlanIdAndStatus(userPlan.getId(), "ACTIVE");
            if (mappings.isEmpty()) {
                // For PAID plans, mappings may be in INVITED status
                mappings = ssigmRepository.findByUserPlanIdAndStatus(userPlan.getId(), "INVITED");
            }

            Institute subOrgInstitute = instituteRepository.findById(subOrgId).orElse(null);

            for (StudentSessionInstituteGroupMapping mapping : mappings) {
                mapping.setCommaSeparatedOrgRoles("ROOT_ADMIN");
                if (subOrgInstitute != null) {
                    mapping.setSubOrg(subOrgInstitute);
                }
                ssigmRepository.save(mapping);
            }
            log.info("Updated {} SSIGM entries with ROOT_ADMIN role for sub-org={}", mappings.size(), subOrgId);

            // 2. Create StudentSubOrg junction entry
            Optional<StudentSubOrg> existingEntry = studentSubOrgRepository.findByUserIdAndSubOrgId(userId, subOrgId);
            if (existingEntry.isEmpty()) {
                List<Student> students = instituteStudentRepository.findByUserId(userId);
                String studentId = students.isEmpty() ? userId : students.get(0).getId();
                StudentSubOrg studentSubOrg = new StudentSubOrg(
                        studentId,
                        userId,
                        subOrgInstitute,
                        StudentSubOrgLinkType.DIRECT.name());
                studentSubOrgRepository.save(studentSubOrg);
                log.info("Created StudentSubOrg entry for user={} sub-org={}", userId, subOrgId);
            }

            // 3. Create faculty mappings for each package session (admin portal access)
            // Resolve the FSPSSM access_permission CSV once from the sub-org's settingJson
            // (set at create-with-subscription time via admin_permissions). Falls back to
            // "FULL" inside the service when the sub-org has no explicit ADMIN_PERMISSIONS.
            String accessPermissionCsv = subOrgSubscriptionService
                    .resolveAdminPermissionCsv(subOrgId, enrollInvite.getInstituteId());
            for (String packageSessionId : packageSessionIds) {
                try {
                    // PACKAGE_SESSION entry
                    AddUserAccessDTO accessDTO = AddUserAccessDTO.builder()
                            .userId(userId)
                            .packageSessionId(packageSessionId)
                            .name(user.getFullName())
                            .status("ACTIVE")
                            .userType("ROOT_ADMIN")
                            .accessType("PACKAGE_SESSION")
                            .accessId(packageSessionId)
                            .accessPermission(accessPermissionCsv)
                            .linkageType("SUB_ORG")
                            .suborgId(subOrgId)
                            .build();
                    facultyService.grantUserAccess(accessDTO);
                    log.info("Created faculty mapping for user={} packageSession={} sub-org={} perm={}",
                            userId, packageSessionId, subOrgId, accessPermissionCsv);

                    // Auto-discover invites with sub_org_id for this PS and create ENROLL_INVITE
                    // entries
                    List<String> inviteIds = enrollInviteRepository
                            .findInviteIdsForSubOrgAndPackageSession(subOrgId, packageSessionId);
                    for (String inviteId : inviteIds) {
                        AddUserAccessDTO inviteAccess = AddUserAccessDTO.builder()
                                .userId(userId)
                                .packageSessionId(packageSessionId)
                                .name(user.getFullName())
                                .status("ACTIVE")
                                .userType("ROOT_ADMIN")
                                .accessType("ENROLL_INVITE")
                                .accessId(inviteId)
                                .accessPermission(accessPermissionCsv)
                                .linkageType("SUB_ORG")
                                .suborgId(subOrgId)
                                .build();
                        facultyService.grantUserAccess(inviteAccess);
                    }
                    if (!inviteIds.isEmpty()) {
                        log.info("Created {} ENROLL_INVITE faculty mappings for user={} sub-org={} PS={}",
                                inviteIds.size(), userId, subOrgId, packageSessionId);
                    }
                } catch (Exception e) {
                    log.error("Failed to create faculty mapping for packageSession={}: {}",
                            packageSessionId, e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("Error in postProcessSubOrgEnrollment for user={} sub-org={}: {}",
                    userId, subOrgId, e.getMessage(), e);
        }
    }

    /**
     * Validates seat limit for SUBORG_LEARNER enrollments.
     * Finds ROOT_ADMIN's UserPlan → PaymentPlan.memberCount for the sub-org + PS.
     * Counts active learner members (excluding ROOT_ADMIN) and rejects if at
     * capacity.
     * Each PS is validated independently.
     */
    private void validateSubOrgSeatLimit(String subOrgId, String packageSessionId) {
        Optional<StudentSessionInstituteGroupMapping> rootAdminOpt = ssigmRepository
                .findRootAdminMappingBySubOrgAndPackageSession(subOrgId, packageSessionId);
        if (rootAdminOpt.isEmpty() || rootAdminOpt.get().getUserPlanId() == null) {
            log.warn("No ROOT_ADMIN mapping found for sub-org={} PS={} — skipping seat validation",
                    subOrgId, packageSessionId);
            return;
        }

        Optional<UserPlan> userPlanOpt = userPlanRepository.findById(rootAdminOpt.get().getUserPlanId());
        if (userPlanOpt.isEmpty() || userPlanOpt.get().getPaymentPlan() == null) {
            return;
        }

        Integer memberCount = userPlanOpt.get().getPaymentPlan().getMemberCount();
        if (memberCount == null) {
            return; // No limit set — unlimited
        }

        long currentCount = ssigmRepository.countBySubOrgIdAndPackageSessionIdAndStatus(
                subOrgId, packageSessionId, "ACTIVE");

        if (currentCount >= memberCount) {
            throw new VacademyException(String.format(
                    "Seat limit reached for this organization. Current members: %d, Maximum allowed: %d.",
                    currentCount, memberCount));
        }
    }

    private EnrollInvite getValidatedEnrollInvite(String enrollInviteId) {
        return Optional.ofNullable(enrollInviteId)
                .map(enrollInviteService::findById)
                .orElseThrow(() -> new IllegalArgumentException("Enroll Invite ID is required."));
    }

    /**
     * Defense against FE-supplied reference tampering. The enroll request
     * carries four IDs (invite, payment_option, plan, package_sessions);
     * without verifying their relationships a learner could pair a free
     * invite's code path with another course's paid plan and walk away
     * with a paid enrollment for nothing. We assert:
     *
     *   1. If a plan was supplied, it belongs to the supplied payment option.
     *   2. Every supplied package_session has an ACTIVE
     *      (enroll_invite, payment_option, package_session) bridge row.
     *
     * Package-session-less flows (CPO with no package context) skip rule 2.
     */
    private void validateEnrollmentReferences(EnrollInvite enrollInvite,
            PaymentOption paymentOption,
            PaymentPlan paymentPlan,
            List<String> packageSessionIds) {
        if (paymentPlan != null
                && paymentPlan.getPaymentOption() != null
                && !paymentOption.getId().equals(paymentPlan.getPaymentOption().getId())) {
            log.warn("Reference mismatch: plan {} belongs to option {}, supplied option {}",
                    paymentPlan.getId(),
                    paymentPlan.getPaymentOption().getId(),
                    paymentOption.getId());
            throw new VacademyException("Selected plan does not belong to the chosen payment option.");
        }

        if (packageSessionIds == null || packageSessionIds.isEmpty()) {
            return;
        }

        java.util.List<vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption> bridges =
                packageSessionLearnerInvitationToPaymentOptionRepository
                        .findByEnrollInvite_IdInAndPaymentOption_IdInAndPackageSession_IdInAndStatusIn(
                                java.util.List.of(enrollInvite.getId()),
                                java.util.List.of(paymentOption.getId()),
                                packageSessionIds,
                                java.util.List.of("ACTIVE"));
        java.util.Set<String> bridged = new java.util.HashSet<>();
        for (var b : bridges) {
            if (b.getPackageSession() != null) {
                bridged.add(b.getPackageSession().getId());
            }
        }
        for (String psId : packageSessionIds) {
            if (psId != null && !bridged.contains(psId)) {
                log.warn(
                        "Reference mismatch: package_session {} not bridged to invite {} + option {}",
                        psId, enrollInvite.getId(), paymentOption.getId());
                throw new VacademyException(
                        "Selected batch is not part of this invite. Please reload and try again.");
            }
        }
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
            String instituteId,
            String userEmail,
            LearnerPackageSessionsEnrollDTO enrollDTO,
            EnrollInvite enrollInvite,
            PaymentOption paymentOption,
            PaymentPlan paymentPlan,
            String source,
            String subOrgId) {
        // For CPO, fall back to the mirror's synthetic ACTIVE plan when the caller did
        // not pass an explicit one. Keeps userPlan.paymentPlan non-null for downstream
        // readers (analytics, multi-package summer, renewal checks).
        if (paymentPlan == null
                && PaymentOptionType.CPO.name().equals(paymentOption.getType())
                && paymentOption.getPaymentPlans() != null
                && !paymentOption.getPaymentPlans().isEmpty()) {
            paymentPlan = paymentOption.getPaymentPlans().get(0);
        }

        String type = paymentOption.getType();
        boolean requiresPayment = enrollDTO.getPaymentInitiationRequest() != null;
        String userPlanStatus;
        if (type.equals(PaymentOptionType.SUBSCRIPTION.name())
                || type.equals(PaymentOptionType.ONE_TIME.name())
                || (type.equals(PaymentOptionType.CPO.name()) && requiresPayment)) {
            userPlanStatus = UserPlanStatusEnum.PENDING_FOR_PAYMENT.name();
        } else {
            userPlanStatus = UserPlanStatusEnum.ACTIVE.name();
        }

        // Resolve discount coupon (if learner entered one at checkout) by
        // re-running the validator. Do NOT trust FE-supplied IDs — the FE only
        // sends the code string; the BE recomputes scope, plan-type fit, etc.
        // and produces the AppliedCouponDiscount that UserPlanService then
        // snapshots + atomically decrements via CouponRedemptionService.
        AppliedCouponDiscount appliedCouponDiscount = resolveAppliedCoupon(
                enrollDTO, instituteId, userEmail, paymentPlan);

        return userPlanService.createUserPlan(
                userId,
                paymentPlan,
                appliedCouponDiscount,
                enrollInvite,
                paymentOption,
                enrollDTO.getPaymentInitiationRequest(),
                userPlanStatus,
                source,
                subOrgId,
                enrollDTO.getStartDate());
    }

    /**
     * Returns the AppliedCouponDiscount that the learner-supplied code resolves
     * to, or {@code null} when no code was supplied. Throws when a code was
     * supplied but failed validation — the message carries the stable error
     * code from {@link vacademy.io.admin_core_service.features.user_subscription.service.coupon.CouponValidationMessages}
     * so the controller can surface a learner-friendly error.
     */
    private AppliedCouponDiscount resolveAppliedCoupon(
            LearnerPackageSessionsEnrollDTO enrollDTO,
            String instituteId,
            String userEmail,
            PaymentPlan paymentPlan) {
        String code = enrollDTO.getCouponCode();
        if (code == null || code.isBlank()) {
            return null;
        }

        String packageSessionId = (enrollDTO.getPackageSessionIds() != null
                && !enrollDTO.getPackageSessionIds().isEmpty())
                ? enrollDTO.getPackageSessionIds().get(0)
                : null;
        Double totalAmount = paymentPlan != null ? paymentPlan.getActualPrice() : 0.0;

        CouponValidateRequestDTO req = CouponValidateRequestDTO.builder()
                .couponCode(code)
                .instituteId(instituteId)
                .packageSessionId(packageSessionId)
                .enrollInviteId(enrollDTO.getEnrollInviteId())
                .paymentPlanId(paymentPlan != null ? paymentPlan.getId() : enrollDTO.getPlanId())
                .userEmail(userEmail)
                .totalAmount(totalAmount)
                .build();

        CouponValidateResponseDTO resp = couponValidationService.validate(req);
        if (!resp.isValid()) {
            throw new VacademyException(resp.getMessage());
        }
        return appliedCouponDiscountRepository.findById(resp.getAppliedCouponDiscountId())
                .orElseThrow(() -> new VacademyException(
                        "Resolved AppliedCouponDiscount missing: " + resp.getAppliedCouponDiscountId()));
    }

    private LearnerEnrollResponseDTO enrollLearnerToBatch(
            LearnerEnrollRequestDTO learnerEnrollRequestDTO,
            LearnerPackageSessionsEnrollDTO enrollDTO,
            EnrollInvite enrollInvite,
            PaymentOption paymentOption,
            UserPlan userPlan,
            Map<String, Object> extraData) {
        PaymentOptionOperationStrategy strategy = paymentOptionOperationFactory
                .getStrategy(PaymentOptionType.fromString(paymentOption.getType()));

        return strategy.enrollLearnerToBatch(
                learnerEnrollRequestDTO.getUser(),
                enrollDTO,
                learnerEnrollRequestDTO.getInstituteId(),
                enrollInvite,
                paymentOption,
                userPlan,
                extraData, // passes the data from arguments
                learnerEnrollRequestDTO.getLearnerExtraDetails());
    }

    /**
     * Extract sendCredentials flag using two-level policy:
     * 1. Package-level setting (short-circuits if all packages say NO)
     * 2. Institute-level setting (returns YES/NO based on institute config)
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
            // LEVEL 1: Check package-level setting first
            boolean packageSendCredentials = checkPackageSendCredentialsFlag(packageSessionIds);

            // If package says NO, short-circuit and return false immediately
            if (!packageSendCredentials) {
                log.info("All packages have sendCredentials=false. Skipping institute-level checks.");
                return false;
            }

            // LEVEL 2: Package says YES, now check institute-level setting
            boolean instituteSendCredentials = checkInstituteSendCredentialsFlag(instituteId);
            if (!instituteSendCredentials) {
                log.info("Institute {} LEARNER_ENROLLMENT_SETTING.sendCredentials=false", instituteId);
                return false;
            }

            // LEVEL 3: Honor the COURSE_SETTING.enrollmentNotifications.showSendCredentials
            // master toggle that the admin display-settings page writes, and that
            // bulk/v3/assign + the admin "Enrol Customer" button already follow.
            // When the institute turns it off, no learner-side enrollment should mail
            // credentials either — matches the user-visible "Send Credentials" switch.
            boolean courseSettingShowSendCredentials =
                    checkCourseSettingFlag(instituteId, "showSendCredentials");
            log.info("Final sendCredentials decision for institute {}: LEARNER_ENROLLMENT_SETTING=true, " +
                            "COURSE_SETTING.showSendCredentials={}",
                    instituteId, courseSettingShowSendCredentials);
            return courseSettingShowSendCredentials;

        } catch (Exception e) {
            log.error("Error in getSendCredentialsFlag for institute: {} - defaulting to sendCredentials=true",
                    instituteId, e);
            return true;
        }
    }

    /**
     * Reads INSTITUTE.setting.COURSE_SETTING.data.enrollmentNotifications.{flagKey}.
     * Defaults to {@code true} when the setting, the enrollmentNotifications block,
     * or the specific flag is missing — matches the FE's
     * {@code DEFAULT_COURSE_SETTINGS.enrollmentNotifications} defaults so behavior
     * is unchanged for institutes that never touched the toggle.
     * <p>
     * Used as a second gate on top of {@code LEARNER_ENROLLMENT_SETTING.sendCredentials}
     * and as the primary gate for the post-enrollment LEARNER_ENROLL notification.
     */
    @SuppressWarnings("unchecked")
    private boolean checkCourseSettingFlag(String instituteId, String flagKey) {
        try {
            Object data = instituteSettingService.getSettingByInstituteIdAndKey(
                    instituteId, "COURSE_SETTING");
            if (!(data instanceof Map)) {
                return true;
            }
            Object enrollmentNotifications = ((Map<String, Object>) data).get("enrollmentNotifications");
            if (!(enrollmentNotifications instanceof Map)) {
                return true;
            }
            Object flag = ((Map<String, Object>) enrollmentNotifications).get(flagKey);
            if (flag instanceof Boolean) {
                return (Boolean) flag;
            }
            return true;
        } catch (Exception e) {
            log.warn("Could not read COURSE_SETTING.enrollmentNotifications.{} for institute {}: {}",
                    flagKey, instituteId, e.getMessage());
            return true;
        }
    }

    /**
     * Mirror of {@link #checkCourseSettingFlag} for the
     * {@code showNotifyLearners} flag. Exposed as a public-package method so the
     * post-payment notification path in {@code UserPlanService} can honor the
     * same gate without duplicating the JSON walk.
     */
    public boolean shouldSendLearnerNotification(String instituteId) {
        return checkCourseSettingFlag(instituteId, "showNotifyLearners");
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

    /**
     * Resolves the learner portal URL for the credential email's "Access Your
     * Account" link.
     * Priority: package.course_setting.LMS_SETTING.learndash_base_url →
     * institute.learnerPortalBaseUrl → null.
     * Kept in sync with the v3 path
     * (BulkAssignmentService.resolveLearnerPortalUrl).
     */
    private String resolveLearnerPortalUrl(List<String> packageSessionIds, String instituteId) {
        String packageUrl = getLearndashBaseUrlFromPackage(packageSessionIds);
        if (StringUtils.hasText(packageUrl)) {
            return packageUrl;
        }
        if (StringUtils.hasText(instituteId)) {
            return instituteRepository.findById(instituteId)
                    .map(Institute::getLearnerPortalBaseUrl)
                    .orElse(null);
        }
        return null;
    }

    /**
     * Extract learndash_base_url from the first package's courseSetting JSON.
     * Path: setting.LMS_SETTING.data.data.learndash_base_url
     *
     * @param packageSessionIds List of package session IDs
     * @return learndash_base_url if found, null otherwise
     */
    private String getLearndashBaseUrlFromPackage(List<String> packageSessionIds) {
        try {
            if (packageSessionIds == null || packageSessionIds.isEmpty()) {
                return null;
            }

            List<PackageSession> packageSessions = packageSessionRepository
                    .findPackageSessionsByIds(packageSessionIds);

            for (PackageSession packageSession : packageSessions) {
                if (packageSession.getPackageEntity() == null) {
                    continue;
                }

                String courseSetting = packageSession.getPackageEntity().getCourseSetting();
                if (!StringUtils.hasText(courseSetting)) {
                    continue;
                }

                JsonNode rootNode = objectMapper.readTree(courseSetting);
                JsonNode learndashBaseUrlNode = rootNode
                        .path("setting")
                        .path("LMS_SETTING")
                        .path("data")
                        .path("data")
                        .path("learndash_base_url");

                if (!learndashBaseUrlNode.isMissingNode() && learndashBaseUrlNode.isTextual()) {
                    String url = learndashBaseUrlNode.asText();
                    if (StringUtils.hasText(url)) {
                        log.info("Found learndash_base_url in package {}: {}",
                                packageSession.getPackageEntity().getId(), url);
                        return url;
                    }
                }
            }

            log.info("No learndash_base_url found in any package courseSetting");
            return null;

        } catch (Exception e) {
            log.error("Error extracting learndash_base_url from package courseSetting", e);
            return null;
        }
    }

}