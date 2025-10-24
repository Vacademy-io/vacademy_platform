package vacademy.io.admin_core_service.features.workflow.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowSchedule;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowScheduleRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowScheduleService {

    private final WorkflowScheduleRepository workflowScheduleRepository;

    /**
     * Get all active workflow schedules
     */
    public List<WorkflowSchedule> getActiveSchedules() {
        try {
            return workflowScheduleRepository.findByStatusIgnoreCase("ACTIVE");
        } catch (Exception e) {
            log.error("Error retrieving active workflow schedules", e);
            return List.of();
        }
    }

    /**
     * Get schedules that are due for execution
     */
    public List<WorkflowSchedule> getDueSchedules() {
        try {
            return workflowScheduleRepository.findDueSchedules(LocalDateTime.now());
        } catch (Exception e) {
            log.error("Error retrieving due workflow schedules", e);
            return List.of();
        }
    }

    /**
     * Get workflow schedule by ID
     */
    public Optional<WorkflowSchedule> getScheduleById(String id) {
        try {
            return workflowScheduleRepository.findById(id);
        } catch (Exception e) {
            log.error("Error retrieving workflow schedule by ID: {}", id, e);
            return Optional.empty();
        }
    }

    /**
     * Create a new workflow schedule
     */
    public WorkflowSchedule createSchedule(WorkflowSchedule schedule) {
        try {
            schedule.setCreatedAt(LocalDateTime.now());
            schedule.setUpdatedAt(LocalDateTime.now());
            schedule.setStatus("ACTIVE");
            WorkflowSchedule savedSchedule = workflowScheduleRepository.save(schedule);
            log.info("Created workflow schedule: {}", savedSchedule.getId());
            return savedSchedule;
        } catch (Exception e) {
            log.error("Error creating workflow schedule", e);
            throw new RuntimeException("Failed to create workflow schedule", e);
        }
    }

    /**
     * Update an existing workflow schedule
     */
    public WorkflowSchedule updateSchedule(String id, WorkflowSchedule scheduleDetails) {
        try {
            Optional<WorkflowSchedule> existingSchedule = workflowScheduleRepository.findById(id);
            if (existingSchedule.isEmpty()) {
                throw new RuntimeException("Workflow schedule not found: " + id);
            }

            WorkflowSchedule existing = existingSchedule.get();

            // Update all fields from the provided schedule details
            existing.setWorkflowId(scheduleDetails.getWorkflowId());
            existing.setScheduleType(scheduleDetails.getScheduleType());
            existing.setCronExpression(scheduleDetails.getCronExpression());
            existing.setIntervalMinutes(scheduleDetails.getIntervalMinutes());
            existing.setDayOfMonth(scheduleDetails.getDayOfMonth());
            existing.setTimezone(scheduleDetails.getTimezone());
            existing.setStartDate(scheduleDetails.getStartDate());
            existing.setEndDate(scheduleDetails.getEndDate());
            existing.setStatus(scheduleDetails.getStatus());

            // Update execution timing fields
            existing.setLastRunAt(scheduleDetails.getLastRunAt());
            existing.setNextRunAt(scheduleDetails.getNextRunAt());

            // Always update the updated_at timestamp
            existing.setUpdatedAt(LocalDateTime.now());

            WorkflowSchedule updatedSchedule = workflowScheduleRepository.save(existing);
            log.info("Updated workflow schedule: {} - lastRunAt: {}, nextRunAt: {}",
                    updatedSchedule.getId(), updatedSchedule.getLastRunAt(), updatedSchedule.getNextRunAt());
            return updatedSchedule;
        } catch (Exception e) {
            log.error("Error updating workflow schedule: {}", id, e);
            throw new RuntimeException("Failed to update workflow schedule", e);
        }
    }

    /**
     * Deactivate a workflow schedule
     */
    public void deactivateSchedule(String id) {
        try {
            Optional<WorkflowSchedule> schedule = workflowScheduleRepository.findById(id);
            if (schedule.isPresent()) {
                WorkflowSchedule existing = schedule.get();
                existing.setStatus("INACTIVE");
                existing.setUpdatedAt(LocalDateTime.now());
                workflowScheduleRepository.save(existing);
                log.info("Deactivated workflow schedule: {}", id);
            }
        } catch (Exception e) {
            log.error("Error deactivating workflow schedule: {}", id, e);
            throw new RuntimeException("Failed to deactivate workflow schedule", e);
        }
    }

    /**
     * Update the next execution time for a schedule
     */
    public void updateNextExecutionTime(String id, LocalDateTime nextExecutionTime) {
        try {
            Optional<WorkflowSchedule> schedule = workflowScheduleRepository.findById(id);
            if (schedule.isPresent()) {
                WorkflowSchedule existing = schedule.get();
                existing.setNextRunAt(nextExecutionTime);
                existing.setLastRunAt(LocalDateTime.now());
                existing.setUpdatedAt(LocalDateTime.now());
                workflowScheduleRepository.save(existing);
                log.debug("Updated next execution time for schedule: {} to {}", id, nextExecutionTime);
            }
        } catch (Exception e) {
            log.error("Error updating next execution time for schedule: {}", id, e);
        }
    }

    /**
     * Get all workflow schedules (for admin purposes)
     */
    public List<WorkflowSchedule> getAllSchedules() {
        try {
            return workflowScheduleRepository.findAll();
        } catch (Exception e) {
            log.error("Error retrieving all workflow schedules", e);
            return List.of();
        }
    }

    /**
     * Get schedules by status
     */
    public List<WorkflowSchedule> getSchedulesByStatus(String status) {
        try {
            return workflowScheduleRepository.findByStatusIgnoreCase(status);
        } catch (Exception e) {
            log.error("Error retrieving schedules by status: {}", status, e);
            return List.of();
        }
    }

    /**
     * Get schedules by workflow ID
     */
    public List<WorkflowSchedule> getSchedulesByWorkflowId(String workflowId) {
        try {
            return workflowScheduleRepository.findByWorkflowId(workflowId);
        } catch (Exception e) {
            log.error("Error retrieving schedules by workflow ID: {}", workflowId, e);
            return List.of();
        }
    }

    /**
     * Get schedules by schedule type
     */
    public List<WorkflowSchedule> getSchedulesByType(String scheduleType) {
        try {
            return workflowScheduleRepository.findByScheduleType(scheduleType);
        } catch (Exception e) {
            log.error("Error retrieving schedules by type: {}", scheduleType, e);
            return List.of();
        }
    }
}