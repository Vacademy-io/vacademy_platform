package vacademy.io.admin_core_service.features.institute_learner.manager;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowTriggerEvent;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowTriggerService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Fires the {@link WorkflowTriggerEvent#LEARNER_TERMINATION} workflow when a learner
 * is made INACTIVE in one or more package sessions via the institute_learner
 * MAKE_INACTIVE operation.
 *
 * <p>Lives in its own bean (separate from {@code StudentSessionManager}) so the
 * {@code @Async} firing actually runs on a different thread — Spring's async proxy
 * is bypassed on self-invocation. The caller registers an afterCommit callback so
 * this only runs once the status UPDATE is durable; workflow QUERY nodes then see
 * the now-INACTIVE rows.
 */
@Service
@Slf4j
public class LearnerTerminationWorkflowHelper {

    @Autowired
    private WorkflowTriggerService workflowTriggerService;

    @Autowired
    private AuthService authService;

    @Autowired
    private PackageSessionRepository packageSessionRepository;

    /**
     * Fire one LEARNER_TERMINATION trigger per package session the learner was
     * terminated from. Best-effort: a failure for one package session is logged
     * and does not stop the others, and never propagates (the DB write already
     * committed before this runs).
     */
    @Async
    public void fireTerminationWorkflows(String userId, List<String> packageSessionIds,
                                         String instituteId, String adminUserId) {
        if (userId == null || packageSessionIds == null || packageSessionIds.isEmpty()) {
            return;
        }

        UserDTO member = fetchUser(userId);
        UserDTO admin = adminUserId == null ? null : fetchUser(adminUserId);

        for (String packageSessionId : packageSessionIds) {
            try {
                Optional<PackageSession> optionalPackageSession = packageSessionRepository.findById(packageSessionId);
                String packageId = optionalPackageSession
                        .map(ps -> ps.getPackageEntity() != null ? ps.getPackageEntity().getId() : null)
                        .orElse(null);

                Map<String, Object> contextData = new HashMap<>();
                // Expose the terminated learner under both "member" and "user" — the
                // latter is what trigger configs reference (e.g. idempotency expression
                // #ctx['user']['email'] and SEND_EMAIL templates), matching the
                // user/member convention seeded for the learner workflows.
                contextData.put("member", member);
                contextData.put("user", member);
                contextData.put("packageSessionIds", packageSessionId);
                contextData.put("packageId", packageId);
                contextData.put("admin", admin);

                workflowTriggerService.handleTriggerEvents(
                        WorkflowTriggerEvent.LEARNER_TERMINATION.name(),
                        packageSessionId, instituteId, contextData);
            } catch (Exception e) {
                log.error("Failed to fire LEARNER_TERMINATION workflow for userId={}, packageSessionId={}: {}",
                        userId, packageSessionId, e.getMessage(), e);
            }
        }
    }

    private UserDTO fetchUser(String userId) {
        try {
            List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(List.of(userId));
            return users.isEmpty() ? null : users.get(0);
        } catch (Exception e) {
            log.error("Failed to fetch user {} for LEARNER_TERMINATION context: {}", userId, e.getMessage(), e);
            return null;
        }
    }
}
