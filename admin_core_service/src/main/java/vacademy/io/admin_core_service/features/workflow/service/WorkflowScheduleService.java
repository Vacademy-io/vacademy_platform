package vacademy.io.admin_core_service.features.workflow.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowSchedule;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowScheduleRepository;
import vacademy.io.common.logging.SentryLogger;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowScheduleService {

    private final WorkflowScheduleRepository workflowScheduleRepository;
    private final Environment environment;

    private boolean isDevEnv() {
        String[] activeProfiles = environment.getActiveProfiles();
        for (String profile : activeProfiles) {
            if ("dev".equalsIgnoreCase(profile)) {
                return true;
            }
        }
        return false;
    }

    public List<WorkflowSchedule> getActiveSchedules() {
        try {
            if (isDevEnv()) {
                log.info("Skipping active schedule retrieval in dev environment.");
                return List.of();
            }
            return workflowScheduleRepository.findByStatusIgnoreCase("ACTIVE");
        } catch (Exception e) {
            log.error("Error retrieving active workflow schedules", e);
            SentryLogger.logError(e, "Failed to retrieve active workflow schedules", Map.of(
                    "operation", "getActiveSchedules"));
            return List.of();
        }
    }

    public List<WorkflowSchedule> getDueSchedules() {
        try {
            if (isDevEnv()) {
                log.info("Skipping due schedule retrieval in dev environment.");
                return List.of();
            }
            return workflowScheduleRepository.findDueSchedules(Instant.now());
        } catch (Exception e) {
            log.error("Error retrieving due workflow schedules", e);
            SentryLogger.logError(e, "Failed to retrieve due workflow schedules", Map.of(
                    "operation", "getDueSchedules"));
            return List.of();
        }
    }

    public Optional<WorkflowSchedule> getScheduleById(String id) {
        try {
            return workflowScheduleRepository.findById(id);
        } catch (Exception e) {
            log.error("Error retrieving workflow schedule by ID: {}", id, e);
            SentryLogger.logError(e, "Failed to retrieve workflow schedule by ID", Map.of(
                    "schedule.id", id,
                    "operation", "getScheduleById"));
            return Optional.empty();
        }
    }

    public WorkflowSchedule createSchedule(WorkflowSchedule schedule) {
        try {
            schedule.setCreatedAt(Instant.now());
            schedule.setUpdatedAt(Instant.now());
            schedule.setStatus("ACTIVE");

            WorkflowSchedule savedSchedule = workflowScheduleRepository.save(schedule);
            log.info("Created workflow schedule: {}", savedSchedule.getId());
            return savedSchedule;
        } catch (Exception e) {
            log.error("Error creating workflow schedule", e);
            SentryLogger.logError(e, "Failed to create workflow schedule", Map.of(
                    "workflow.id", schedule.getWorkflowId() != null ? schedule.getWorkflowId() : "unknown",
                    "schedule.type", schedule.getScheduleType() != null ? schedule.getScheduleType() : "unknown",
                    "operation", "createSchedule"));
            throw new RuntimeException("Failed to create workflow schedule", e);
        }
    }

    public WorkflowSchedule updateSchedule(String id, WorkflowSchedule scheduleDetails) {
        try {
            Optional<WorkflowSchedule> existingSchedule = workflowScheduleRepository.findById(id);
            if (existingSchedule.isEmpty()) {
                throw new RuntimeException("Workflow schedule not found: " + id);
            }

            WorkflowSchedule existing = existingSchedule.get();

            existing.setWorkflowId(scheduleDetails.getWorkflowId());
            existing.setScheduleType(scheduleDetails.getScheduleType());
            existing.setCronExpression(scheduleDetails.getCronExpression());
            existing.setIntervalMinutes(scheduleDetails.getIntervalMinutes());
            existing.setDayOfMonth(scheduleDetails.getDayOfMonth());
            existing.setTimezone(scheduleDetails.getTimezone());
            existing.setStartDate(scheduleDetails.getStartDate());
            existing.setEndDate(scheduleDetails.getEndDate());
            existing.setStatus(scheduleDetails.getStatus());
            existing.setLastRunAt(scheduleDetails.getLastRunAt());
            existing.setNextRunAt(scheduleDetails.getNextRunAt());
            existing.setUpdatedAt(Instant.now());

            WorkflowSchedule updatedSchedule = workflowScheduleRepository.save(existing);
            log.info("Updated workflow schedule: {} - lastRunAt: {}, nextRunAt: {}",
                    updatedSchedule.getId(), updatedSchedule.getLastRunAt(), updatedSchedule.getNextRunAt());
            return updatedSchedule;
        } catch (Exception e) {
            log.error("Error updating workflow schedule: {}", id, e);
            SentryLogger.logError(e, "Failed to update workflow schedule", Map.of(
                    "schedule.id", id,
                    "operation", "updateSchedule"));
            throw new RuntimeException("Failed to update workflow schedule", e);
        }
    }

    public void forceAdvanceSchedule(String scheduleId) {
        try {
            WorkflowSchedule schedule = getScheduleById(scheduleId).orElseThrow(
                    () -> new RuntimeException("Schedule not found: " + scheduleId));

            Instant now = Instant.now();
            Instant nextRunTime = calculateNextRunTime(schedule.getCronExpression(), schedule.getTimezone());

            schedule.setLastRunAt(now); // Mark 'now' as the point where we intervened
            schedule.setNextRunAt(nextRunTime);
            schedule.setUpdatedAt(now);

            updateSchedule(scheduleId, schedule);
            log.info("Forced advancement of schedule: {} - New Next Run: {}", scheduleId, nextRunTime);

        } catch (Exception e) {
            log.error("Error forcing advancement of schedule: {}", scheduleId, e);
            SentryLogger.logError(e, "Failed to force advance schedule", Map.of("scheduleId", scheduleId));
        }
    }

    /**
     * Calculate next run time based on cron expression in specific timezone
     */
    public Instant calculateNextRunTime(String cronExpression, String timeZone) {
        try {
            // Convert cron to Quartz format if needed
            String quartzCron = convertToQuartzFormat(cronExpression);
            org.quartz.CronExpression cron = new org.quartz.CronExpression(quartzCron);

            // Use target timezone
            java.time.ZoneId zoneId = (timeZone != null && !timeZone.isBlank())
                    ? java.time.ZoneId.of(timeZone)
                    : java.time.ZoneId.systemDefault();
            cron.setTimeZone(java.util.TimeZone.getTimeZone(zoneId));

            // Current time in target timezone
            java.time.ZonedDateTime nowInZone = java.time.ZonedDateTime.now(zoneId);

            // Compute next run in target timezone based on NOW
            java.util.Date nextValidTime = cron.getNextValidTimeAfter(java.util.Date.from(nowInZone.toInstant()));

            if (nextValidTime != null) {
                // Convert to Instant (UTC) for DB
                return nextValidTime.toInstant();
            } else {
                // fallback: 1 minute later
                return Instant.now().plusSeconds(60);
            }

        } catch (Exception e) {
            log.error("Error calculating next run for cron {} in timezone {}. Defaulting 1 min.", cronExpression,
                    timeZone, e);
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
}