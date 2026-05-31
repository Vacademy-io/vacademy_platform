package vacademy.io.admin_core_service.features.institute_learner.manager;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import vacademy.io.admin_core_service.features.institute_learner.dto.StudentStatusUpdateRequest;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@Service
@Slf4j
public class StudentSessionManager {

    @Autowired
    private StudentSessionRepository studentSessionRepository;

    @Autowired
    private LearnerTerminationWorkflowHelper learnerTerminationWorkflowHelper;

    @Transactional
    public void updateStudentStatus(List<StudentStatusUpdateRequest> requests, String operation,
                                    CustomUserDetails adminDetails) {
        String adminUserId = adminDetails != null ? adminDetails.getUserId() : null;

        // MAKE_INACTIVE terminations to fire workflows for, collected during the
        // loop and fired only AFTER the transaction commits (see below).
        List<TerminationFiring> terminations = new ArrayList<>();
        List<String> failures = new ArrayList<>();

        for (StudentStatusUpdateRequest request : requests) {
            try {
                switch (operation) {
                    case "UPDATE_BATCH":
                        studentSessionRepository.updatePackageSessionId(request.getUserId(), request.getCurrentPackageSessionId(), request.getInstituteId(), request.getNewState());
                        break;
                    case "ADD_EXPIRY":
                        SimpleDateFormat dateFormat = new SimpleDateFormat("dd-MM-yyyy");
                        Date expiryDate = dateFormat.parse(request.getNewState());
                        studentSessionRepository.updateExpiryDate(request.getUserId(), request.getCurrentPackageSessionId(), request.getInstituteId(), expiryDate);
                        break;
                    case "MAKE_INACTIVE":
                        handleMakeInactive(request, terminations);
                        break;
                    case "MAKE_ACTIVE":
                        studentSessionRepository.updateStatus(request.getUserId(), request.getCurrentPackageSessionId(), request.getInstituteId(), "ACTIVE");
                        break;
                    case "UPDATE_STATUS":
                        studentSessionRepository.updateStatus(request.getUserId(), request.getCurrentPackageSessionId(), request.getInstituteId(), request.getNewState());
                        break;
                    case "TERMINATE":
                        studentSessionRepository.updateStatus(request.getUserId(), request.getCurrentPackageSessionId(), request.getInstituteId(), "TERMINATED");
                        break;
                    default:
                        throw new IllegalArgumentException("Invalid operation: " + operation);
                }
            } catch (Exception e) {
                // Do NOT swallow silently: record the failure so it surfaces to the
                // caller (and rolls back the transaction) instead of returning 200.
                log.error("Failed '{}' for userId={}, packageSessionId={}: {}",
                        operation, request.getUserId(), request.getCurrentPackageSessionId(), e.getMessage(), e);
                failures.add(request.getUserId() + ":" + e.getMessage());
            }
        }

        if (!failures.isEmpty()) {
            // Rolls back the whole transaction (and skips workflow firing below,
            // since the afterCommit callback was never registered).
            throw new VacademyException("Failed to update status for " + failures.size()
                    + " learner(s): " + String.join("; ", failures));
        }

        fireTerminationWorkflowsAfterCommit(terminations, adminUserId);
    }

    private void handleMakeInactive(StudentStatusUpdateRequest request, List<TerminationFiring> terminations) {
        List<String> packageSessionIds = request.getPackageSessionIds();
        if (packageSessionIds != null && !packageSessionIds.isEmpty()) {
            // Approach B: one atomic UPDATE across every chosen package session.
            studentSessionRepository.updateStatusForPackageSessions(
                    request.getUserId(), packageSessionIds, request.getInstituteId(), request.getNewState());
            terminations.add(new TerminationFiring(request.getUserId(),
                    new ArrayList<>(packageSessionIds), request.getInstituteId()));
        } else {
            // Back-compat: callers that still send a single currentPackageSessionId.
            studentSessionRepository.updateStatus(
                    request.getUserId(), request.getCurrentPackageSessionId(), request.getInstituteId(), request.getNewState());
            if (request.getCurrentPackageSessionId() != null) {
                terminations.add(new TerminationFiring(request.getUserId(),
                        List.of(request.getCurrentPackageSessionId()), request.getInstituteId()));
            }
        }
    }

    /**
     * Fire LEARNER_TERMINATION workflows after the status UPDATE commits, so the
     * workflow's QUERY nodes see the now-INACTIVE rows. The helper method is
     * {@code @Async}, so firing also runs off the request thread. Falls back to a
     * direct (still async) call when there's no active transaction.
     */
    private void fireTerminationWorkflowsAfterCommit(List<TerminationFiring> terminations, String adminUserId) {
        if (terminations.isEmpty()) {
            return;
        }
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    for (TerminationFiring t : terminations) {
                        learnerTerminationWorkflowHelper.fireTerminationWorkflows(
                                t.userId(), t.packageSessionIds(), t.instituteId(), adminUserId);
                    }
                }
            });
        } else {
            for (TerminationFiring t : terminations) {
                learnerTerminationWorkflowHelper.fireTerminationWorkflows(
                        t.userId(), t.packageSessionIds(), t.instituteId(), adminUserId);
            }
        }
    }

    private record TerminationFiring(String userId, List<String> packageSessionIds, String instituteId) {
    }
}
