package vacademy.io.admin_core_service.features.learner_management.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteStudentDTO;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteStudentDetails;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionTypeEnum;
import vacademy.io.admin_core_service.features.institute_learner.notification.LearnerEnrollmentNotificationService;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.learner_management.dto.*;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.service.UserPlanService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

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

    private static final String DUPLICATE_SKIP = "SKIP";
    private static final String DUPLICATE_ERROR = "ERROR";
    private static final String DUPLICATE_RE_ENROLL = "RE_ENROLL";

    /**
     * Main entry point for bulk assignment.
     */
    public BulkAssignResponseDTO bulkAssign(BulkAssignRequestDTO request) {
        validateRequest(request);

        BulkAssignOptionsDTO options = request.getOptions() != null
                ? request.getOptions()
                : BulkAssignOptionsDTO.builder().build();

        boolean dryRun = options.isDryRun();
        boolean notifyLearners = options.isNotifyLearners();
        String duplicateHandling = StringUtils.hasText(options.getDuplicateHandling())
                ? options.getDuplicateHandling()
                : DUPLICATE_SKIP;

        // 1. Create new users (if any) and collect their IDs
        Set<String> allUserIds = resolveUserIds(request);
        List<BulkAssignResultItemDTO> newUserFailures = new ArrayList<>();
        if (!CollectionUtils.isEmpty(request.getNewUsers()) && !dryRun) {
            for (NewUserDTO newUser : request.getNewUsers()) {
                try {
                    String createdUserId = createNewUser(newUser, request.getInstituteId());
                    allUserIds.add(createdUserId);
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
            // In dry-run, report new users as "would be created"
            for (NewUserDTO newUser : request.getNewUsers()) {
                allUserIds.add("dry-run-new-" + newUser.getEmail());
            }
        }

        if (allUserIds.isEmpty() && newUserFailures.isEmpty()) {
            throw new VacademyException("No users to assign. Provide user_ids, new_users, or user_filter.");
        }

        // 2. Fetch user details for email reporting
        Map<String, UserDTO> userMap = fetchUserDetails(allUserIds);
        // Add dry-run new user placeholders to userMap
        if (dryRun && !CollectionUtils.isEmpty(request.getNewUsers())) {
            for (NewUserDTO newUser : request.getNewUsers()) {
                String placeholderId = "dry-run-new-" + newUser.getEmail();
                userMap.put(placeholderId, UserDTO.builder()
                        .id(placeholderId)
                        .email(newUser.getEmail())
                        .fullName(newUser.getFullName())
                        .build());
            }
        }

        // 3. Process each (user × assignment) pair
        List<BulkAssignResultItemDTO> results = new ArrayList<>(newUserFailures);
        List<InstituteStudentDTO> enrolledStudentsForNotification = new ArrayList<>();

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
                        userId, userMap, assignment, config,
                        request.getInstituteId(), duplicateHandling, dryRun);
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

        // 4. Send notifications (async, fire-and-forget)
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

        // 5. Build summary
        return buildResponse(dryRun, results);
    }

    // ========================= PRIVATE METHODS =========================

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
     */
    private String createNewUser(NewUserDTO newUser, String instituteId) {
        UserDTO userDTO = UserDTO.builder()
                .email(newUser.getEmail())
                .fullName(newUser.getFullName())
                .mobileNumber(newUser.getMobileNumber())
                .username(StringUtils.hasText(newUser.getUsername())
                        ? newUser.getUsername()
                        : newUser.getEmail())
                .password(newUser.getPassword())
                .gender(newUser.getGender())
                .roles(CollectionUtils.isEmpty(newUser.getRoles())
                        ? List.of("STUDENT")
                        : newUser.getRoles())
                .build();

        UserDTO created = authService.createUserFromAuthServiceForLearnerEnrollment(
                userDTO, instituteId, false);

        if (created == null || !StringUtils.hasText(created.getId())) {
            throw new VacademyException("User creation returned empty result for " + newUser.getEmail());
        }
        return created.getId();
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
            AssignmentItemDTO assignment,
            DefaultInviteResolver.ResolvedConfig config,
            String instituteId,
            String duplicateHandling,
            boolean dryRun) {

        String packageSessionId = assignment.getPackageSessionId();
        String userEmail = userMap.containsKey(userId)
                ? userMap.get(userId).getEmail()
                : null;

        try {
            // Check for existing enrollment
            Optional<StudentSessionInstituteGroupMapping> existingMapping = studentSessionRepository
                    .findTopByPackageSessionIdAndUserIdAndStatusIn(
                            packageSessionId, instituteId, userId,
                            List.of(
                                    LearnerSessionStatusEnum.ACTIVE.name(),
                                    LearnerSessionStatusEnum.INVITED.name(),
                                    LearnerSessionStatusEnum.TERMINATED.name(),
                                    LearnerSessionStatusEnum.INACTIVE.name()));

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

                // Case B: TERMINATED / INACTIVE → RE_ENROLL or SKIP
                if (DUPLICATE_RE_ENROLL.equals(duplicateHandling)) {
                    return handleReEnroll(mapping, userId, userEmail, config,
                            instituteId, dryRun);
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
            return handleNewEnrollment(userId, userEmail, config, instituteId, dryRun);

        } catch (Exception e) {
            log.error("Error processing assignment userId={}, packageSessionId={}: {}",
                    userId, packageSessionId, e.getMessage(), e);
            return buildFailedResult(userId, userMap, packageSessionId, e.getMessage());
        }
    }

    /**
     * Creates a fresh enrollment: UserPlan + StudentSessionInstituteGroupMapping.
     */
    private BulkAssignResultItemDTO handleNewEnrollment(
            String userId, String userEmail,
            DefaultInviteResolver.ResolvedConfig config,
            String instituteId, boolean dryRun) {

        if (dryRun) {
            return BulkAssignResultItemDTO.builder()
                    .userId(userId).userEmail(userEmail)
                    .packageSessionId(config.getPackageSession().getId())
                    .status("SUCCESS").actionTaken("CREATED")
                    .enrollInviteIdUsed(config.getEnrollInvite().getId())
                    .message(config.isAutoCreated()
                            ? "Will create with auto-generated free invite"
                            : null)
                    .build();
        }

        // Create UserPlan
        UserPlan userPlan = userPlanService.createUserPlan(
                userId,
                config.getPaymentPlan(),
                null, // no coupon discount for admin bulk
                config.getEnrollInvite(),
                config.getPaymentOption(),
                null, // no payment initiation request
                UserPlanStatusEnum.ACTIVE.name());

        // Create StudentSessionInstituteGroupMapping
        StudentSessionInstituteGroupMapping mapping = createActiveMapping(
                userId, config, instituteId, userPlan.getId());
        mapping = studentSessionRepository.save(mapping);

        log.info("Created enrollment: userId={}, packageSession={}, userPlan={}, mapping={}",
                userId, config.getPackageSession().getId(), userPlan.getId(), mapping.getId());

        return BulkAssignResultItemDTO.builder()
                .userId(userId).userEmail(userEmail)
                .packageSessionId(config.getPackageSession().getId())
                .status("SUCCESS").actionTaken("CREATED")
                .mappingId(mapping.getId())
                .userPlanId(userPlan.getId())
                .enrollInviteIdUsed(config.getEnrollInvite().getId())
                .build();
    }

    /**
     * Re-enrolls a previously TERMINATED/INACTIVE user.
     */
    private BulkAssignResultItemDTO handleReEnroll(
            StudentSessionInstituteGroupMapping existingMapping,
            String userId, String userEmail,
            DefaultInviteResolver.ResolvedConfig config,
            String instituteId, boolean dryRun) {

        if (dryRun) {
            return BulkAssignResultItemDTO.builder()
                    .userId(userId).userEmail(userEmail)
                    .packageSessionId(config.getPackageSession().getId())
                    .status("SUCCESS").actionTaken("RE_ENROLLED")
                    .enrollInviteIdUsed(config.getEnrollInvite().getId())
                    .message("Will re-enroll from " + existingMapping.getStatus() + " status")
                    .build();
        }

        // Create new UserPlan (stacking is handled automatically by UserPlanService)
        UserPlan userPlan = userPlanService.createUserPlan(
                userId,
                config.getPaymentPlan(),
                null,
                config.getEnrollInvite(),
                config.getPaymentOption(),
                null,
                UserPlanStatusEnum.ACTIVE.name());

        // Update existing mapping
        existingMapping.setStatus(LearnerSessionStatusEnum.ACTIVE.name());
        existingMapping.setEnrolledDate(new Date());
        existingMapping.setUserPlanId(userPlan.getId());

        if (config.getAccessDays() != null) {
            long expiryMillis = System.currentTimeMillis()
                    + (long) config.getAccessDays() * 24L * 60L * 60L * 1000L;
            existingMapping.setExpiryDate(new Date(expiryMillis));
        }

        studentSessionRepository.save(existingMapping);

        log.info("Re-enrolled: userId={}, packageSession={}, userPlan={}, mapping={}",
                userId, config.getPackageSession().getId(),
                userPlan.getId(), existingMapping.getId());

        return BulkAssignResultItemDTO.builder()
                .userId(userId).userEmail(userEmail)
                .packageSessionId(config.getPackageSession().getId())
                .status("SUCCESS").actionTaken("RE_ENROLLED")
                .mappingId(existingMapping.getId())
                .userPlanId(userPlan.getId())
                .enrollInviteIdUsed(config.getEnrollInvite().getId())
                .message("Re-enrolled from " + existingMapping.getStatus() + " status")
                .build();
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
}
