package vacademy.io.admin_core_service.features.workflow.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.quartz.Job;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowExecution;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowSchedule;
import vacademy.io.admin_core_service.features.workflow.service.IdempotencyService;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowEngineService;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowScheduleService;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class WorkflowExecutionJob implements Job {

    private final WorkflowScheduleService workflowScheduleService;
    private final WorkflowEngineService workflowEngineService;
    private final IdempotencyService idempotencyService;

    @Override
    public void execute(JobExecutionContext context) throws JobExecutionException {
        log.info("Starting workflow execution job");

        try {
            List<WorkflowSchedule> dueSchedules = workflowScheduleService.getDueSchedules();

            if (dueSchedules.isEmpty()) {
                log.info("No workflow schedules due for execution");
                return;
            }

            log.info("Found {} schedules due for execution", dueSchedules.size());

            for (WorkflowSchedule schedule : dueSchedules) {
                log.info("Processing schedule: {} - workflow: {}, cron: {}, lastRunAt: {}, nextRunAt: {}",
                        schedule.getId(), schedule.getWorkflowId(), schedule.getCronExpression(),
                        schedule.getLastRunAt(), schedule.getNextRunAt());

                try {
                    String idempotencyKey = generateIdempotencyKey(schedule);

                    WorkflowExecution workflowExecution = idempotencyService.markAsProcessing(idempotencyKey,
                            schedule.getWorkflowId(), schedule.getId());

                    log.info("Executing workflow schedule: {} - {}", schedule.getId(), schedule.getWorkflowId());

                    Map<String, Object> result = executeWorkflowFromSchedule(schedule, workflowExecution);

                    if ("error".equals(result.get("status"))) {
                        String errorMsg = (String) result.getOrDefault("error", "Unknown error");
                        idempotencyService.markAsFailed(idempotencyKey, errorMsg);
                        log.error("Workflow schedule execution failed: {} - Error: {}", schedule.getId(), errorMsg);
                    } else {
                        idempotencyService.markAsCompleted(idempotencyKey, result);
                        log.info("Successfully executed workflow schedule: {} - Status: {}",
                                schedule.getId(), result.get("status"));
                    }

                    WorkflowSchedule updatedSchedule = workflowScheduleService.getScheduleById(schedule.getId())
                            .orElse(null);
                    if (updatedSchedule != null) {
                        log.info("Schedule {} updated - lastRunAt: {}, nextRunAt: {}",
                                updatedSchedule.getId(), updatedSchedule.getLastRunAt(),
                                updatedSchedule.getNextRunAt());
                    }

                } catch (org.springframework.dao.DataIntegrityViolationException e) {
                    log.warn(
                            "Workflow schedule {} is already being executed by another instance (Duplicate key). Skipping execution.",
                            schedule.getId());
                } catch (Exception e) {
                    log.error("Error executing workflow schedule: {}", schedule.getId(), e);
                    String idempotencyKey = generateIdempotencyKey(schedule);
                    idempotencyService.markAsFailed(idempotencyKey, e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("Error in workflow execution job", e);
        }
    }

    private Map<String, Object> executeWorkflowFromSchedule(WorkflowSchedule schedule,
            WorkflowExecution workflowExecution) {
        try {
            Map<String, Object> initialContext = new HashMap<>();
            if (schedule.getInitialContext() != null) {
                initialContext.putAll(schedule.getInitialContext());
            }
            initialContext.put("scheduleId", schedule.getId());
            initialContext.put("scheduleName", schedule.getWorkflowId());
            initialContext.put("executionTime", Instant.now().toEpochMilli());
            initialContext.put("executionId", workflowExecution.getId());
            log.info("Starting workflow execution for schedule: {} with workflow: {}",
                    schedule.getId(), schedule.getWorkflowId());

            Map<String, Object> workflowResult = workflowEngineService.run(
                    schedule.getWorkflowId(),
                    initialContext);

            log.info("Workflow execution completed for schedule: {}. Result: {}",
                    schedule.getId(), workflowResult);

            Map<String, Object> result = new HashMap<>();
            result.put("status", "success");
            result.put("scheduleId", schedule.getId());
            result.put("workflowId", schedule.getWorkflowId());
            result.put("executionTime", Instant.now().toEpochMilli());
            result.put("workflowResult", workflowResult);
            result.put("message", "Workflow executed successfully");

            updateScheduleExecutionTime(schedule);

            return result;

        } catch (Exception e) {
            log.error("Error executing workflow from schedule: {}", schedule.getId(), e);
            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("status", "error");
            errorResult.put("scheduleId", schedule.getId());
            errorResult.put("workflowId", schedule.getWorkflowId());
            errorResult.put("error", e.getMessage());
            errorResult.put("executionTime", Instant.now().toEpochMilli());

            // Update schedule execution time to prevent infinite retries on failure
            updateScheduleExecutionTime(schedule);

            return errorResult;
        }
    }

    private void updateScheduleExecutionTime(WorkflowSchedule schedule) {
        try {
            Instant now = Instant.now();

            schedule.setLastRunAt(now);
            schedule.setUpdatedAt(now);

            Instant nextRunTime = workflowScheduleService.calculateNextRunTime(schedule.getCronExpression(),
                    schedule.getTimezone());
            schedule.setNextRunAt(nextRunTime);

            WorkflowSchedule updatedSchedule = workflowScheduleService.updateSchedule(schedule.getId(), schedule);

            log.info("Updated execution time for schedule: {} - lastRunAt: {}, nextRunAt: {}",
                    schedule.getId(), updatedSchedule.getLastRunAt(), updatedSchedule.getNextRunAt());

        } catch (Exception e) {
            log.error("Error updating schedule execution time: {}", schedule.getId(), e);
        }
    }

    private String generateIdempotencyKey(WorkflowSchedule schedule) {
        // If next execution time is available, use it to ensure one execution per
        // scheduled slot.
        // If nextRunAt is missing (e.g. first run or manual trigger), use current time
        // to avoid collision with past executions (lastRunAt).
        long executionReferenceMillis = schedule.getNextRunAt() != null
                ? schedule.getNextRunAt().toEpochMilli()
                : Instant.now().toEpochMilli();

        return String.format("workflow_schedule_%s_%s", schedule.getId(), executionReferenceMillis);
    }
}
