package vacademy.io.admin_core_service.features.workflow.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.quartz.Job;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowExecution;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowExecutionState;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowExecutionRepository;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowExecutionStateRepository;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowEngineService;
import vacademy.io.common.logging.SentryLogger;

import vacademy.io.admin_core_service.features.workflow.enums.WorkflowExecutionStatus;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class WorkflowResumeJob implements Job {

    private final WorkflowExecutionStateRepository executionStateRepository;
    private final WorkflowExecutionRepository executionRepository;
    private final WorkflowEngineService workflowEngineService;

    @Override
    public void execute(JobExecutionContext context) throws JobExecutionException {
        log.info("WorkflowResumeJob: checking for paused workflows due for resume");

        try {
            // Find due states (non-locking read to check if there's work to do)
            List<WorkflowExecutionState> dueStates = executionStateRepository
                    .findDueForResume("WAITING", Instant.now());

            if (dueStates.isEmpty()) {
                log.debug("WorkflowResumeJob: no paused workflows due for resume");
                return;
            }

            log.info("WorkflowResumeJob: found {} paused workflows due for resume", dueStates.size());

            for (WorkflowExecutionState state : dueStates) {
                try {
                    // Atomically claim this row: UPDATE ... WHERE status='WAITING'
                    // If another pod already claimed it, this returns 0 → skip
                    int claimed = executionStateRepository.claimForResume(state.getId(), Instant.now());
                    if (claimed == 0) {
                        log.info("WorkflowResumeJob: state {} already claimed by another pod, skipping", state.getId());
                        continue;
                    }

                    log.info("WorkflowResumeJob: claimed state {} for resume", state.getId());
                    resumeWorkflow(state);
                } catch (Exception e) {
                    log.error("WorkflowResumeJob: failed to resume execution {} at node {}",
                            state.getExecutionId(), state.getPausedAtNodeId(), e);

                    SentryLogger.SentryEventBuilder.error(e)
                            .withMessage("Failed to resume paused workflow")
                            .withTag("execution.id", state.getExecutionId())
                            .withTag("paused.node.id", state.getPausedAtNodeId())
                            .withTag("operation", "WorkflowResumeJob")
                            .send();
                }
            }
        } catch (Exception e) {
            log.error("WorkflowResumeJob: unexpected error", e);
        }
    }

    private void resumeWorkflow(WorkflowExecutionState state) {
        log.info("Resuming workflow execution {} from node {}", state.getExecutionId(), state.getPausedAtNodeId());

        // Find the execution and its workflow
        WorkflowExecution execution = executionRepository.findById(state.getExecutionId()).orElse(null);
        if (execution == null) {
            log.error("WorkflowResumeJob: execution not found: {}", state.getExecutionId());
            // Mark state as EXPIRED since there's no execution to resume
            state.setStatus("EXPIRED");
            executionStateRepository.save(state);
            return;
        }

        // Restore context
        Map<String, Object> resumeContext = new HashMap<>(state.getSerializedContext());
        resumeContext.remove("__workflow_paused");
        resumeContext.put("__resumed_from_delay", true);
        resumeContext.put("__resumed_at_node", state.getPausedAtNodeId());

        // Update execution status back to PROCESSING
        execution.setStatus(WorkflowExecutionStatus.PROCESSING);
        executionRepository.save(execution);

        try {
            Map<String, Object> result = workflowEngineService.run(
                    execution.getWorkflow().getId(), resumeContext);

            execution.setStatus(WorkflowExecutionStatus.COMPLETED);
            execution.setCompletedAt(Instant.now());
            executionRepository.save(execution);

            log.info("Successfully resumed and completed workflow execution {}", state.getExecutionId());

        } catch (Exception e) {
            log.error("Failed to execute resumed workflow {}", state.getExecutionId(), e);
            execution.setStatus(WorkflowExecutionStatus.FAILED);
            execution.setErrorMessage("Resume failed: " + e.getMessage());
            execution.setCompletedAt(Instant.now());
            executionRepository.save(execution);
        }
    }
}
