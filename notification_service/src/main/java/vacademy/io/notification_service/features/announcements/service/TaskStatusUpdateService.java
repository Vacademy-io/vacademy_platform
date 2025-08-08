package vacademy.io.notification_service.features.announcements.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.notification_service.features.announcements.entity.AnnouncementTask;
import vacademy.io.notification_service.features.announcements.enums.TaskStatus;
import vacademy.io.notification_service.features.announcements.repository.AnnouncementTaskRepository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Service to handle automatic task status updates based on datetime
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TaskStatusUpdateService {

    private final AnnouncementTaskRepository taskRepository;
    private final AnnouncementEventService eventService;

    /**
     * Automatically update task statuses based on go-live and deadline times
     * Runs every 5 minutes
     */
    @Scheduled(fixedRate = 300000) // 5 minutes = 300,000 ms
    @Transactional
    public void updateTaskStatuses() {
        log.debug("Starting automatic task status update");
        
        LocalDateTime now = LocalDateTime.now();
        
        try {
            // Identify tasks transitioning to LIVE
            List<AnnouncementTask> toLive = taskRepository.findTasksToGoLive(now);
            // Update tasks that should go live (SCHEDULED -> LIVE)
            int tasksGoingLive = taskRepository.bulkUpdateTasksToLive(now, now);
            if (tasksGoingLive > 0) {
                log.info("Updated {} tasks to LIVE status", tasksGoingLive);
                // Emit SSE events for transitions
                for (AnnouncementTask task : toLive) {
                    try {
                        eventService.sendTaskStatusChangeEvent(
                                task.getAnnouncement().getId(),
                                task.getId(),
                                TaskStatus.SCHEDULED.name(),
                                TaskStatus.LIVE.name(),
                                task
                        );
                    } catch (Exception e) {
                        log.warn("Failed to send LIVE status event for task {}", task.getId(), e);
                    }
                }
            }
            
            // Identify tasks transitioning to OVERDUE
            List<AnnouncementTask> toOverdue = taskRepository.findOverdueTasks(now);
            // Update tasks that are overdue (LIVE -> OVERDUE)
            int overdueTasksUpdated = taskRepository.bulkUpdateTasksToOverdue(now, now);
            if (overdueTasksUpdated > 0) {
                log.info("Updated {} tasks to OVERDUE status", overdueTasksUpdated);
                for (AnnouncementTask task : toOverdue) {
                    try {
                        eventService.sendTaskStatusChangeEvent(
                                task.getAnnouncement().getId(),
                                task.getId(),
                                TaskStatus.LIVE.name(),
                                TaskStatus.OVERDUE.name(),
                                task
                        );
                    } catch (Exception e) {
                        log.warn("Failed to send OVERDUE status event for task {}", task.getId(), e);
                    }
                }
            }
            
            log.debug("Completed automatic task status update. {} tasks went live, {} tasks became overdue", 
                    tasksGoingLive, overdueTasksUpdated);
            
        } catch (Exception e) {
            log.error("Error during automatic task status update", e);
        }
    }

    /**
     * Send reminders for tasks with upcoming deadlines
     * Runs every minute
     */
    @Scheduled(fixedRate = 60000)
    @Transactional(readOnly = true)
    public void sendTaskReminders() {
        try {
            List<AnnouncementTask> tasks = getTasksNeedingReminder();
            if (tasks.isEmpty()) {
                return;
            }
            LocalDateTime now = LocalDateTime.now();
            for (AnnouncementTask task : tasks) {
                try {
                    long minutes = java.time.Duration.between(now, task.getDeadlineDateTime()).toMinutes();
                    int minutesUntilDeadline = (int) Math.max(minutes, 0);
                    eventService.sendTaskReminderEvent(
                            task.getAnnouncement().getId(),
                            task.getId(),
                            task.getTaskTitle(),
                            minutesUntilDeadline
                    );
                } catch (Exception e) {
                    log.warn("Failed to send reminder for task {}", task.getId(), e);
                }
            }
        } catch (Exception e) {
            log.error("Error while sending task reminders", e);
        }
    }

    /**
     * Get tasks that need reminders sent
     * This can be called by a separate notification scheduler
     */
    @Transactional(readOnly = true)
    public List<AnnouncementTask> getTasksNeedingReminder() {
        LocalDateTime now = LocalDateTime.now();
        
        // Find tasks where the reminder time has arrived
        // reminder time = deadline - reminderBeforeMinutes
        List<AnnouncementTask> tasks = taskRepository.findTasksNeedingReminder(
                now, 
                now.plusMinutes(60) // Look ahead 60 minutes for reminders
        );
        
        log.debug("Found {} tasks needing reminders", tasks.size());
        return tasks;
    }

    /**
     * Manually update a task status
     */
    @Transactional
    public void updateTaskStatus(String taskId, TaskStatus newStatus) {
        log.info("Manually updating task {} to status {}", taskId, newStatus);
        
        int updatedRows = taskRepository.updateTaskStatus(taskId, newStatus, LocalDateTime.now());
        
        if (updatedRows > 0) {
            log.info("Successfully updated task {} to status {}", taskId, newStatus);
        } else {
            log.warn("No task found with ID {} to update", taskId);
        }
    }

    /**
     * Get tasks by status for monitoring
     */
    @Transactional(readOnly = true)
    public List<AnnouncementTask> getTasksByStatus(TaskStatus status) {
        return taskRepository.findByStatusAndIsActive(status, true);
    }

    /**
     * Get task statistics
     */
    @Transactional(readOnly = true)
    public TaskStatistics getTaskStatistics() {
        TaskStatistics stats = new TaskStatistics();
        
        stats.setDraftCount(taskRepository.countByStatusAndIsActive(TaskStatus.DRAFT, true));
        stats.setScheduledCount(taskRepository.countByStatusAndIsActive(TaskStatus.SCHEDULED, true));
        stats.setLiveCount(taskRepository.countByStatusAndIsActive(TaskStatus.LIVE, true));
        stats.setCompletedCount(taskRepository.countByStatusAndIsActive(TaskStatus.COMPLETED, true));
        stats.setOverdueCount(taskRepository.countByStatusAndIsActive(TaskStatus.OVERDUE, true));
        stats.setCancelledCount(taskRepository.countByStatusAndIsActive(TaskStatus.CANCELLED, true));
        
        return stats;
    }

    /**
     * Data class for task statistics
     */
    public static class TaskStatistics {
        private long draftCount;
        private long scheduledCount;
        private long liveCount;
        private long completedCount;
        private long overdueCount;
        private long cancelledCount;

        // Getters and setters
        public long getDraftCount() { return draftCount; }
        public void setDraftCount(long draftCount) { this.draftCount = draftCount; }

        public long getScheduledCount() { return scheduledCount; }
        public void setScheduledCount(long scheduledCount) { this.scheduledCount = scheduledCount; }

        public long getLiveCount() { return liveCount; }
        public void setLiveCount(long liveCount) { this.liveCount = liveCount; }

        public long getCompletedCount() { return completedCount; }
        public void setCompletedCount(long completedCount) { this.completedCount = completedCount; }

        public long getOverdueCount() { return overdueCount; }
        public void setOverdueCount(long overdueCount) { this.overdueCount = overdueCount; }

        public long getCancelledCount() { return cancelledCount; }
        public void setCancelledCount(long cancelledCount) { this.cancelledCount = cancelledCount; }

        public long getTotalCount() {
            return draftCount + scheduledCount + liveCount + completedCount + overdueCount + cancelledCount;
        }
    }
}