package vacademy.io.admin_core_service.features.learner_management.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.manager.LearnerTerminationWorkflowHelper;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.learner_management.dto.*;
import vacademy.io.admin_core_service.features.packages.service.PackageSessionService;
import vacademy.io.admin_core_service.features.user_subscription.service.UserPlanService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Orchestrates the bulk de-assignment of N users × M package sessions.
 * <p>
 * For each (user, packageSession) pair:
 * 1. Finds the active StudentSessionInstituteGroupMapping
 * 2. Determines the UserPlan
 * 3. Cancels the UserPlan (SOFT or HARD)
 * 4. Reports per-item results, including shared UserPlan warnings
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BulkDeassignmentService {

    private final StudentSessionRepository studentSessionRepository;
    private final UserPlanService userPlanService;
    private final AuthService authService;
    private final PackageSessionService packageSessionService;
    private final LearnerTerminationWorkflowHelper learnerTerminationWorkflowHelper;

    private static final String MODE_SOFT = "SOFT";
    private static final String MODE_HARD = "HARD";

    /**
     * Main entry point for bulk de-assignment.
     */
    public BulkDeassignResponseDTO bulkDeassign(BulkDeassignRequestDTO request, String adminUserId) {
        validateRequest(request);

        DeassignOptionsDTO options = request.getOptions() != null
                ? request.getOptions()
                : DeassignOptionsDTO.builder().build();

        boolean dryRun = options.isDryRun();
        String mode = StringUtils.hasText(options.getMode())
                ? options.getMode()
                : MODE_SOFT;

        // SOFT-only "last access date" override. HARD ignores it (access is revoked now).
        Date accessTillDate = MODE_HARD.equals(mode)
                ? null
                : parseAccessTillDate(options.getAccessTillDate());

        // 1. Resolve all user IDs
        Set<String> allUserIds = resolveUserIds(request);
        if (allUserIds.isEmpty()) {
            throw new VacademyException("No users to de-assign. Provide user_ids or user_filter.");
        }

        // 2. Fetch user details
        Map<String, UserDTO> userMap = fetchUserDetails(allUserIds);

        // 3. Process each (user × packageSession) pair
        List<BulkDeassignResponseDTO.DeassignResultItemDTO> results = new ArrayList<>();

        // Track real (non-dry-run) successful de-assignments so we can fire the
        // LEARNER_TERMINATION workflow once the writes are durable. Grouped by user
        // so the helper resolves each user from auth-service only once.
        //
        // Only HARD terminations are collected here: SOFT is a cancel (access
        // continues to expiry), so it must NOT fire the access-revoked
        // LEARNER_TERMINATION workflow. The soft-cancel's own SUBSCRIPTION_CANCELLED
        // workflow is fired inside UserPlanService.cancelUserPlan.
        Map<String, List<String>> terminatedPackageSessionsByUser = new LinkedHashMap<>();

        for (String packageSessionId : request.getPackageSessionIds()) {
            for (String userId : allUserIds) {
                BulkDeassignResponseDTO.DeassignResultItemDTO result = processDeassignment(userId, userMap,
                        packageSessionId,
                        request.getInstituteId(), mode, accessTillDate, dryRun);
                results.add(result);

                if (!dryRun && MODE_HARD.equals(mode) && "SUCCESS".equals(result.getStatus())) {
                    terminatedPackageSessionsByUser
                            .computeIfAbsent(userId, k -> new ArrayList<>())
                            .add(packageSessionId);
                }
            }
        }

        // 4. Fire LEARNER_TERMINATION workflows for the real HARD de-assignments,
        //    scoped by eventId=packageSessionId + instituteId.
        fireTerminationWorkflows(terminatedPackageSessionsByUser, request.getInstituteId(), adminUserId);

        // 5. Build response
        return buildResponse(dryRun, results);
    }

    /**
     * Fire the LEARNER_TERMINATION workflow for each user that was actually
     * de-assigned — one trigger per package session (eventId = packageSessionId),
     * scoped to the institute.
     *
     * <p>Delegates to the {@code @Async} helper bean so firing runs off the request
     * thread (a separate bean is required for Spring's async proxy to apply). Skipped
     * for dry runs (no rows are collected). Best-effort: the de-assignment writes have
     * already committed, so a workflow failure must never affect the API response —
     * the helper swallows per-trigger errors internally.
     */
    private void fireTerminationWorkflows(Map<String, List<String>> terminatedPackageSessionsByUser,
                                          String instituteId, String adminUserId) {
        terminatedPackageSessionsByUser.forEach((userId, packageSessionIds) ->
                learnerTerminationWorkflowHelper.fireTerminationWorkflows(
                        userId, packageSessionIds, instituteId, adminUserId));
    }

    // ========================= PRIVATE METHODS =========================

    /**
     * Parse the SOFT-mode "last access date" the frontend sends. Accepts either a
     * bare {@code yyyy-MM-dd} (calendar day → end-of-day access) or a full ISO-8601
     * instant. Returns null on blank/unparseable input so callers fall back to the
     * plan's own expiry (a bad date must never silently revoke access).
     */
    private Date parseAccessTillDate(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        String value = raw.trim();
        try {
            // Bare calendar date → keep access through the end of that day.
            if (value.length() == 10 && value.charAt(4) == '-') {
                LocalDate day = LocalDate.parse(value);
                return Date.from(day.atTime(LocalTime.MAX).atZone(ZoneOffset.UTC).toInstant());
            }
            // Full ISO-8601 instant (e.g. from Date.toISOString()).
            return Date.from(Instant.parse(value));
        } catch (DateTimeParseException e) {
            log.warn("Ignoring unparseable access_till_date '{}': {}", raw, e.getMessage());
            return null;
        }
    }

    private void validateRequest(BulkDeassignRequestDTO request) {
        if (!StringUtils.hasText(request.getInstituteId())) {
            throw new VacademyException("institute_id is required");
        }
        if (CollectionUtils.isEmpty(request.getPackageSessionIds())) {
            throw new VacademyException("package_session_ids cannot be empty");
        }
    }

    private Set<String> resolveUserIds(BulkDeassignRequestDTO request) {
        Set<String> userIds = new LinkedHashSet<>();

        if (!CollectionUtils.isEmpty(request.getUserIds())) {
            userIds.addAll(request.getUserIds());
        }

        UserFilterDTO filter = request.getUserFilter();
        if (filter != null && StringUtils.hasText(filter.getSourcePackageSessionId())) {
            List<String> statuses = CollectionUtils.isEmpty(filter.getStatuses())
                    ? List.of(LearnerSessionStatusEnum.ACTIVE.name())
                    : filter.getStatuses();

            List<String> filteredIds = studentSessionRepository
                    .findDistinctUserIdsByPackageSessionAndStatus(
                            filter.getSourcePackageSessionId(), statuses);
            userIds.addAll(filteredIds);
        }

        return userIds;
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
     * Process a single (user, packageSession) de-assignment.
     */
    private BulkDeassignResponseDTO.DeassignResultItemDTO processDeassignment(
            String userId,
            Map<String, UserDTO> userMap,
            String packageSessionId,
            String instituteId,
            String mode,
            Date accessTillDate,
            boolean dryRun) {

        String userEmail = userMap.containsKey(userId) ? userMap.get(userId).getEmail() : null;

        try {
            // Find active mapping for this user + packageSession
            Optional<StudentSessionInstituteGroupMapping> mappingOpt = studentSessionRepository
                    .findTopByPackageSessionIdAndUserIdAndStatusIn(
                            packageSessionId, instituteId, userId,
                            List.of(LearnerSessionStatusEnum.ACTIVE.name()));

            if (mappingOpt.isEmpty()) {
                return BulkDeassignResponseDTO.DeassignResultItemDTO.builder()
                        .userId(userId).userEmail(userEmail)
                        .packageSessionId(packageSessionId)
                        .status("SKIPPED").actionTaken("NONE")
                        .message("No active enrollment found")
                        .build();
            }

            StudentSessionInstituteGroupMapping mapping = mappingOpt.get();
            String userPlanId = mapping.getUserPlanId();
            String warning = null;

            // Check if UserPlan is shared across multiple package sessions
            if (StringUtils.hasText(userPlanId)) {
                List<StudentSessionInstituteGroupMapping> planMappings = studentSessionRepository
                        .findAllByUserPlanIdAndStatusIn(
                                userPlanId,
                                List.of(LearnerSessionStatusEnum.ACTIVE.name()));

                if (planMappings.size() > 1) {
                    long otherCount = planMappings.stream()
                            .filter(m -> !m.getPackageSession().getId().equals(packageSessionId))
                            .count();
                    if (otherCount > 0) {
                        warning = "UserPlan " + userPlanId + " is shared across "
                                + planMappings.size() + " package sessions. "
                                + "Canceling this plan will affect other enrollments.";
                    }
                }
            }

            if (dryRun) {
                String actionDesc = MODE_HARD.equals(mode)
                        ? "HARD_TERMINATED"
                        : "SOFT_CANCELED";
                String softMessage = accessTillDate != null
                        ? "soft-cancel (access until " + accessTillDate + ")"
                        : "soft-cancel (access until plan expiry)";
                return BulkDeassignResponseDTO.DeassignResultItemDTO.builder()
                        .userId(userId).userEmail(userEmail)
                        .packageSessionId(packageSessionId)
                        .status("SUCCESS").actionTaken(actionDesc)
                        .userPlanId(userPlanId)
                        .message("Would " + (MODE_HARD.equals(mode)
                                ? "terminate immediately"
                                : softMessage))
                        .warning(warning)
                        .build();
            }

            // Actually perform the cancellation
            boolean hard = MODE_HARD.equals(mode);
            boolean slotFreed = false;
            if (StringUtils.hasText(userPlanId)) {
                userPlanService.cancelUserPlan(userPlanId, hard);
                slotFreed = hard; // Only hard terminate actually frees the slot
                // SOFT keeps the ACTIVE mapping (cancelUserPlan leaves it untouched).
                // When the admin picked a "last access date", override the mapping's
                // expiry so access ends on that date instead of the plan's own expiry.
                if (!hard && accessTillDate != null) {
                    mapping.setExpiryDate(accessTillDate);
                    studentSessionRepository.save(mapping);
                }
                log.info("De-assigned: userId={}, packageSession={}, userPlan={}, mode={}, accessTill={}",
                        userId, packageSessionId, userPlanId, mode, accessTillDate);
            } else {
                // No UserPlan linked — update the mapping directly.
                if (hard) {
                    // HARD: revoke access now.
                    mapping.setStatus(LearnerSessionStatusEnum.TERMINATED.name());
                    slotFreed = true; // seat freed immediately
                } else {
                    // SOFT: keep the learner ACTIVE so access continues. Only the
                    // "last access date" (if given) moves the expiry forward/back;
                    // otherwise the existing expiry is preserved. The seat is NOT
                    // freed — the learner still occupies it until they actually expire.
                    if (accessTillDate != null) {
                        mapping.setExpiryDate(accessTillDate);
                    }
                }
                studentSessionRepository.save(mapping);
                log.info("De-assigned (no userPlan): userId={}, packageSession={}, mode={}, accessTill={}",
                        userId, packageSessionId, mode, accessTillDate);
            }

            // Only increment inventory when the slot is actually freed
            if (slotFreed) {
                packageSessionService.incrementAvailability(packageSessionId, 1);
            }

            String actionTaken = MODE_HARD.equals(mode)
                    ? "HARD_TERMINATED"
                    : "SOFT_CANCELED";

            return BulkDeassignResponseDTO.DeassignResultItemDTO.builder()
                    .userId(userId).userEmail(userEmail)
                    .packageSessionId(packageSessionId)
                    .status("SUCCESS").actionTaken(actionTaken)
                    .userPlanId(userPlanId)
                    .warning(warning)
                    .build();

        } catch (Exception e) {
            log.error("Error de-assigning userId={}, packageSession={}: {}",
                    userId, packageSessionId, e.getMessage(), e);
            return BulkDeassignResponseDTO.DeassignResultItemDTO.builder()
                    .userId(userId).userEmail(userEmail)
                    .packageSessionId(packageSessionId)
                    .status("FAILED").actionTaken("NONE")
                    .message(e.getMessage())
                    .build();
        }
    }

    private BulkDeassignResponseDTO buildResponse(
            boolean dryRun,
            List<BulkDeassignResponseDTO.DeassignResultItemDTO> results) {

        int successful = 0, failed = 0, skipped = 0;
        for (BulkDeassignResponseDTO.DeassignResultItemDTO r : results) {
            switch (r.getStatus()) {
                case "SUCCESS" -> successful++;
                case "FAILED" -> failed++;
                case "SKIPPED" -> skipped++;
            }
        }

        return BulkDeassignResponseDTO.builder()
                .dryRun(dryRun)
                .summary(BulkDeassignResponseDTO.SummaryDTO.builder()
                        .totalRequested(results.size())
                        .successful(successful)
                        .failed(failed)
                        .skipped(skipped)
                        .build())
                .results(results)
                .build();
    }
}
