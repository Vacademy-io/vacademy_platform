package vacademy.io.admin_core_service.features.workflow.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.quartz.Job;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;
import org.quartz.CronExpression;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowSchedule;
import vacademy.io.admin_core_service.features.workflow.service.IdempotencyService;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowEngineService;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowScheduleService;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.ZoneId;
import java.util.Date;
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
                    // Check idempotency
                    String idempotencyKey = generateIdempotencyKey(schedule);
                    if (idempotencyService.isAlreadyProcessed(idempotencyKey)) {
                        log.info("Schedule {} already executed (idempotency check passed)", schedule.getId());
                        continue;
                    }

                    // Mark as processing
                    idempotencyService.markAsProcessing(idempotencyKey);

                    log.info("Executing workflow schedule: {} - {}", schedule.getId(), schedule.getWorkflowId());

                    Map<String, Object> result = executeWorkflowFromSchedule(schedule);

                    // Mark as completed
                    idempotencyService.markAsCompleted(idempotencyKey, result);

                    log.info("Successfully executed workflow schedule: {} - Status: {}",
                            schedule.getId(), result.get("status"));

                    // Log the updated schedule details
                    WorkflowSchedule updatedSchedule = workflowScheduleService.getScheduleById(schedule.getId())
                            .orElse(null);
                    if (updatedSchedule != null) {
                        log.info("Schedule {} updated - lastRunAt: {}, nextRunAt: {}",
                                updatedSchedule.getId(), updatedSchedule.getLastRunAt(),
                                updatedSchedule.getNextRunAt());
                    }

                } catch (Exception e) {
                    log.error("Error executing workflow schedule: {}", schedule.getId(), e);

                    // Mark as failed
                    String idempotencyKey = generateIdempotencyKey(schedule);
                    idempotencyService.markAsFailed(idempotencyKey, e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("Error in workflow execution job", e);
        }
    }

    /**
     * Execute workflow from schedule
     */
    private Map<String, Object> executeWorkflowFromSchedule(WorkflowSchedule schedule) {
        try {
            Map<String, Object> initialContext = new HashMap<>();
            if (schedule.getInitialContext() != null) {
                initialContext.putAll(schedule.getInitialContext());
            }
            initialContext.put("scheduleId", schedule.getId());
            initialContext.put("scheduleName", schedule.getWorkflowId());
            initialContext.put("executionTime", System.currentTimeMillis());

            log.info("Starting workflow execution for schedule: {} with workflow: {}",
                    schedule.getId(), schedule.getWorkflowId());

            // Execute the workflow and get the actual result
            Map<String, Object> workflowResult = workflowEngineService.run(
                    schedule.getWorkflowId(),
                    schedule.getId(), // scheduleRunId
                    initialContext);

            log.info("Workflow execution completed for schedule: {}. Result: {}",
                    schedule.getId(), workflowResult);

            // Create result based on actual workflow execution
            Map<String, Object> result = new HashMap<>();
            result.put("status", "success");
            result.put("scheduleId", schedule.getId());
            result.put("workflowId", schedule.getWorkflowId());
            result.put("executionTime", System.currentTimeMillis());
            result.put("workflowResult", workflowResult);
            result.put("message", "Workflow executed successfully");

            // Update schedule execution time
            updateScheduleExecutionTime(schedule);

            return result;

        } catch (Exception e) {
            log.error("Error executing workflow from schedule: {}", schedule.getId(), e);
            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("status", "error");
            errorResult.put("scheduleId", schedule.getId());
            errorResult.put("workflowId", schedule.getWorkflowId());
            errorResult.put("error", e.getMessage());
            errorResult.put("executionTime", System.currentTimeMillis());
            return errorResult;
        }
    }

    /**
     * Update schedule execution time
     */
    private void updateScheduleExecutionTime(WorkflowSchedule schedule) {
        try {
            LocalDateTime now = LocalDateTime.now();

            // Update last run time
            schedule.setLastRunAt(now);
            schedule.setUpdatedAt(now);

            // Calculate next run time based on cron expression
            LocalDateTime nextRunTime = calculateNextRunTime(schedule.getCronExpression());
            schedule.setNextRunAt(nextRunTime);

            // Save the updated schedule
            WorkflowSchedule updatedSchedule = workflowScheduleService.updateSchedule(schedule.getId(), schedule);

            log.info("Updated execution time for schedule: {} - lastRunAt: {}, nextRunAt: {}",
                    schedule.getId(), updatedSchedule.getLastRunAt(), updatedSchedule.getNextRunAt());

        } catch (Exception e) {
            log.error("Error updating schedule execution time: {}", schedule.getId(), e);
        }
    }

    /**
     * Calculate next run time based on cron expression using Quartz
     */
    private LocalDateTime calculateNextRunTime(String cronExpression) {
        try {
            // Convert 5-field cron to 6-field Quartz format if needed
            String quartzCron = convertToQuartzFormat(cronExpression);

            // Use Quartz's CronExpression for accurate parsing
            CronExpression cron = new CronExpression(quartzCron);

            // Get current time as Date
            Date now = new Date();

            // Get next valid time after now
            Date nextValidTime = cron.getNextValidTimeAfter(now);

            if (nextValidTime != null) {
                // Convert Date to LocalDateTime
                return LocalDateTime.ofInstant(nextValidTime.toInstant(), ZoneId.systemDefault());
            } else {
                log.warn("Could not calculate next run time for cron: {}. Defaulting to 1 minute interval.",
                        cronExpression);
                return LocalDateTime.now().plusMinutes(1);
            }

        } catch (Exception e) {
            log.error("Error parsing cron expression: {}. Defaulting to 1 minute interval.", cronExpression, e);
            // Fallback: run again in 1 minute
            return LocalDateTime.now().plusMinutes(1);
        }
    }

    /**
     * Convert 5-field cron expression to 6-field Quartz format
     * Quartz format: seconds minutes hours day-of-month month day-of-week
     * Standard format: minutes hours day-of-month month day-of-week
     */
    private String convertToQuartzFormat(String cronExpression) {
        if (cronExpression == null || cronExpression.trim().isEmpty()) {
            return "0 * * * * ?"; // Default: every minute
        }

        String[] parts = cronExpression.trim().split("\\s+");

        if (parts.length == 5) {
            // Convert 5-field to 6-field: add seconds=0 and day-of-week=?
            // Input: * * * * * (minute hour day month dow)
            // Output: 0 * * * * ? (second minute hour day month dow)
            return "0 " + String.join(" ", parts) + " ?";
        } else if (parts.length == 6) {
            // Already 6 fields, return as is
            return cronExpression;
        } else {
            log.warn("Invalid cron expression format: {}. Expected 5 or 6 fields. Defaulting to every minute.",
                    cronExpression);
            return "0 * * * * ?"; // Default: every minute
        }
    }

    /**
     * Generate idempotency key for a schedule
     */
    private String generateIdempotencyKey(WorkflowSchedule schedule) {
        long lastExecutionMillis = schedule.getLastRunAt() != null
                ? schedule.getLastRunAt().toInstant(ZoneOffset.UTC).toEpochMilli()
                : System.currentTimeMillis();

        return String.format("workflow_schedule_%s_%s", schedule.getId(), lastExecutionMillis);
    }
}
