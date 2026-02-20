package vacademy.io.admin_core_service.features.learner_management.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.learner_management.dto.*;
import vacademy.io.admin_core_service.features.user_subscription.service.UserPlanService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;

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

    private static final String MODE_SOFT = "SOFT";
    private static final String MODE_HARD = "HARD";

    /**
     * Main entry point for bulk de-assignment.
     */
    public BulkDeassignResponseDTO bulkDeassign(BulkDeassignRequestDTO request) {
        validateRequest(request);

        DeassignOptionsDTO options = request.getOptions() != null
                ? request.getOptions()
                : DeassignOptionsDTO.builder().build();

        boolean dryRun = options.isDryRun();
        String mode = StringUtils.hasText(options.getMode())
                ? options.getMode()
                : MODE_SOFT;

        // 1. Resolve all user IDs
        Set<String> allUserIds = resolveUserIds(request);
        if (allUserIds.isEmpty()) {
            throw new VacademyException("No users to de-assign. Provide user_ids or user_filter.");
        }

        // 2. Fetch user details
        Map<String, UserDTO> userMap = fetchUserDetails(allUserIds);

        // 3. Process each (user × packageSession) pair
        List<BulkDeassignResponseDTO.DeassignResultItemDTO> results = new ArrayList<>();

        for (String packageSessionId : request.getPackageSessionIds()) {
            for (String userId : allUserIds) {
                BulkDeassignResponseDTO.DeassignResultItemDTO result = processDeassignment(userId, userMap,
                        packageSessionId,
                        request.getInstituteId(), mode, dryRun);
                results.add(result);
            }
        }

        // 4. Build response
        return buildResponse(dryRun, results);
    }

    // ========================= PRIVATE METHODS =========================

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
                return BulkDeassignResponseDTO.DeassignResultItemDTO.builder()
                        .userId(userId).userEmail(userEmail)
                        .packageSessionId(packageSessionId)
                        .status("SUCCESS").actionTaken(actionDesc)
                        .userPlanId(userPlanId)
                        .message("Would " + (MODE_HARD.equals(mode)
                                ? "terminate immediately"
                                : "soft-cancel (access until expiry)"))
                        .warning(warning)
                        .build();
            }

            // Actually perform the cancellation
            if (StringUtils.hasText(userPlanId)) {
                boolean force = MODE_HARD.equals(mode);
                userPlanService.cancelUserPlan(userPlanId, force);
                log.info("De-assigned: userId={}, packageSession={}, userPlan={}, mode={}",
                        userId, packageSessionId, userPlanId, mode);
            } else {
                // No UserPlan linked — just update status directly
                if (MODE_HARD.equals(mode)) {
                    mapping.setStatus(LearnerSessionStatusEnum.TERMINATED.name());
                } else {
                    mapping.setStatus(LearnerSessionStatusEnum.INACTIVE.name());
                }
                studentSessionRepository.save(mapping);
                log.info("De-assigned (no userPlan): userId={}, packageSession={}, mode={}",
                        userId, packageSessionId, mode);
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
