package vacademy.io.admin_core_service.features.learner_management.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.learner.service.SubOrgAutoLinkService;
import vacademy.io.admin_core_service.features.common.service.CustomFieldValueService;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteStudentDTO;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteStudentDetails;
import vacademy.io.admin_core_service.features.institute_learner.dto.StudentExtraDetails;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.manager.StudentRegistrationManager;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionTypeEnum;
import vacademy.io.admin_core_service.features.institute_learner.notification.LearnerEnrollmentNotificationService;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.learner.service.LearnerService;
import vacademy.io.admin_core_service.features.fee_management.entity.AftInstallment;
import vacademy.io.admin_core_service.features.fee_management.entity.AssignedFeeValue;
import vacademy.io.admin_core_service.features.fee_management.entity.FeeType;
import vacademy.io.admin_core_service.features.fee_management.repository.AftInstallmentRepository;
import vacademy.io.admin_core_service.features.fee_management.repository.AssignedFeeValueRepository;
import vacademy.io.admin_core_service.features.fee_management.repository.FeeTypeRepository;
import vacademy.io.admin_core_service.features.fee_management.service.FeeLedgerAllocationService;
import vacademy.io.admin_core_service.features.fee_management.service.StudentFeePaymentGenerationService;
import vacademy.io.admin_core_service.features.learner_management.dto.*;
import vacademy.io.admin_core_service.features.enroll_invite.service.SubOrgService;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentOptionType;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanSourceEnum;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentLogRepository;
import vacademy.io.admin_core_service.features.user_subscription.service.UserPlanService;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.invoice.service.InvoiceService;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerExtraDetails;
import vacademy.io.common.common.dto.CustomFieldValueDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.math.BigDecimal;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Orchestrates the bulk assignment of N users × M package sessions.
 * <p>
 * For each (user, packageSession) pair:
 * 1. Resolves EnrollInvite / PaymentOption / PaymentPlan (via
 * DefaultInviteResolver)
 * 2. Checks for duplicate enrollments
 * 3. Creates UserPlan + StudentSessionInstituteGroupMapping
 * 4. Reports per-item results
 * <p>
 * Supports dry-run mode where no database writes occur.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BulkAssignmentService {

    private final DefaultInviteResolver defaultInviteResolver;
    private final UserPlanService userPlanService;
    private final StudentSessionRepository studentSessionRepository;
    private final AuthService authService;
    private final LearnerEnrollmentNotificationService learnerEnrollmentNotificationService;
    private final LearnerService learnerService;
    private final CustomFieldValueService customFieldValueService;
    private final StudentRegistrationManager studentRegistrationManager;
    private final SubOrgAutoLinkService subOrgAutoLinkService;
    private final vacademy.io.admin_core_service.features.learner.service.LearnerCouponService learnerCouponService;
    private final vacademy.io.admin_core_service.features.user_subscription.service.PaymentLogService paymentLogService;
    private final PaymentLogRepository paymentLogRepository;
    private final InvoiceService invoiceService;
    private final InstituteSettingService instituteSettingService;
    private final ObjectMapper objectMapper;
    private final InstituteRepository instituteRepository;
    private final vacademy.io.admin_core_service.features.audience.service.UserLeadProfileService userLeadProfileService;
    private final StudentFeePaymentGenerationService studentFeePaymentGenerationService;
    private final FeeLedgerAllocationService feeLedgerAllocationService;
    private final vacademy.io.admin_core_service.features.fee_management.service.CpoEnrollmentConfigApplier cpoEnrollmentConfigApplier;
    private final FeeTypeRepository feeTypeRepository;
    private final AssignedFeeValueRepository assignedFeeValueRepository;
    private final AftInstallmentRepository aftInstallmentRepository;
    private final SubOrgService subOrgService;

    @org.springframework.beans.factory.annotation.Autowired
    @org.springframework.context.annotation.Lazy
    private vacademy.io.admin_core_service.features.packages.service.PackageSessionService packageSessionService;

    private static final String DUPLICATE_SKIP = "SKIP";
    private static final String DUPLICATE_ERROR = "ERROR";
    private static final String DUPLICATE_RE_ENROLL = "RE_ENROLL";

    /**
     * Main entry point for bulk assignment.
     */
    public BulkAssignResponseDTO bulkAssign(BulkAssignRequestDTO request, String adminUserId) {
        validateRequest(request);

        BulkAssignOptionsDTO options = request.getOptions() != null
                ? request.getOptions()
                : BulkAssignOptionsDTO.builder().build();

        boolean dryRun = options.isDryRun();
        boolean notifyLearners = options.isNotifyLearners();
        String duplicateHandling = StringUtils.hasText(options.getDuplicateHandling())
                ? options.getDuplicateHandling()
                : DUPLICATE_SKIP;
        boolean sendCredentials = options.isSendCredentials();

        // 1. Create new users (if any) and collect their IDs
        Set<String> allUserIds = resolveUserIds(request);
        List<BulkAssignResultItemDTO> newUserFailures = new ArrayList<>();
        // Track userId → NewUserDTO so we can save extra details/custom fields after
        // enrollment
        Map<String, NewUserDTO> newUserDataMap = new HashMap<>();
        // Resolve learner portal URL for the credential email's "Access Your Account" link.
        // Priority: package.course_setting.LMS_SETTING.learndash_base_url → institute.learnerPortalBaseUrl → null.
        // Picks the first non-empty value across the assignments' package sessions —
        // kept in sync with the v1 path (LearnerEnrollRequestService.resolveLearnerPortalUrl).
        List<String> assignmentPackageSessionIds = request.getAssignments() == null ? List.of()
                : request.getAssignments().stream()
                        .map(AssignmentItemDTO::getPackageSessionId)
                        .filter(StringUtils::hasText)
                        .collect(Collectors.toList());
        String learndashBaseUrl = resolveLearnerPortalUrl(assignmentPackageSessionIds, request.getInstituteId());

        if (!CollectionUtils.isEmpty(request.getNewUsers()) && !dryRun) {
            for (NewUserDTO newUser : request.getNewUsers()) {
                try {
                    String createdUserId = createNewUser(newUser, request.getInstituteId(), sendCredentials, learndashBaseUrl);
                    allUserIds.add(createdUserId);
                    newUserDataMap.put(createdUserId, newUser);
                    log.info("Created new user: email={}, userId={}", newUser.getEmail(), createdUserId);
                } catch (Exception e) {
                    log.error("Failed to create new user email={}: {}", newUser.getEmail(), e.getMessage());
                    // Record failure for each assignment this user would have been part of
                    for (AssignmentItemDTO assignment : request.getAssignments()) {
                        newUserFailures.add(BulkAssignResultItemDTO.builder()
                                .userId(null)
                                .userEmail(newUser.getEmail())
                                .packageSessionId(assignment.getPackageSessionId())
                                .status("FAILED").actionTaken("NONE")
                                .message("User creation failed: " + e.getMessage())
                                .build());
                    }
                }
            }
        } else if (!CollectionUtils.isEmpty(request.getNewUsers()) && dryRun) {
            // In dry-run, report new users as "would be created". Use the list
            // index for placeholder uniqueness — for phone-identifier institutes
            // email may be blank, and several rows could otherwise collide on
            // the same "dry-run-new-null" key.
            List<NewUserDTO> newUsers = request.getNewUsers();
            for (int i = 0; i < newUsers.size(); i++) {
                allUserIds.add(dryRunPlaceholderId(i, newUsers.get(i)));
            }
        }

        if (allUserIds.isEmpty() && newUserFailures.isEmpty()) {
            throw new VacademyException("No users to assign. Provide user_ids, new_users, or user_filter.");
        }

        // 2. Fetch user details for email reporting
        Map<String, UserDTO> userMap = fetchUserDetails(allUserIds);
        // Add dry-run new user placeholders to userMap (keyed by the same id
        // built above in the dry-run branch — see dryRunPlaceholderId).
        if (dryRun && !CollectionUtils.isEmpty(request.getNewUsers())) {
            List<NewUserDTO> newUsers = request.getNewUsers();
            for (int i = 0; i < newUsers.size(); i++) {
                NewUserDTO newUser = newUsers.get(i);
                String placeholderId = dryRunPlaceholderId(i, newUser);
                userMap.put(placeholderId, UserDTO.builder()
                        .id(placeholderId)
                        .email(newUser.getEmail())
                        .fullName(newUser.getFullName())
                        .mobileNumber(newUser.getMobileNumber())
                        .build());
            }
        }
        // Populate the password field on every UserDTO in userMap by reading
        // back from auth-service. fetchUserDetails uses the bulk endpoint which
        // strips passwords; we need them on the workflow context for downstream
        // nodes (e.g. LMS provisioning HTTP_REQUEST that posts the learner to
        // WordPress / LearnDash with their actual credentials).
        //
        // Why per-user instead of generating locally:
        //   1. Brand-new users — auth-service generated their password during
        //      createUserFromAuthServiceForLearnerEnrollment(); we read it back here.
        //   2. EXISTING users (re-enrollments, or "new_users" entry that matched
        //      an already-registered email) — we MUST NOT overwrite their existing
        //      password. Reading auth-service's stored value is the only safe way
        //      to expose the real credentials to the workflow.
        //
        // Failures are tolerated per-user: a single fetch error leaves that
        // userDTO.password = null and the LMS workflow node should branch on it
        // (skip / fall back to a reset link). The workflow is not aborted.
        if (!dryRun) {
            for (Map.Entry<String, UserDTO> entry : userMap.entrySet()) {
                String uid = entry.getKey();
                UserDTO u = entry.getValue();
                if (u == null || uid == null || uid.startsWith("dry-run-")) continue;
                try {
                    UserDTO withPwd = authService.getUsersFromAuthServiceWithPasswordByUserId(uid);
                    if (withPwd != null && StringUtils.hasText(withPwd.getPassword())) {
                        u.setPassword(withPwd.getPassword());
                    }
                } catch (Exception e) {
                    log.warn("Could not fetch stored password for userId={}: {}", uid, e.getMessage());
                }
            }
        }

        // 3. Process each (user × assignment) pair
        List<BulkAssignResultItemDTO> results = new ArrayList<>(newUserFailures);
        List<InstituteStudentDTO> enrolledStudentsForNotification = new ArrayList<>();

        // Read INVOICE_SETTING.generateInvoiceOnManualEnroll once for the whole bulk op.
        // Defaults to false: institutes opt-in to receiving invoices for manual/bulk enrollments.
        boolean generateInvoiceOnManualEnroll = resolveGenerateInvoiceOnManualEnroll(request.getInstituteId());

        for (AssignmentItemDTO assignment : request.getAssignments()) {
            // Pre-resolve config for this package session (shared across all users)
            DefaultInviteResolver.ResolvedConfig config;
            try {
                config = defaultInviteResolver.resolve(assignment, request.getInstituteId(), dryRun);
            } catch (Exception e) {
                log.error("Failed to resolve config for packageSession={}: {}",
                        assignment.getPackageSessionId(), e.getMessage());
                // Fail all users for this package session
                for (String userId : allUserIds) {
                    results.add(buildFailedResult(userId, userMap,
                            assignment.getPackageSessionId(),
                            "Config resolution failed: " + e.getMessage()));
                }
                continue;
            }

            for (String userId : allUserIds) {
                BulkAssignResultItemDTO result = processAssignment(
                        userId, userMap, newUserDataMap, assignment, config,
                        request.getInstituteId(), duplicateHandling, dryRun, adminUserId, options,
                        generateInvoiceOnManualEnroll);
                results.add(result);

                // Collect successful enrollments for notification
                if (!dryRun && "SUCCESS".equals(result.getStatus())
                        && ("CREATED".equals(result.getActionTaken())
                                || "RE_ENROLLED".equals(result.getActionTaken()))) {
                    enrolledStudentsForNotification.add(
                            buildNotificationDTO(userId, userMap, result));
                }
            }
        }

        // 4. Post-process: Save learner extra details and custom fields for new users
        if (!dryRun) {
            saveNewUserExtraData(newUserDataMap, results, request);
        }

        // 5. Send notifications (async, fire-and-forget)
        if (notifyLearners && !dryRun && !enrolledStudentsForNotification.isEmpty()) {
            try {
                learnerEnrollmentNotificationService.sendLearnerEnrollmentNotification(
                        enrolledStudentsForNotification, request.getInstituteId());
                log.info("Triggered enrollment notifications for {} learners",
                        enrolledStudentsForNotification.size());
            } catch (Exception e) {
                log.error("Failed to send enrollment notifications: {}", e.getMessage());
                // Non-blocking: notification failure doesn't affect operation results
            }
        }

        // 6. Auto-mark conversion for any user that successfully enrolled and already
        // had a UserLeadProfile. Best-effort: failures must not affect the response.
        // Skipped on dry-run since no real enrollment happened.
        if (!dryRun && StringUtils.hasText(request.getInstituteId())) {
            Set<String> convertedUserIds = new HashSet<>();
            for (BulkAssignResultItemDTO r : results) {
                if ("SUCCESS".equals(r.getStatus())
                        && StringUtils.hasText(r.getUserId())
                        && convertedUserIds.add(r.getUserId())) {
                    try {
                        boolean flipped = userLeadProfileService.markConvertedIfExists(
                                r.getUserId(), request.getInstituteId());
                        if (flipped) {
                            log.info("Auto-marked lead as CONVERTED on bulk assign: userId={}, instituteId={}",
                                    r.getUserId(), request.getInstituteId());
                        }
                    } catch (Exception e) {
                        log.warn("Failed to auto-mark lead conversion for userId={}", r.getUserId(), e);
                    }
                }
            }
        }

        // 7. Build summary
        return buildResponse(dryRun, results);
    }

    // ========================= PRIVATE METHODS =========================

    /**
     * Reads INVOICE_SETTING.generateInvoiceOnManualEnroll for the institute.
     * Defaults to false when the setting, the institute, or the flag is missing.
     */
    @SuppressWarnings("unchecked")
    private boolean resolveGenerateInvoiceOnManualEnroll(String instituteId) {
        try {
            Object settingData = instituteSettingService.getSettingByInstituteIdAndKey(
                    instituteId, "INVOICE_SETTING");
            if (settingData instanceof Map) {
                Object flag = ((Map<String, Object>) settingData).get("generateInvoiceOnManualEnroll");
                return Boolean.TRUE.equals(flag);
            }
        } catch (Exception e) {
            log.warn("Failed to read INVOICE_SETTING.generateInvoiceOnManualEnroll for institute {}: {}",
                    instituteId, e.getMessage());
        }
        return false;
    }

    private void validateRequest(BulkAssignRequestDTO request) {
        if (!StringUtils.hasText(request.getInstituteId())) {
            throw new VacademyException("institute_id is required");
        }
        if (CollectionUtils.isEmpty(request.getAssignments())) {
            throw new VacademyException("assignments list cannot be empty");
        }
        for (AssignmentItemDTO item : request.getAssignments()) {
            if (!StringUtils.hasText(item.getPackageSessionId())) {
                throw new VacademyException("Each assignment must have a package_session_id");
            }
        }
    }

    private Set<String> resolveUserIds(BulkAssignRequestDTO request) {
        Set<String> userIds = new LinkedHashSet<>();

        // Explicit user IDs
        if (!CollectionUtils.isEmpty(request.getUserIds())) {
            userIds.addAll(request.getUserIds());
        }

        // Filter-based selection
        UserFilterDTO filter = request.getUserFilter();
        if (filter != null && StringUtils.hasText(filter.getSourcePackageSessionId())) {
            List<String> statuses = CollectionUtils.isEmpty(filter.getStatuses())
                    ? List.of(LearnerSessionStatusEnum.ACTIVE.name())
                    : filter.getStatuses();

            List<String> filteredIds = studentSessionRepository
                    .findDistinctUserIdsByPackageSessionAndStatus(
                            filter.getSourcePackageSessionId(), statuses);
            userIds.addAll(filteredIds);
            log.info("Filter resolved {} users from packageSession={}",
                    filteredIds.size(), filter.getSourcePackageSessionId());
        }

        return userIds;
    }

    /**
     * Creates a new user via AuthService and returns the created user's ID.
     * Maps all available profile fields (address, DOB, etc.) to UserDTO.
     * <p>
     * IMPORTANT: We deliberately do NOT generate a password here. If the
     * caller did not supply one, we send null and let auth-service decide
     * (it will generate one if needed, or short-circuit if the user already
     * exists by email — in the latter case sending a password would risk
     * overwriting the existing user's credentials). The actual password
     * for the workflow context is resolved later in bulkAssign() via a
     * read-back from auth-service.
     */
    private String createNewUser(NewUserDTO newUser, String instituteId, boolean sendCredentials, String learndashBaseUrl) {
        // Resolve the username explicitly: caller-supplied → email → null.
        // Sending null lets auth-service generate a username from full_name
        // (UsernameGenerator). Passing an empty/whitespace string would slip
        // past the auth-service's StringUtils.hasText check; passing the email
        // verbatim (which may be blank for phone-identifier institutes) is
        // confusing — be explicit instead.
        String resolvedUsername = null;
        if (StringUtils.hasText(newUser.getUsername())) {
            resolvedUsername = newUser.getUsername();
        } else if (StringUtils.hasText(newUser.getEmail())) {
            resolvedUsername = newUser.getEmail();
        }

        UserDTO.UserDTOBuilder builder = UserDTO.builder()
                .email(StringUtils.hasText(newUser.getEmail()) ? newUser.getEmail() : null)
                .fullName(newUser.getFullName())
                .mobileNumber(newUser.getMobileNumber())
                .username(resolvedUsername)
                .password(newUser.getPassword())
                .gender(newUser.getGender())
                .roles(CollectionUtils.isEmpty(newUser.getRoles())
                        ? List.of("STUDENT")
                        : newUser.getRoles());

        // Map additional profile fields (new — all optional)
        if (StringUtils.hasText(newUser.getAddressLine())) {
            builder.addressLine(newUser.getAddressLine());
        }
        if (StringUtils.hasText(newUser.getCity())) {
            builder.city(newUser.getCity());
        }
        if (StringUtils.hasText(newUser.getRegion())) {
            builder.region(newUser.getRegion());
        }
        if (StringUtils.hasText(newUser.getPinCode())) {
            builder.pinCode(newUser.getPinCode());
        }
        if (StringUtils.hasText(newUser.getDateOfBirth())) {
            try {
                SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd");
                builder.dateOfBirth(sdf.parse(newUser.getDateOfBirth()));
            } catch (Exception e) {
                log.warn("Could not parse date_of_birth='{}' for user {}: {}",
                        newUser.getDateOfBirth(), newUser.getEmail(), e.getMessage());
            }
        }

        UserDTO userDTO = builder.build();

        UserDTO created = authService.createUserFromAuthServiceForLearnerEnrollment(
                userDTO, instituteId, sendCredentials, learndashBaseUrl);

        if (created == null || !StringUtils.hasText(created.getId())) {
            throw new VacademyException("User creation returned empty result for " + describeNewUser(newUser));
        }
        return created.getId();
    }

    /**
     * Identifier-agnostic short label used in error/log messages so phone-only
     * users do not show up as "null" or empty strings.
     */
    private static String describeNewUser(NewUserDTO newUser) {
        if (newUser == null) return "<null>";
        if (StringUtils.hasText(newUser.getEmail())) return newUser.getEmail();
        if (StringUtils.hasText(newUser.getMobileNumber())) return "mobile:" + newUser.getMobileNumber();
        if (StringUtils.hasText(newUser.getFullName())) return "name:" + newUser.getFullName();
        return "<no identifier>";
    }

    /**
     * Stable, unique placeholder id for a not-yet-created new user during dry
     * run. Uses the row index so phone-only rows (which may share an empty
     * email) do not collide on the same key.
     */
    private static String dryRunPlaceholderId(int index, NewUserDTO newUser) {
        String suffix = newUser != null && StringUtils.hasText(newUser.getEmail())
                ? newUser.getEmail()
                : newUser != null && StringUtils.hasText(newUser.getMobileNumber())
                        ? newUser.getMobileNumber()
                        : "row";
        return "dry-run-new-" + index + "-" + suffix;
    }

    private Map<String, UserDTO> fetchUserDetails(Set<String> userIds) {
        try {
            List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(
                    new ArrayList<>(userIds));
            return users.stream()
                    .collect(Collectors.toMap(UserDTO::getId, u -> u, (a, b) -> a));
        } catch (Exception e) {
            log.warn("Failed to fetch user details: {}", e.getMessage());
            return Collections.emptyMap();
        }
    }

    /**
     * Process a single (user, packageSession) assignment pair.
     */
    private BulkAssignResultItemDTO processAssignment(
            String userId,
            Map<String, UserDTO> userMap,
            Map<String, NewUserDTO> newUserDataMap,
            AssignmentItemDTO assignment,
            DefaultInviteResolver.ResolvedConfig config,
            String instituteId,
            String duplicateHandling,
            boolean dryRun,
            String adminUserId,
            BulkAssignOptionsDTO options,
            boolean generateInvoiceOnManualEnroll) {

        String packageSessionId = assignment.getPackageSessionId();
        UserDTO userDTO = userMap.get(userId);
        String userEmail = userDTO != null ? userDTO.getEmail() : null;
        StudentExtraDetails extraDetails = buildStudentExtraDetails(newUserDataMap.get(userId));

        try {
            // Check for existing enrollment
            Optional<StudentSessionInstituteGroupMapping> existingMapping = studentSessionRepository
                    .findTopByPackageSessionIdAndUserIdAndStatusIn(
                            packageSessionId, instituteId, userId,
                            List.of(
                                    LearnerSessionStatusEnum.ACTIVE.name(),
                                    LearnerSessionStatusEnum.INVITED.name(),
                                    LearnerSessionStatusEnum.TERMINATED.name(),
                                    LearnerSessionStatusEnum.INACTIVE.name(),
                                    LearnerSessionStatusEnum.EXPIRED.name()));

            if (existingMapping.isPresent()) {
                StudentSessionInstituteGroupMapping mapping = existingMapping.get();
                String existingStatus = mapping.getStatus();

                // Case A: Already ACTIVE
                if (LearnerSessionStatusEnum.ACTIVE.name().equals(existingStatus)) {
                    if (DUPLICATE_ERROR.equals(duplicateHandling)) {
                        return buildFailedResult(userId, userMap, packageSessionId,
                                "Already enrolled (ACTIVE)");
                    }
                    // SKIP or RE_ENROLL both skip for ACTIVE
                    return BulkAssignResultItemDTO.builder()
                            .userId(userId).userEmail(userEmail)
                            .packageSessionId(packageSessionId)
                            .status("SKIPPED").actionTaken("NONE")
                            .message("Already enrolled (ACTIVE)")
                            .build();
                }

                // Case B: TERMINATED / INACTIVE / EXPIRED → RE_ENROLL or SKIP
                if (DUPLICATE_RE_ENROLL.equals(duplicateHandling)) {
                    return handleReEnroll(mapping, userId, userEmail, config,
                            instituteId, dryRun, userDTO, extraDetails, adminUserId, assignment);
                } else if (DUPLICATE_ERROR.equals(duplicateHandling)) {
                    return buildFailedResult(userId, userMap, packageSessionId,
                            "Existing enrollment found with status: " + existingStatus);
                } else {
                    // SKIP
                    return BulkAssignResultItemDTO.builder()
                            .userId(userId).userEmail(userEmail)
                            .packageSessionId(packageSessionId)
                            .status("SKIPPED").actionTaken("NONE")
                            .message("Existing enrollment with status: " + existingStatus)
                            .build();
                }
            }

            // Case C: No existing mapping → create new
            NewUserDTO newUserData = newUserDataMap.get(userId);
            return handleNewEnrollment(userId, userEmail, config, instituteId, dryRun, userDTO, extraDetails,
                    adminUserId, options, newUserData, generateInvoiceOnManualEnroll, assignment);

        } catch (Exception e) {
            log.error("Error processing assignment userId={}, packageSessionId={}: {}",
                    userId, packageSessionId, e.getMessage(), e);
            return buildFailedResult(userId, userMap, packageSessionId, e.getMessage());
        }
    }

    /**
     * Creates a fresh enrollment: UserPlan + Student record +
     * StudentSessionInstituteGroupMapping.
     * Now follows the same flow as manual enrollment (AdminDirectEnrollService):
     * 1. Creates UserPlan
     * 2. Creates Student record via StudentRegistrationManager
     * 3. Links student to institute via linkStudentToInstitute (applies enrollment
     * policies)
     * 4. Triggers enrollment workflow (notifications, coupon codes, etc.)
     */
    private BulkAssignResultItemDTO handleNewEnrollment(
            String userId, String userEmail,
            DefaultInviteResolver.ResolvedConfig config,
            String instituteId, boolean dryRun,
            UserDTO userDTO, StudentExtraDetails extraDetails,
            String adminUserId, BulkAssignOptionsDTO options,
            NewUserDTO newUserData,
            boolean generateInvoiceOnManualEnroll,
            AssignmentItemDTO assignment) {

        boolean isCpo = isCpoOption(config.getPaymentOption());
        CpoTemplateSummary cpoSummary = isCpo
                ? summarizeCpoFromTemplate(config.getPaymentOption().getComplexPaymentOptionId())
                : null;
        String cpoMode = isCpo ? resolveCpoMode(assignment) : null;
        Double cpoAmount = isCpo && "OFFLINE".equals(cpoMode) ? resolveCpoAmount(assignment) : null;
        CpoEnrollmentConfigDTO cpoConfig = isCpo ? assignment.getCpoConfig() : null;

        if (dryRun) {
            BulkAssignResultItemDTO.BulkAssignResultItemDTOBuilder b = BulkAssignResultItemDTO.builder()
                    .userId(userId).userEmail(userEmail)
                    .packageSessionId(config.getPackageSession().getId())
                    .status("SUCCESS").actionTaken("CREATED")
                    .enrollInviteIdUsed(config.getEnrollInvite().getId())
                    .paymentOptionType(config.getPaymentOption() != null ? config.getPaymentOption().getType() : null)
                    .message(config.isAutoCreated()
                            ? "Will create with auto-generated free invite"
                            : null);
            if (isCpo && cpoSummary != null) {
                b.cpoTotalAmount(cpoSummary.total.doubleValue())
                        .cpoInstallmentCount(cpoSummary.count)
                        .cpoInitialPaymentMode(cpoMode)
                        .cpoInitialPaymentAmount(cpoAmount);
            }
            return b.build();
        }

        // Idempotently grant the STUDENT role in auth-service. Newly-created
        // users already get it via createUserFromAuthServiceForLearnerEnrollment;
        // this covers existing users (e.g. leads from an audience-form
        // submission) whose user record predates the enrollment and would
        // otherwise fail the learner-portal login role check.
        authService.addRolesToUserInternal(userId, List.of("STUDENT"), instituteId);

        // Mark the user's lead profile as CONVERTED — assignment to a course
        // is the canonical conversion event. Best-effort: a profile-write blip
        // shouldn't roll back the enrollment that just succeeded. Default
        // listing filters on the leads endpoints will hide CONVERTED leads.
        try {
            userLeadProfileService.markConverted(userId, instituteId);
        } catch (Exception e) {
            log.warn("Failed to mark lead converted for userId={} instituteId={}: {}",
                    userId, instituteId, e.getMessage());
        }

        // Sub-org resolution for org-associated package sessions — identical to the
        // learner/v1/enroll path in LearnerBatchEnrollService.checkAndCreateStudentAndAddToBatch.
        // When the PS has is_org_associated=true:
        //   1. Mint (or fetch) the sub-org Institute from custom-field answers + invite settingJson.
        //   2. Resolve commaSeparatedOrgRoles from the same answers.
        //   3. Stamp source=SUB_ORG + subOrgId on the UserPlan (this row).
        //   4. Stamp subOrgId + commaSeparatedOrgRoles on InstituteStudentDetails so
        //      linkStudentToInstitute writes them to the SSIGM — workflows that read
        //      sub-org context from the SSIGM row will then see non-null values.
        //   5. Pass the Institute into triggerEnrollmentWorkflow so the in-memory
        //      workflow context map carries "subOrg" too.
        // Throws when the PS is org-associated but the resolution fails, surfacing as
        // a row-level FAILED in processAssignment's catch.
        SubOrgResolution subOrgResolution = maybeResolveSubOrgForOrgAssociatedPackage(
                config, newUserData, assignment, userId, instituteId);
        Institute createdSubOrg = subOrgResolution != null ? subOrgResolution.subOrg() : null;
        String createdSubOrgId = subOrgResolution != null ? subOrgResolution.id() : null;
        String subOrgRoles = subOrgResolution != null ? subOrgResolution.roles() : null;
        String userPlanSource = subOrgResolution != null
                ? UserPlanSourceEnum.SUB_ORG.name() : null;

        // Create UserPlan
        UserPlan userPlan = userPlanService.createUserPlan(
                userId,
                config.getPaymentPlan(),
                null, // no coupon discount for admin bulk
                config.getEnrollInvite(),
                config.getPaymentOption(),
                null, // no payment initiation request
                UserPlanStatusEnum.ACTIVE.name(),
                userPlanSource,
                createdSubOrgId,
                null);

        String mappingId;

        if (userDTO != null) {
            // Create Student record with extra details (same as manual flow)
            Student student = studentRegistrationManager.createStudentFromRequest(userDTO, extraDetails);

            // Use linkStudentToInstitute for proper enrollment policy handling (same as
            // manual flow). subOrgId + commaSeparatedOrgRoles are stamped onto the SSIGM
            // by linkStudentToInstitute when present — matching learner/v1/enroll.
            InstituteStudentDetails details = InstituteStudentDetails.builder()
                    .instituteId(instituteId)
                    .packageSessionId(config.getPackageSession().getId())
                    .enrollmentStatus(LearnerSessionStatusEnum.ACTIVE.name())
                    .enrollmentDate(new Date())
                    .accessDays(config.getAccessDays() != null
                            ? config.getAccessDays().toString()
                            : null)
                    .userPlanId(userPlan.getId())
                    .subOrgId(createdSubOrgId)
                    .commaSeparatedOrgRoles(subOrgRoles)
                    .build();

            mappingId = studentRegistrationManager.linkStudentToInstitute(student, details);

            // Generate USER-source coupon code so referral links carry the user's
            // own ref instead of the hardcoded "xyz" fallback (same as manual flow).
            try {
                learnerCouponService.generateCouponCodeForLearner(userId, instituteId,
                        config.getEnrollInvite() != null ? config.getEnrollInvite().getInviteCode() : null);
            } catch (Exception e) {
                log.warn("Failed to generate coupon code for userId={}: {}", userId, e.getMessage());
            }

            // Trigger enrollment workflow (same as manual flow). Pass the created sub-org
            // through so workflow nodes can branch on it (e.g. SUB_ORG_MEMBER_ENROLLMENT
            // template variants). null when the PS isn't org-associated.
            try {
                studentRegistrationManager.triggerEnrollmentWorkflow(
                        instituteId, userDTO, config.getPackageSession().getId(), createdSubOrg);
            } catch (Exception e) {
                log.warn("Failed to trigger enrollment workflow for userId={}: {}",
                        userId, e.getMessage());
            }
        } else {
            // Fallback: create mapping directly if userDTO is not available. Stamp sub-org
            // fields here too — linkStudentToInstitute (used above) reads them off
            // InstituteStudentDetails, but this branch bypasses it, so we set them directly
            // on the entity to keep parity with the userDTO path.
            StudentSessionInstituteGroupMapping mapping = createActiveMapping(
                    userId, config, instituteId, userPlan.getId());
            if (createdSubOrg != null) {
                mapping.setSubOrg(createdSubOrg);
                mapping.setCommaSeparatedOrgRoles(subOrgRoles);
            }
            mapping = studentSessionRepository.save(mapping);
            mappingId = mapping.getId();
        }

        log.info("Created enrollment: userId={}, packageSession={}, userPlan={}, mapping={}",
                userId, config.getPackageSession().getId(), userPlan.getId(), mappingId);

        // Decrement inventory (available slots) upon valid enrollment
        try {
            packageSessionService.decrementAvailability(config.getPackageSession().getId(), 1);
        } catch (Exception e) {
            log.warn("Failed to decrement inventory for admin assign packageSession {}: {}",
                    config.getPackageSession().getId(), e.getMessage());
        }

        // Auto-link learner to sub-org if the enrolling admin belongs to one
        subOrgAutoLinkService.linkIfSubOrgAdmin(userId, config.getPackageSession().getId(), mappingId, adminUserId);

        // Resolve per-user payment date: per-user (from CSV) > global (from options) > now
        Date perUserPaymentDate = parsePerUserPaymentDate(newUserData);
        Date globalPaymentDate = options != null ? options.getPaymentDate() : null;
        String transactionId = options != null ? options.getTransactionId() : null;

        // CPO post-enrollment side effects: always generate the installment schedule;
        // apply per-learner overrides + CPO discount if supplied; optionally record
        // an admin-collected offline payment that FIFOs against the resulting rows.
        if (isCpo) {
            applyCpoEnrollmentSideEffects(
                    userId, instituteId, userPlan, config, cpoMode, cpoAmount, cpoConfig, adminUserId,
                    perUserPaymentDate, globalPaymentDate, transactionId,
                    generateInvoiceOnManualEnroll);
        }

        // Create payment log if any payment date or transaction ID is provided.
        // Skipped for CPO since applyCpoEnrollmentSideEffects already owns the PaymentLog
        // (and uses the partial amount the admin specified instead of the full plan price).
        String paymentMode = options != null ? options.getPaymentMode() : null;
        Double overrideAmount = options != null ? options.getPaymentAmount() : null;
        if (!isCpo && (perUserPaymentDate != null || globalPaymentDate != null
                || StringUtils.hasText(transactionId) || StringUtils.hasText(paymentMode) || overrideAmount != null)) {
            try {
                // Admin-recorded amount wins; otherwise fall back to the plan's actual price.
                Double amount = overrideAmount != null ? overrideAmount
                        : (config.getPaymentPlan() != null ? config.getPaymentPlan().getActualPrice() : 0.0);
                String currency = config.getPaymentPlan() != null ? config.getPaymentPlan().getCurrency()
                        : (config.getEnrollInvite().getCurrency() != null ? config.getEnrollInvite().getCurrency() : "INR");
                Date paymentDate = perUserPaymentDate != null ? perUserPaymentDate
                        : (globalPaymentDate != null ? globalPaymentDate : new Date());

                String paymentLogId = paymentLogService.createPaymentLog(
                        userId,
                        amount != null ? amount : 0.0,
                        vacademy.io.common.payment.enums.PaymentGateway.MANUAL.name(),
                        vacademy.io.common.payment.enums.PaymentGateway.MANUAL.name(),
                        currency,
                        userPlan,
                        null,
                        paymentDate,
                        paymentMode);

                Map<String, Object> paymentSpecificData = new HashMap<>();
                if (StringUtils.hasText(transactionId)) {
                    paymentSpecificData.put("transaction_id", transactionId);
                }
                paymentSpecificData.put("source", "BULK_ASSIGN");

                // Use updatePaymentLogOnly to avoid triggering the sync payment-gateway post-payment
                // logic (abandoned-cart cleanup). Invoice generation is handled explicitly below.
                paymentLogService.updatePaymentLogOnly(
                        paymentLogId,
                        vacademy.io.admin_core_service.features.user_subscription.enums.PaymentLogStatusEnum.SUCCESS.name(),
                        vacademy.io.common.payment.enums.PaymentStatusEnum.PAID.name(),
                        vacademy.io.admin_core_service.features.common.util.JsonUtil.toJson(paymentSpecificData));

                // Generate invoice only when the institute opted in via
                // INVOICE_SETTING.generateInvoiceOnManualEnroll AND the payment is not FREE.
                // FREE paths (rent/membership, school enrollment) never generate an invoice.
                // INVOICE_SETTING.sendInvoiceEmail is honored inside generateInvoice for the email step.
                String paymentType = config.getPaymentOption() != null ? config.getPaymentOption().getType() : null;
                if (generateInvoiceOnManualEnroll
                        && StringUtils.hasText(paymentType)
                        && !PaymentOptionType.FREE.name().equalsIgnoreCase(paymentType)) {
                    try {
                        PaymentLog persistedLog = paymentLogRepository.findById(paymentLogId)
                                .orElseThrow(() -> new RuntimeException(
                                        "Payment log not found: " + paymentLogId));
                        invoiceService.generateInvoice(userPlan, persistedLog, instituteId);
                    } catch (Exception e) {
                        log.warn("Failed to generate invoice for userId={}, paymentLogId={}: {}",
                                userId, paymentLogId, e.getMessage());
                    }
                }
            } catch (Exception e) {
                log.warn("Failed to create payment log for userId={}: {}", userId, e.getMessage());
            }
        }

        BulkAssignResultItemDTO.BulkAssignResultItemDTOBuilder resultBuilder = BulkAssignResultItemDTO.builder()
                .userId(userId).userEmail(userEmail)
                .packageSessionId(config.getPackageSession().getId())
                .status("SUCCESS").actionTaken("CREATED")
                .mappingId(mappingId)
                .userPlanId(userPlan.getId())
                .enrollInviteIdUsed(config.getEnrollInvite().getId())
                .paymentOptionType(config.getPaymentOption() != null ? config.getPaymentOption().getType() : null);
        if (isCpo && cpoSummary != null) {
            resultBuilder
                    .cpoTotalAmount(cpoSummary.total.doubleValue())
                    .cpoInstallmentCount(cpoSummary.count)
                    .cpoInitialPaymentMode(cpoMode)
                    .cpoInitialPaymentAmount(cpoAmount);
        }
        return resultBuilder.build();
    }

    /**
     * Re-enrolls a previously TERMINATED/INACTIVE user.
     * Now also ensures Student record exists and triggers enrollment workflow
     * (same as manual flow).
     */
    private BulkAssignResultItemDTO handleReEnroll(
            StudentSessionInstituteGroupMapping existingMapping,
            String userId, String userEmail,
            DefaultInviteResolver.ResolvedConfig config,
            String instituteId, boolean dryRun,
            UserDTO userDTO, StudentExtraDetails extraDetails,
            String adminUserId,
            AssignmentItemDTO assignment) {

        boolean isCpo = isCpoOption(config.getPaymentOption());
        CpoTemplateSummary cpoSummary = isCpo
                ? summarizeCpoFromTemplate(config.getPaymentOption().getComplexPaymentOptionId())
                : null;
        String cpoMode = isCpo ? resolveCpoMode(assignment) : null;
        Double cpoAmount = isCpo && "OFFLINE".equals(cpoMode) ? resolveCpoAmount(assignment) : null;
        CpoEnrollmentConfigDTO cpoConfig = isCpo ? assignment.getCpoConfig() : null;

        if (dryRun) {
            BulkAssignResultItemDTO.BulkAssignResultItemDTOBuilder b = BulkAssignResultItemDTO.builder()
                    .userId(userId).userEmail(userEmail)
                    .packageSessionId(config.getPackageSession().getId())
                    .status("SUCCESS").actionTaken("RE_ENROLLED")
                    .enrollInviteIdUsed(config.getEnrollInvite().getId())
                    .paymentOptionType(config.getPaymentOption() != null ? config.getPaymentOption().getType() : null)
                    .message("Will re-enroll from " + existingMapping.getStatus() + " status");
            if (isCpo && cpoSummary != null) {
                b.cpoTotalAmount(cpoSummary.total.doubleValue())
                        .cpoInstallmentCount(cpoSummary.count)
                        .cpoInitialPaymentMode(cpoMode)
                        .cpoInitialPaymentAmount(cpoAmount);
            }
            return b.build();
        }

        // Idempotently grant the STUDENT role in auth-service before reactivating
        // the mapping — re-enrollment paths cover users whose role row may have
        // been removed at deletion time, plus migrated leads who never had it.
        authService.addRolesToUserInternal(userId, List.of("STUDENT"), instituteId);

        // Re-enrollment is also a conversion event — flip the lead profile to
        // CONVERTED so this user falls out of the active leads list. Best-effort.
        try {
            userLeadProfileService.markConverted(userId, instituteId);
        } catch (Exception e) {
            log.warn("Failed to mark lead converted (re-enroll) for userId={} instituteId={}: {}",
                    userId, instituteId, e.getMessage());
        }

        // Sub-org resolution for org-associated PS — same contract as handleNewEnrollment.
        // Custom-field values come from the assignment row only (re-enrollment doesn't
        // carry a NewUserDTO).
        SubOrgResolution subOrgResolution = maybeResolveSubOrgForOrgAssociatedPackage(
                config, null, assignment, userId, instituteId);
        Institute createdSubOrg = subOrgResolution != null ? subOrgResolution.subOrg() : null;
        String createdSubOrgId = subOrgResolution != null ? subOrgResolution.id() : null;
        String subOrgRoles = subOrgResolution != null ? subOrgResolution.roles() : null;
        String userPlanSource = subOrgResolution != null
                ? UserPlanSourceEnum.SUB_ORG.name() : null;

        // Create new UserPlan (stacking is handled automatically by UserPlanService)
        UserPlan userPlan = userPlanService.createUserPlan(
                userId,
                config.getPaymentPlan(),
                null,
                config.getEnrollInvite(),
                config.getPaymentOption(),
                null,
                UserPlanStatusEnum.ACTIVE.name(),
                userPlanSource,
                createdSubOrgId,
                null);

        // Ensure Student record exists with extra details (same as manual flow)
        if (userDTO != null) {
            studentRegistrationManager.createStudentFromRequest(userDTO, extraDetails);
        }

        // Restore mapping status
        existingMapping.setStatus(LearnerSessionStatusEnum.ACTIVE.name());
        existingMapping.setEnrolledDate(new Date());
        existingMapping.setUserPlanId(userPlan.getId());

        // Re-enrollment into an org-associated PS: overwrite the SSIGM's sub_org + roles
        // with the freshly-resolved values from this enrollment's custom-field answers.
        // This matches the learner-side semantics (LearnerBatchEnrollService re-runs
        // createOrGetSubOrg on every enrollment and stamps it onto the SSIGM); admins
        // may have changed the answers between the previous and current enrollment, so
        // honouring the current values is the expected behaviour.
        if (createdSubOrg != null) {
            existingMapping.setSubOrg(createdSubOrg);
            existingMapping.setCommaSeparatedOrgRoles(subOrgRoles);
        }

        if (config.getAccessDays() != null) {
            long expiryMillis = System.currentTimeMillis()
                    + (long) config.getAccessDays() * 24L * 60L * 60L * 1000L;
            existingMapping.setExpiryDate(new Date(expiryMillis));
        }

        studentSessionRepository.save(existingMapping);

        // Trigger enrollment workflow (same as manual flow). Pass the resolved sub-org
        // through for workflow node access; null when the PS isn't org-associated.
        if (userDTO != null) {
            try {
                studentRegistrationManager.triggerEnrollmentWorkflow(
                        instituteId, userDTO, config.getPackageSession().getId(), createdSubOrg);
            } catch (Exception e) {
                log.warn("Failed to trigger enrollment workflow for re-enrollment userId={}: {}",
                        userId, e.getMessage());
            }
        }

        log.info("Re-enrolled: userId={}, packageSession={}, userPlan={}, mapping={}",
                userId, config.getPackageSession().getId(),
                userPlan.getId(), existingMapping.getId());

        // Auto-link learner to sub-org if the enrolling admin belongs to one
        subOrgAutoLinkService.linkIfSubOrgAdmin(userId, config.getPackageSession().getId(), existingMapping.getId(), adminUserId);

        // CPO re-enrollment: regenerate the installment schedule for the fresh UserPlan,
        // apply per-learner overrides if supplied, and optionally record the admin's
        // offline payment against the resulting rows.
        if (isCpo) {
            applyCpoEnrollmentSideEffects(
                    userId, instituteId, userPlan, config, cpoMode, cpoAmount, cpoConfig, adminUserId,
                    null, null, null,
                    false);
        }

        BulkAssignResultItemDTO.BulkAssignResultItemDTOBuilder resultBuilder = BulkAssignResultItemDTO.builder()
                .userId(userId).userEmail(userEmail)
                .packageSessionId(config.getPackageSession().getId())
                .status("SUCCESS").actionTaken("RE_ENROLLED")
                .mappingId(existingMapping.getId())
                .userPlanId(userPlan.getId())
                .enrollInviteIdUsed(config.getEnrollInvite().getId())
                .paymentOptionType(config.getPaymentOption() != null ? config.getPaymentOption().getType() : null)
                .message("Re-enrolled from " + existingMapping.getStatus() + " status");
        if (isCpo && cpoSummary != null) {
            resultBuilder
                    .cpoTotalAmount(cpoSummary.total.doubleValue())
                    .cpoInstallmentCount(cpoSummary.count)
                    .cpoInitialPaymentMode(cpoMode)
                    .cpoInitialPaymentAmount(cpoAmount);
        }
        return resultBuilder.build();
    }

    /**
     * Identical to LearnerBatchEnrollService.checkAndCreateStudentAndAddToBatch's
     * sub-org branch: when the PS is org-associated, mint a sub-org Institute via
     * {@code subOrgService.createOrGetSubOrg(...)} and derive its admin roles via
     * {@code subOrgService.getRoles(...)} from the invite's settingJson. Throws
     * {@link VacademyException} when the PS is org-associated but the resolution
     * fails — exactly mirroring the learner-side contract so the per-(user, PS)
     * failure surfaces as a row-level "FAILED" in the bulk response instead of
     * silently producing a half-stamped SSIGM.
     * <p>
     * Custom-field values are merged the same way as the post-process step:
     * user-level (NewUserDTO) overridden by assignment-level (AssignmentItemDTO).
     * Re-enrollments pass a null NewUserDTO and rely on assignment-level fields only.
     * Returns null when the PS isn't org-associated (the common case).
     */
    private SubOrgResolution maybeResolveSubOrgForOrgAssociatedPackage(
            DefaultInviteResolver.ResolvedConfig config,
            NewUserDTO newUserData,
            AssignmentItemDTO assignment,
            String userId,
            String instituteId) {
        PackageSession packageSession = config.getPackageSession();
        if (packageSession == null || !Boolean.TRUE.equals(packageSession.getIsOrgAssociated())) {
            return null;
        }
        List<CustomFieldValueDTO> customFieldValues = mergeCustomFields(
                newUserData != null ? newUserData.getCustomFieldValues() : null,
                assignment != null ? assignment.getCustomFieldValues() : null);
        String settingJson = config.getEnrollInvite() != null
                ? config.getEnrollInvite().getSettingJson() : null;
        Institute subOrg = subOrgService.createOrGetSubOrg(
                customFieldValues, settingJson, userId, packageSession.getId(), instituteId);
        String roles = subOrgService.getRoles(customFieldValues, settingJson);
        if (subOrg == null || !StringUtils.hasText(roles)) {
            throw new VacademyException("Sub Org can not be created. Data not passed!!!");
        }
        log.info("Resolved sub-org id={} roles={} for userId={} packageSession={}",
                subOrg.getId(), roles, userId, packageSession.getId());
        return new SubOrgResolution(subOrg, roles);
    }

    /**
     * (Institute, commaSeparatedOrgRoles) pair from a successful sub-org resolution.
     * Identical shape to what LearnerBatchEnrollService stamps onto the SSIGM via
     * InstituteStudentDetails (.subOrgId + .commaSeparatedOrgRoles).
     */
    private record SubOrgResolution(Institute subOrg, String roles) {
        String id() {
            return subOrg.getId();
        }
    }

    /**
     * Parses the per-user payment_date string from NewUserDTO.
     * Supports ISO format (yyyy-MM-dd) and common formats (dd/MM/yyyy, dd-MM-yyyy).
     */
    private Date parsePerUserPaymentDate(NewUserDTO newUserData) {
        if (newUserData == null || !StringUtils.hasText(newUserData.getPaymentDate())) {
            return null;
        }
        String dateStr = newUserData.getPaymentDate().trim();
        String[] formats = {"yyyy-MM-dd", "dd/MM/yyyy", "dd-MM-yyyy"};
        for (String format : formats) {
            try {
                SimpleDateFormat sdf = new SimpleDateFormat(format);
                sdf.setLenient(false);
                return sdf.parse(dateStr);
            } catch (Exception ignored) {
            }
        }
        log.warn("Could not parse payment_date='{}' for user email={}", dateStr,
                newUserData.getEmail());
        return null;
    }

    private StudentSessionInstituteGroupMapping createActiveMapping(
            String userId,
            DefaultInviteResolver.ResolvedConfig config,
            String instituteId,
            String userPlanId) {

        // Find an existing mapping in this institute to copy group/enrollment number
        Optional<StudentSessionInstituteGroupMapping> existingInInstitute = studentSessionRepository
                .findByInstituteIdAndUserIdNative(instituteId, userId);

        StudentSessionInstituteGroupMapping mapping = new StudentSessionInstituteGroupMapping();
        mapping.setUserId(userId);
        mapping.setPackageSession(config.getPackageSession());
        mapping.setDestinationPackageSession(config.getPackageSession());
        mapping.setStatus(LearnerSessionStatusEnum.ACTIVE.name());
        mapping.setEnrolledDate(new Date());
        mapping.setUserPlanId(userPlanId);
        mapping.setType(LearnerSessionTypeEnum.PACKAGE_SESSION.name());
        mapping.setSource("BULK_ASSIGN");

        // Copy institute reference and group from existing mapping if available
        if (existingInInstitute.isPresent()) {
            StudentSessionInstituteGroupMapping ref = existingInInstitute.get();
            mapping.setInstitute(ref.getInstitute());
            mapping.setGroup(ref.getGroup());
            mapping.setInstituteEnrolledNumber(ref.getInstituteEnrolledNumber());
        } else {
            // Minimal: set institute by ID
            Institute inst = new Institute();
            inst.setId(instituteId);
            mapping.setInstitute(inst);
        }

        // Set expiry date
        if (config.getAccessDays() != null) {
            long expiryMillis = System.currentTimeMillis()
                    + (long) config.getAccessDays() * 24L * 60L * 60L * 1000L;
            mapping.setExpiryDate(new Date(expiryMillis));
        }

        return mapping;
    }

    private BulkAssignResultItemDTO buildFailedResult(
            String userId, Map<String, UserDTO> userMap,
            String packageSessionId, String message) {
        return BulkAssignResultItemDTO.builder()
                .userId(userId)
                .userEmail(userMap.containsKey(userId)
                        ? userMap.get(userId).getEmail()
                        : null)
                .packageSessionId(packageSessionId)
                .status("FAILED").actionTaken("NONE")
                .message(message)
                .build();
    }

    /**
     * Builds the InstituteStudentDTO required by
     * LearnerEnrollmentNotificationService.
     */
    private InstituteStudentDTO buildNotificationDTO(
            String userId, Map<String, UserDTO> userMap,
            BulkAssignResultItemDTO result) {
        InstituteStudentDTO dto = new InstituteStudentDTO();
        dto.setUserDetails(userMap.getOrDefault(userId, UserDTO.builder().id(userId).build()));
        dto.setInstituteStudentDetails(
                InstituteStudentDetails.builder()
                        .packageSessionId(result.getPackageSessionId())
                        .userPlanId(result.getUserPlanId())
                        .enrollmentId(result.getMappingId())
                        .enrollmentStatus(LearnerSessionStatusEnum.ACTIVE.name())
                        .build());
        return dto;
    }

    private BulkAssignResponseDTO buildResponse(boolean dryRun,
            List<BulkAssignResultItemDTO> results) {
        int successful = 0, failed = 0, skipped = 0, reEnrolled = 0;
        for (BulkAssignResultItemDTO r : results) {
            switch (r.getStatus()) {
                case "SUCCESS" -> {
                    if ("RE_ENROLLED".equals(r.getActionTaken())) {
                        reEnrolled++;
                    }
                    successful++;
                }
                case "FAILED" -> failed++;
                case "SKIPPED" -> skipped++;
            }
        }

        return BulkAssignResponseDTO.builder()
                .dryRun(dryRun)
                .summary(BulkAssignResponseDTO.SummaryDTO.builder()
                        .totalRequested(results.size())
                        .successful(successful)
                        .failed(failed)
                        .skipped(skipped)
                        .reEnrolled(reEnrolled)
                        .build())
                .results(results)
                .build();
    }

    // ========================= EXTRA DATA POST-PROCESSING
    // =========================

    /**
     * After all enrollments are processed, saves learner extra details
     * (parent/guardian info)
     * and custom field values for new users. This is done as a post-processing step
     * so that
     * the main enrollment loop remains unchanged.
     * <p>
     * - Learner extra details are saved once per user (not per mapping).
     * - Custom fields are merged: user-level (from NewUserDTO) + assignment-level
     * (from AssignmentItemDTO), with assignment-level taking precedence.
     */
    private void saveNewUserExtraData(
            Map<String, NewUserDTO> newUserDataMap,
            List<BulkAssignResultItemDTO> results,
            BulkAssignRequestDTO request) {

        if (newUserDataMap.isEmpty() && !hasAnyAssignmentCustomFields(request)) {
            return; // Nothing to post-process
        }

        // Build a quick lookup: packageSessionId → assignment-level custom fields
        Map<String, List<CustomFieldValueDTO>> assignmentCustomFieldsMap = new HashMap<>();
        if (!CollectionUtils.isEmpty(request.getAssignments())) {
            for (AssignmentItemDTO assignment : request.getAssignments()) {
                if (!CollectionUtils.isEmpty(assignment.getCustomFieldValues())) {
                    assignmentCustomFieldsMap.put(
                            assignment.getPackageSessionId(),
                            assignment.getCustomFieldValues());
                }
            }
        }

        // Track which users we've already saved extra details for (once per user)
        Set<String> extraDetailsSavedForUsers = new HashSet<>();

        for (BulkAssignResultItemDTO result : results) {
            if (!"SUCCESS".equals(result.getStatus()))
                continue;

            String userId = result.getUserId();
            String mappingId = result.getMappingId();
            if (!StringUtils.hasText(mappingId))
                continue;

            // Save learner extra details (once per user, for new users only)
            NewUserDTO newUserData = (userId != null) ? newUserDataMap.get(userId) : null;
            if (newUserData != null && !extraDetailsSavedForUsers.contains(userId)) {
                saveLearnerExtraDetails(newUserData, userId);
                extraDetailsSavedForUsers.add(userId);
            }

            // Save custom fields: merge user-level + assignment-level
            List<CustomFieldValueDTO> userCustomFields = (newUserData != null) ? newUserData.getCustomFieldValues()
                    : null;
            List<CustomFieldValueDTO> assignmentCustomFields = assignmentCustomFieldsMap
                    .get(result.getPackageSessionId());

            List<CustomFieldValueDTO> merged = mergeCustomFields(userCustomFields, assignmentCustomFields);
            if (!merged.isEmpty()) {
                try {
                    customFieldValueService.addCustomFieldValue(
                            merged, "STUDENT_SESSION_MAPPING", mappingId);
                    log.debug("Saved {} custom field values for mapping={}",
                            merged.size(), mappingId);
                } catch (Exception e) {
                    log.warn("Failed to save custom field values for mapping={}: {}",
                            mappingId, e.getMessage());
                    // Non-blocking: custom field save failure doesn't fail the enrollment
                }
            }
        }
    }

    /**
     * Saves learner extra details (parent/guardian info, college name) for a new
     * user.
     * Uses LearnerService.updateLearnerExtraDetails which handles create/update.
     */
    private void saveLearnerExtraDetails(NewUserDTO newUser, String userId) {
        boolean hasExtraDetails = StringUtils.hasText(newUser.getFathersName()) ||
                StringUtils.hasText(newUser.getMothersName()) ||
                StringUtils.hasText(newUser.getParentsMobileNumber()) ||
                StringUtils.hasText(newUser.getParentsEmail()) ||
                StringUtils.hasText(newUser.getParentsToMotherMobileNumber()) ||
                StringUtils.hasText(newUser.getParentsToMotherEmail()) ||
                StringUtils.hasText(newUser.getLinkedInstituteName());

        if (!hasExtraDetails)
            return;

        try {
            LearnerExtraDetails extraDetails = new LearnerExtraDetails();
            extraDetails.setFathersName(newUser.getFathersName());
            extraDetails.setMothersName(newUser.getMothersName());
            extraDetails.setParentsMobileNumber(newUser.getParentsMobileNumber());
            extraDetails.setParentsEmail(newUser.getParentsEmail());
            extraDetails.setParentsToMotherMobileNumber(newUser.getParentsToMotherMobileNumber());
            extraDetails.setParentsToMotherEmail(newUser.getParentsToMotherEmail());
            extraDetails.setLinkedInstituteName(newUser.getLinkedInstituteName());

            learnerService.updateLearnerExtraDetails(extraDetails, userId);
            log.debug("Saved learner extra details for userId={}", userId);
        } catch (Exception e) {
            log.warn("Failed to save learner extra details for userId={}: {}",
                    userId, e.getMessage());
            // Non-blocking: extra details save failure doesn't fail the enrollment
        }
    }

    /**
     * Merges user-level and assignment-level custom field values.
     * Assignment-level values take precedence for duplicate custom_field_ids.
     */
    private List<CustomFieldValueDTO> mergeCustomFields(
            List<CustomFieldValueDTO> userLevel,
            List<CustomFieldValueDTO> assignmentLevel) {

        if (CollectionUtils.isEmpty(userLevel) && CollectionUtils.isEmpty(assignmentLevel)) {
            return Collections.emptyList();
        }

        // Start with user-level, then override with assignment-level
        Map<String, CustomFieldValueDTO> merged = new LinkedHashMap<>();

        if (!CollectionUtils.isEmpty(userLevel)) {
            for (CustomFieldValueDTO dto : userLevel) {
                if (dto != null && StringUtils.hasText(dto.getCustomFieldId())) {
                    merged.put(dto.getCustomFieldId(), dto);
                }
            }
        }
        if (!CollectionUtils.isEmpty(assignmentLevel)) {
            for (CustomFieldValueDTO dto : assignmentLevel) {
                if (dto != null && StringUtils.hasText(dto.getCustomFieldId())) {
                    merged.put(dto.getCustomFieldId(), dto); // overrides user-level
                }
            }
        }

        return new ArrayList<>(merged.values());
    }

    /**
     * Builds StudentExtraDetails from NewUserDTO for parent/guardian info.
     * Returns null if no NewUserDTO is available (existing user, not a new user).
     */
    private StudentExtraDetails buildStudentExtraDetails(NewUserDTO newUser) {
        if (newUser == null) {
            return null;
        }
        boolean hasExtraDetails = StringUtils.hasText(newUser.getFathersName()) ||
                StringUtils.hasText(newUser.getMothersName()) ||
                StringUtils.hasText(newUser.getParentsMobileNumber()) ||
                StringUtils.hasText(newUser.getParentsEmail()) ||
                StringUtils.hasText(newUser.getParentsToMotherMobileNumber()) ||
                StringUtils.hasText(newUser.getParentsToMotherEmail()) ||
                StringUtils.hasText(newUser.getLinkedInstituteName());
        if (!hasExtraDetails) {
            return null;
        }
        StudentExtraDetails details = new StudentExtraDetails();
        details.setFathersName(newUser.getFathersName());
        details.setMothersName(newUser.getMothersName());
        details.setParentsMobileNumber(newUser.getParentsMobileNumber());
        details.setParentsEmail(newUser.getParentsEmail());
        details.setParentsToMotherMobileNumber(newUser.getParentsToMotherMobileNumber());
        details.setParentsToMotherEmail(newUser.getParentsToMotherEmail());
        details.setLinkedInstituteName(newUser.getLinkedInstituteName());
        return details;
    }

    /**
     * Resolves the learner portal URL for the credential email's "Access Your Account" link.
     * Priority: package.course_setting.LMS_SETTING.learndash_base_url → institute.learnerPortalBaseUrl → null.
     * Mirrors the same priority chain used on the v1 path
     * (LearnerEnrollRequestService.resolveLearnerPortalUrl) — keep them in sync.
     */
    private String resolveLearnerPortalUrl(List<String> packageSessionIds, String instituteId) {
        try {
            if (!CollectionUtils.isEmpty(packageSessionIds)) {
                List<PackageSession> packageSessions = packageSessionService.findAllByIds(packageSessionIds);
                for (PackageSession packageSession : packageSessions) {
                    if (packageSession.getPackageEntity() == null) {
                        continue;
                    }
                    String courseSetting = packageSession.getPackageEntity().getCourseSetting();
                    if (!StringUtils.hasText(courseSetting)) {
                        continue;
                    }
                    JsonNode urlNode = objectMapper.readTree(courseSetting)
                            .path("setting")
                            .path("LMS_SETTING")
                            .path("data")
                            .path("data")
                            .path("learndash_base_url");
                    if (!urlNode.isMissingNode() && urlNode.isTextual()) {
                        String url = urlNode.asText();
                        if (StringUtils.hasText(url)) {
                            return url;
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Error reading learndash_base_url from package courseSetting; falling back to institute URL", e);
        }
        if (StringUtils.hasText(instituteId)) {
            return instituteRepository.findById(instituteId)
                    .map(Institute::getLearnerPortalBaseUrl)
                    .orElse(null);
        }
        return null;
    }

    private boolean hasAnyAssignmentCustomFields(BulkAssignRequestDTO request) {
        if (CollectionUtils.isEmpty(request.getAssignments()))
            return false;
        return request.getAssignments().stream()
                .anyMatch(a -> !CollectionUtils.isEmpty(a.getCustomFieldValues()));
    }

    // ========================= CPO SUPPORT =========================

    private static boolean isCpoOption(vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption po) {
        return po != null
                && po.getType() != null
                && PaymentOptionType.CPO.name().equalsIgnoreCase(po.getType());
    }

    /**
     * "OFFLINE" if an offline payment is being recorded; "SKIP" otherwise.
     * cpoConfig (when present) supersedes the legacy cpoPaymentMode/Amount fields.
     */
    private static String resolveCpoMode(AssignmentItemDTO assignment) {
        if (assignment == null) return "SKIP";
        String mode;
        Double amount;
        if (assignment.getCpoConfig() != null) {
            mode = assignment.getCpoConfig().getPaymentMode();
            amount = assignment.getCpoConfig().getPaymentAmount();
        } else {
            mode = assignment.getCpoPaymentMode();
            amount = assignment.getCpoPaymentAmount();
        }
        if ("OFFLINE".equalsIgnoreCase(mode) && amount != null && amount > 0.0) {
            return "OFFLINE";
        }
        return "SKIP";
    }

    /** Resolves the offline-payment amount, preferring cpoConfig over the legacy field. */
    private static Double resolveCpoAmount(AssignmentItemDTO assignment) {
        if (assignment == null) return null;
        if (assignment.getCpoConfig() != null && assignment.getCpoConfig().getPaymentAmount() != null) {
            return assignment.getCpoConfig().getPaymentAmount();
        }
        return assignment.getCpoPaymentAmount();
    }

    /** Total contract value + installment count, read from the CPO template (not from SFP rows). */
    private CpoTemplateSummary summarizeCpoFromTemplate(String cpoId) {
        if (!StringUtils.hasText(cpoId)) return CpoTemplateSummary.empty();
        try {
            BigDecimal total = BigDecimal.ZERO;
            int count = 0;
            List<FeeType> feeTypes = feeTypeRepository.findByCpoId(cpoId);
            for (FeeType ft : feeTypes) {
                List<AssignedFeeValue> afvs = assignedFeeValueRepository.findByFeeTypeId(ft.getId());
                for (AssignedFeeValue afv : afvs) {
                    List<AftInstallment> installments = aftInstallmentRepository
                            .findByAssignedFeeValueIdOrderByInstallmentNumberAsc(afv.getId());
                    if (installments.isEmpty()) {
                        // Single-bill CPO (no installments configured) — count the AFV as one row.
                        BigDecimal amount = afv.getAmount() != null ? afv.getAmount() : BigDecimal.ZERO;
                        total = total.add(amount);
                        count += 1;
                    } else {
                        for (AftInstallment inst : installments) {
                            BigDecimal amount = inst.getAmount() != null ? inst.getAmount() : BigDecimal.ZERO;
                            total = total.add(amount);
                            count += 1;
                        }
                    }
                }
            }
            return new CpoTemplateSummary(total, count);
        } catch (Exception e) {
            log.warn("Failed to summarize CPO {}: {}", cpoId, e.getMessage());
            return CpoTemplateSummary.empty();
        }
    }

    /**
     * For a freshly-created CPO UserPlan, generates the StudentFeePayment installment
     * rows and optionally records an admin-collected offline payment that FIFO-allocates
     * against those rows.
     *
     * <p>Mirrors the SFP generation that
     * {@link vacademy.io.admin_core_service.features.learner_payment_option_operation.service.ComplexPaymentOptionOperation}
     * runs for the learner-driven enrollment path. Because BulkAssignmentService creates
     * the UserPlan directly (bypassing the strategy), we have to invoke this generator
     * explicitly — otherwise the learner-facing "my dues" / "pay-installments" flow has
     * no rows to surface.
     */
    private void applyCpoEnrollmentSideEffects(
            String userId, String instituteId, UserPlan userPlan,
            DefaultInviteResolver.ResolvedConfig config,
            String cpoMode, Double cpoAmount,
            CpoEnrollmentConfigDTO cpoConfig, String adminUserId,
            Date perUserPaymentDate, Date globalPaymentDate, String transactionId,
            boolean generateInvoiceOnManualEnroll) {

        String cpoId = config.getPaymentOption().getComplexPaymentOptionId();
        if (!StringUtils.hasText(cpoId)) {
            log.error("CPO mirror PaymentOption {} has null complexPaymentOptionId — sync bug? Skipping SFP generation.",
                    config.getPaymentOption().getId());
            return;
        }

        // 1. Always generate the installment schedule. Without this the learner can't
        //    see their dues and the FeeLedger has nothing to allocate against.
        try {
            studentFeePaymentGenerationService.generateFeeBills(
                    userPlan.getId(), cpoId, userId, instituteId);
        } catch (Exception e) {
            log.error("Failed to generate fee bills (bulk-assign) for userPlan={}, cpo={}: {}",
                    userPlan.getId(), cpoId, e.getMessage(), e);
            throw new VacademyException("Failed to generate fee bills: " + e.getMessage());
        }

        // 1b. Apply per-learner installment overrides and CPO-level discount BEFORE
        //     allocating any offline payment. Discount math must finalize first so
        //     FIFO targets the post-discount net amounts, not the template gross.
        if (cpoConfig != null) {
            try {
                cpoEnrollmentConfigApplier.apply(userPlan.getId(), cpoConfig, adminUserId);
            } catch (Exception e) {
                log.error("Failed to apply cpoConfig for userPlan={}: {}", userPlan.getId(), e.getMessage(), e);
                throw new VacademyException("Failed to apply CPO configuration: " + e.getMessage());
            }
        }

        // 2. Optionally record an offline payment.
        if (!"OFFLINE".equals(cpoMode) || cpoAmount == null || cpoAmount <= 0.0) {
            return;
        }

        BigDecimal amount = BigDecimal.valueOf(cpoAmount);
        // Bounds check intentionally omitted for now (admin may record more/less than the
        // generated outstanding). FeeLedgerAllocationService FIFO-allocates whatever fits;
        // any remainder is stashed on PaymentLog.unallocatedAmount.

        // 3. Create a PaymentLog (PAID/MANUAL) linked to this UserPlan, then FIFO-allocate
        //    via FeeLedgerAllocationService.allocatePaymentForNewLog (same engine the
        //    learner pay-installments + admin allocate paths use).
        try {
            Date paymentDate = perUserPaymentDate != null ? perUserPaymentDate
                    : (globalPaymentDate != null ? globalPaymentDate : new Date());
            String currency = config.getPaymentPlan() != null && config.getPaymentPlan().getCurrency() != null
                    ? config.getPaymentPlan().getCurrency()
                    : (config.getEnrollInvite() != null && config.getEnrollInvite().getCurrency() != null
                            ? config.getEnrollInvite().getCurrency()
                            : "INR");

            String paymentLogId = paymentLogService.createPaymentLog(
                    userId,
                    cpoAmount,
                    vacademy.io.common.payment.enums.PaymentGateway.MANUAL.name(),
                    vacademy.io.common.payment.enums.PaymentGateway.MANUAL.name(),
                    currency,
                    userPlan,
                    null,
                    paymentDate);

            Map<String, Object> paymentSpecificData = new HashMap<>();
            String paymentReference = cpoConfig != null && StringUtils.hasText(cpoConfig.getPaymentReference())
                    ? cpoConfig.getPaymentReference()
                    : transactionId;
            if (StringUtils.hasText(paymentReference)) {
                paymentSpecificData.put("transaction_id", paymentReference);
            }
            paymentSpecificData.put("source", "BULK_ASSIGN_CPO");

            paymentLogService.updatePaymentLogOnly(
                    paymentLogId,
                    vacademy.io.admin_core_service.features.user_subscription.enums.PaymentLogStatusEnum.SUCCESS.name(),
                    vacademy.io.common.payment.enums.PaymentStatusEnum.PAID.name(),
                    vacademy.io.admin_core_service.features.common.util.JsonUtil.toJson(paymentSpecificData));

            feeLedgerAllocationService.allocatePaymentForNewLog(
                    paymentLogId, amount, userPlan.getId());

            if (generateInvoiceOnManualEnroll) {
                try {
                    PaymentLog persistedLog = paymentLogRepository.findById(paymentLogId)
                            .orElseThrow(() -> new RuntimeException(
                                    "Payment log not found: " + paymentLogId));
                    invoiceService.generateInvoice(userPlan, persistedLog, instituteId);
                } catch (Exception e) {
                    log.warn("Failed to generate invoice for CPO offline payment userId={}, paymentLogId={}: {}",
                            userId, paymentLogId, e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("Failed to record CPO offline payment for userPlan={}, amount={}: {}",
                    userPlan.getId(), cpoAmount, e.getMessage(), e);
            throw new VacademyException("Failed to record CPO offline payment: " + e.getMessage());
        }
    }

    private record CpoTemplateSummary(BigDecimal total, int count) {
        static CpoTemplateSummary empty() {
            return new CpoTemplateSummary(BigDecimal.ZERO, 0);
        }
    }
}
