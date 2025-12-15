package vacademy.io.admin_core_service.features.workflow.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowSchedule;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowScheduleRepository;

import java.time.Instant;
import java.util.List;
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
            return List.of();
        }
    }

    public Optional<WorkflowSchedule> getScheduleById(String id) {
        try {
            return workflowScheduleRepository.findById(id);
        } catch (Exception e) {
            log.error("Error retrieving workflow schedule by ID: {}", id, e);
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
            throw new RuntimeException("Failed to update workflow schedule", e);
        }
    }
}