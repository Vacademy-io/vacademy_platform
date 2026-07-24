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

import java.time.Duration;
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

    /**
     * An execution PROCESSING for longer than this with no pending WAITING resume-state is a
     * casualty of a pod restart mid-run (inline sleep, or death between a send and the next
     * persisted DELAY) — nothing will ever advance it. Generous: real runs finish in minutes.
     */
    private static final Duration STUCK_PROCESSING_CUTOFF = Duration.ofHours(6);

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

        sweepStuckProcessingExecutions();
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

            // A resumed run can pause AGAIN at the next DELAY of a drip chain; DelayNodeHandler
            // just set the execution PAUSED and wrote a fresh WAITING state row. Overwriting
            // that with COMPLETED here made the Executions tab report a 14-day drip as done
            // after its first message.
            if (result != null && Boolean.TRUE.equals(result.get("__workflow_paused"))) {
                log.info("Resumed execution {} paused again (next delay in chain) — leaving status PAUSED",
                        state.getExecutionId());
                return;
            }

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

    /**
     * Mark executions abandoned mid-run (pod restart during an inline delay, or between a node
     * and the next persisted DELAY) as FAILED so they don't sit in PROCESSING forever. Runs on
     * the resume job's 2-minute tick; executions with a WAITING resume-state are parked on
     * purpose and are skipped.
     */
    private void sweepStuckProcessingExecutions() {
        try {
            Instant cutoff = Instant.now().minus(STUCK_PROCESSING_CUTOFF);
            List<WorkflowExecution> stale = executionRepository
                    .findStaleExecutions(WorkflowExecutionStatus.PROCESSING, cutoff);
            for (WorkflowExecution execution : stale) {
                if (executionStateRepository.existsByExecutionIdAndStatus(execution.getId(), "WAITING")) {
                    continue; // pending resume — not stuck
                }
                execution.setStatus(WorkflowExecutionStatus.FAILED);
                execution.setErrorMessage("Marked FAILED by stuck-execution sweeper: PROCESSING since "
                        + execution.getStartedAt() + " with no pending resume state (likely pod restart mid-run)");
                execution.setCompletedAt(Instant.now());
                executionRepository.save(execution);
                log.warn("WorkflowResumeJob: swept stuck PROCESSING execution {} (started {})",
                        execution.getId(), execution.getStartedAt());
            }
        } catch (Exception e) {
            log.error("WorkflowResumeJob: stuck-execution sweep failed", e);
        }
    }
}
