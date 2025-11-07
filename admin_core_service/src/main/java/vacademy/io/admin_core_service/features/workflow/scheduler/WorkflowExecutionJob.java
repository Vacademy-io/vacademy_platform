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

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TimeZone;

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

                    idempotencyService.markAsProcessing(idempotencyKey, schedule.getWorkflowId(), schedule.getId());

                    log.info("Executing workflow schedule: {} - {}", schedule.getId(), schedule.getWorkflowId());

                    Map<String, Object> result = executeWorkflowFromSchedule(schedule);

                    idempotencyService.markAsCompleted(idempotencyKey, result);

                    log.info("Successfully executed workflow schedule: {} - Status: {}",
                        schedule.getId(), result.get("status"));

                    WorkflowSchedule updatedSchedule = workflowScheduleService.getScheduleById(schedule.getId())
                        .orElse(null);
                    if (updatedSchedule != null) {
                        log.info("Schedule {} updated - lastRunAt: {}, nextRunAt: {}",
                            updatedSchedule.getId(), updatedSchedule.getLastRunAt(),
                            updatedSchedule.getNextRunAt());
                    }

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

    private Map<String, Object> executeWorkflowFromSchedule(WorkflowSchedule schedule) {
        try {
            Map<String, Object> initialContext = new HashMap<>();
            if (schedule.getInitialContext() != null) {
                initialContext.putAll(schedule.getInitialContext());
            }
            initialContext.put("scheduleId", schedule.getId());
            initialContext.put("scheduleName", schedule.getWorkflowId());
            initialContext.put("executionTime", Instant.now().toEpochMilli());

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
            return errorResult;
        }
    }

    private void updateScheduleExecutionTime(WorkflowSchedule schedule) {
        try {
            Instant now = Instant.now();

            schedule.setLastRunAt(now);
            schedule.setUpdatedAt(now);

            Instant nextRunTime = calculateNextRunTime(schedule.getCronExpression(), schedule.getTimezone());
            schedule.setNextRunAt(nextRunTime);

            WorkflowSchedule updatedSchedule = workflowScheduleService.updateSchedule(schedule.getId(), schedule);

            log.info("Updated execution time for schedule: {} - lastRunAt: {}, nextRunAt: {}",
                schedule.getId(), updatedSchedule.getLastRunAt(), updatedSchedule.getNextRunAt());

        } catch (Exception e) {
            log.error("Error updating schedule execution time: {}", schedule.getId(), e);
        }
    }

    /**
     * Calculate next run time based on cron expression in specific timezone
     */
    public Instant calculateNextRunTime(String cronExpression, String timeZone) {
        try {
            // Convert cron to Quartz format if needed
            String quartzCron = convertToQuartzFormat(cronExpression);
            CronExpression cron = new CronExpression(quartzCron);

            // Use target timezone
            ZoneId zoneId = (timeZone != null && !timeZone.isBlank())
                ? ZoneId.of(timeZone)
                : ZoneId.systemDefault();
            cron.setTimeZone(TimeZone.getTimeZone(zoneId));

            // Current time in target timezone
            ZonedDateTime nowInZone = ZonedDateTime.now(zoneId);

            // Compute next run in target timezone
            Date nextValidTime = cron.getNextValidTimeAfter(Date.from(nowInZone.toInstant()));

            if (nextValidTime != null) {
                // Convert to Instant (UTC) for DB
                return nextValidTime.toInstant();
            } else {
                // fallback: 1 minute later
                return Instant.now().plusSeconds(60);
            }

        } catch (Exception e) {
            log.error("Error calculating next run for cron {} in timezone {}. Defaulting 1 min.", cronExpression, timeZone, e);
            return Instant.now().plusSeconds(60);
        }
    }

    private String convertToQuartzFormat(String cronExpression) {
        if (cronExpression == null || cronExpression.trim().isEmpty()) {
            return "0 * * * * ?";
        }

        String[] parts = cronExpression.trim().split("\\s+");

        if (parts.length == 5) {
            return "0 " + String.join(" ", parts) + " ?";
        } else if (parts.length == 6) {
            return cronExpression;
        } else {
            log.warn("Invalid cron expression format: {}. Defaulting to every minute.", cronExpression);
            return "0 * * * * ?";
        }
    }

    private String generateIdempotencyKey(WorkflowSchedule schedule) {
        long lastExecutionMillis = schedule.getLastRunAt() != null
            ? schedule.getLastRunAt().toEpochMilli()
            : Instant.now().toEpochMilli();

        return String.format("workflow_schedule_%s_%s", schedule.getId(), lastExecutionMillis);
    }
}
