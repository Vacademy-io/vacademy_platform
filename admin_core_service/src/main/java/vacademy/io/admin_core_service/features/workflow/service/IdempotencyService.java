package vacademy.io.admin_core_service.features.workflow.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.workflow.entity.Workflow;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowExecution;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowSchedule;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowExecutionStatus;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowExecutionRepository;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowRepository;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowScheduleRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class IdempotencyService {

    private final WorkflowExecutionRepository workflowExecutionRepository;
    private final WorkflowRepository workflowRepository;
    private final WorkflowScheduleRepository workflowScheduleRepository;

    private static final long PROCESSING_TIMEOUT_MINUTES = 30;

    @Transactional(readOnly = true)
    public boolean isAlreadyProcessed(String idempotencyKey) {
        Optional<WorkflowExecution> execution = workflowExecutionRepository.findByIdempotencyKey(idempotencyKey);

        if (execution.isEmpty()) {
            return false;
        }

        WorkflowExecutionStatus status = execution.get().getStatus();
        boolean processed = status == WorkflowExecutionStatus.COMPLETED || status == WorkflowExecutionStatus.FAILED;

        if (processed) {
            log.debug("Idempotency check: {} already processed with status {}", idempotencyKey, status);
        }

        return processed;
    }

    @Transactional
    public WorkflowExecution markAsProcessing(String idempotencyKey, String workflowId, String scheduleId) {
        Optional<WorkflowExecution> existing = workflowExecutionRepository.findByIdempotencyKey(idempotencyKey);

        if (existing.isPresent()) {
            WorkflowExecution execution = existing.get();
            if (execution.getStatus() == WorkflowExecutionStatus.PENDING
                    || execution.getStatus() == WorkflowExecutionStatus.PROCESSING) {
                execution.setStatus(WorkflowExecutionStatus.PROCESSING);
                execution.setStartedAt(LocalDateTime.now());
                WorkflowExecution saved = workflowExecutionRepository.save(execution);
                log.debug("Updated existing execution to PROCESSING: {}", idempotencyKey);
                return saved;
            }
            log.debug("Execution already in terminal state: {}", execution.getStatus());
            return execution;
        }

        Workflow workflow = workflowRepository.findById(workflowId)
                .orElseThrow(() -> new RuntimeException("Workflow not found: " + workflowId));

        WorkflowSchedule schedule = null;
        if (scheduleId != null && !scheduleId.isBlank()) {
            schedule = workflowScheduleRepository.findById(scheduleId).orElse(null);
        }

        WorkflowExecution execution = WorkflowExecution.builder()
                .idempotencyKey(idempotencyKey)
                .workflow(workflow)
                .workflowSchedule(schedule)
                .status(WorkflowExecutionStatus.PROCESSING)
                .startedAt(LocalDateTime.now())
                .build();

        WorkflowExecution saved = workflowExecutionRepository.save(execution);
        log.debug("Created new execution record with status PROCESSING: {}", idempotencyKey);
        return saved;
    }

    @Transactional
    public WorkflowExecution markAsCompleted(String idempotencyKey, Map<String, Object> result) {
        Optional<WorkflowExecution> executionOpt = workflowExecutionRepository.findByIdempotencyKey(idempotencyKey);

        if (executionOpt.isEmpty()) {
            log.warn("Cannot mark as completed - execution not found: {}", idempotencyKey);
            return null;
        }

        WorkflowExecution execution = executionOpt.get();
        execution.setStatus(WorkflowExecutionStatus.COMPLETED);
        execution.setCompletedAt(LocalDateTime.now());
        execution.setErrorMessage(null);

        WorkflowExecution saved = workflowExecutionRepository.save(execution);
        log.debug("Marked execution as COMPLETED: {}", idempotencyKey);
        return saved;
    }

    @Transactional
    public WorkflowExecution markAsFailed(String idempotencyKey, String errorMessage) {
        Optional<WorkflowExecution> executionOpt = workflowExecutionRepository.findByIdempotencyKey(idempotencyKey);

        if (executionOpt.isEmpty()) {
            log.warn("Cannot mark as failed - execution not found: {}", idempotencyKey);
            return null;
        }

        WorkflowExecution execution = executionOpt.get();
        execution.setStatus(WorkflowExecutionStatus.FAILED);
        execution.setCompletedAt(LocalDateTime.now());
        execution.setErrorMessage(errorMessage);

        WorkflowExecution saved = workflowExecutionRepository.save(execution);
        log.debug("Marked execution as FAILED: {}", idempotencyKey);
        return saved;
    }

    @Transactional(readOnly = true)
    public Optional<WorkflowExecution> getExecutionStatus(String idempotencyKey) {
        return workflowExecutionRepository.findByIdempotencyKey(idempotencyKey);
    }

    @Transactional
    public void clearIdempotencyKey(String idempotencyKey) {
        Optional<WorkflowExecution> execution = workflowExecutionRepository.findByIdempotencyKey(idempotencyKey);
        execution.ifPresent(workflowExecutionRepository::delete);
        log.debug("Cleared idempotency key: {}", idempotencyKey);
    }

    @Transactional
    public void cleanupExpiredEntries() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(PROCESSING_TIMEOUT_MINUTES);

        List<WorkflowExecution> staleExecutions = workflowExecutionRepository
                .findStaleExecutions(WorkflowExecutionStatus.PROCESSING, cutoff);

        for (WorkflowExecution execution : staleExecutions) {
            execution.setStatus(WorkflowExecutionStatus.FAILED);
            execution.setCompletedAt(LocalDateTime.now());
            execution.setErrorMessage("Execution timed out after " + PROCESSING_TIMEOUT_MINUTES + " minutes");
            workflowExecutionRepository.save(execution);
            log.warn("Cleaned up expired processing entry: {}", execution.getIdempotencyKey());
        }

        log.info("Cleaned up {} expired execution entries", staleExecutions.size());
    }

    @Transactional(readOnly = true)
    public Map<String, Long> getStatistics() {
        return Map.of(
                "total_entries", workflowExecutionRepository.count(),
                "processing_count", workflowExecutionRepository.countByStatus(WorkflowExecutionStatus.PROCESSING),
                "completed_count", workflowExecutionRepository.countByStatus(WorkflowExecutionStatus.COMPLETED),
                "failed_count", workflowExecutionRepository.countByStatus(WorkflowExecutionStatus.FAILED),
                "pending_count", workflowExecutionRepository.countByStatus(WorkflowExecutionStatus.PENDING));
    }
}
