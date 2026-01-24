package vacademy.io.admin_core_service.features.workflow.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.workflow.entity.Workflow;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowExecution;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowSchedule;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowTrigger;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowExecutionStatus;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowType;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowExecutionRepository;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowRepository;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowScheduleRepository;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowTriggerRepository;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class IdempotencyService {

    private final WorkflowExecutionRepository workflowExecutionRepository;
    private final WorkflowRepository workflowRepository;
    private final WorkflowScheduleRepository workflowScheduleRepository;
    private final WorkflowTriggerRepository workflowTriggerRepository;

    @Transactional
    public WorkflowExecution markAsProcessing(String idempotencyKey, String workflowId, String scheduleId) {
        try {
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
                    .workflowType(WorkflowType.SCHEDULED)
                    .status(WorkflowExecutionStatus.PROCESSING)
                    .startedAt(Instant.now())
                    .build();

            WorkflowExecution saved = workflowExecutionRepository.save(execution);
            log.debug("Created new SCHEDULED execution record with status PROCESSING: {}", idempotencyKey);
            return saved;

        } catch (DataIntegrityViolationException e) {
            // Let DB enforce idempotency constraint and fail fast
            log.error("Duplicate idempotency key detected (DB constraint violation): {}", idempotencyKey, e);
            throw e; // rethrow as-is (so transaction rolls back)
        }
    }

    /**
     * Mark a trigger-based workflow execution as processing.
     * Creates a WorkflowExecution record with type EVENT_DRIVEN.
     *
     * @param idempotencyKey Unique key for deduplication
     * @param workflowId     ID of the workflow to execute
     * @param triggerId      ID of the workflow trigger
     * @return Created WorkflowExecution entity
     * @throws DataIntegrityViolationException if duplicate idempotency key exists
     */
    @Transactional
    public WorkflowExecution markAsProcessingForTrigger(String idempotencyKey, String workflowId, String triggerId) {
        try {
            Workflow workflow = workflowRepository.findById(workflowId)
                    .orElseThrow(() -> new RuntimeException("Workflow not found: " + workflowId));

            WorkflowTrigger trigger = null;
            if (triggerId != null && !triggerId.isBlank()) {
                trigger = workflowTriggerRepository.findById(triggerId)
                        .orElseThrow(() -> new RuntimeException("Workflow trigger not found: " + triggerId));
            }

            WorkflowExecution execution = WorkflowExecution.builder()
                    .idempotencyKey(idempotencyKey)
                    .workflow(workflow)
                    .workflowTrigger(trigger)
                    .workflowType(WorkflowType.EVENT_DRIVEN)
                    .status(WorkflowExecutionStatus.PROCESSING)
                    .startedAt(Instant.now())
                    .build();

            WorkflowExecution saved = workflowExecutionRepository.save(execution);
            log.debug("Created new EVENT_DRIVEN execution record with status PROCESSING: {}", idempotencyKey);
            return saved;

        } catch (DataIntegrityViolationException e) {
            // Let DB enforce idempotency constraint and fail fast
            log.error("Duplicate idempotency key detected (DB constraint violation): {}", idempotencyKey, e);
            throw e; // rethrow as-is (so transaction rolls back)
        }
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
        execution.setCompletedAt(Instant.now());
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
        if (execution.getStatus().equals(WorkflowExecutionStatus.COMPLETED.name())) {
            return execution;
        }
        execution.setStatus(WorkflowExecutionStatus.FAILED);
        execution.setCompletedAt(Instant.now());
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
