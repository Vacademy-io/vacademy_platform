package vacademy.io.notification_service.features.announcements.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.notification_service.features.announcements.dto.AnnouncementEvent;
import vacademy.io.notification_service.features.announcements.entity.RecipientMessage;
import vacademy.io.notification_service.features.announcements.enums.EventType;
import vacademy.io.notification_service.features.announcements.repository.RecipientMessageRepository;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Service for managing and sending real-time announcement events via SSE
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AnnouncementEventService {
    
    private final SSEConnectionManager connectionManager;
    private final RecipientMessageRepository recipientMessageRepository;
    private final EventFilterService eventFilterService;
    
    /**
     * Send event to a specific user
     */
    public void sendToUser(String userId, AnnouncementEvent event) {
        log.debug("Sending event {} to user: {}", event.getType(), userId);
        
        // Apply event filtering
        if (!eventFilterService.shouldReceiveEvent(userId, event)) {
            log.debug("Event {} filtered out for user: {}", event.getType(), userId);
            return;
        }
        
        // Set target user
        event.setTargetUserId(userId);
        
        // Send via SSE
        connectionManager.sendToUser(userId, event);
    }
    
    /**
     * Send event to multiple users
     */
    public void sendToUsers(List<String> userIds, AnnouncementEvent event) {
        log.debug("Sending event {} to {} users", event.getType(), userIds.size());
        
        // Filter users and send
        for (String userId : userIds) {
            sendToUser(userId, event);
        }
    }
    
    /**
     * Send event to all recipients of an announcement
     */
    public void sendToAnnouncementRecipients(String announcementId, AnnouncementEvent event) {
        log.debug("Sending event {} to recipients of announcement: {}", event.getType(), announcementId);
        
        // Use recipient_messages to target actual delivered users
        List<RecipientMessage> delivered = recipientMessageRepository.findByAnnouncementId(announcementId);
        if (delivered == null || delivered.isEmpty()) {
            log.debug("No recipient_messages found for announcement: {}", announcementId);
            return;
        }
        List<String> userIds = delivered.stream().map(RecipientMessage::getUserId).collect(Collectors.toList());
        
        sendToUsers(userIds, event);
    }
    
    /**
     * Send event to users who received a specific message
     */
    public void sendToMessageRecipients(String messageId, AnnouncementEvent event) {
        log.debug("Sending event {} to recipients of message: {}", event.getType(), messageId);
        
        // Look up the specific recipient message
        Optional<RecipientMessage> messageOpt = recipientMessageRepository.findById(messageId);
        if (messageOpt.isEmpty()) {
            log.debug("Recipient message not found: {}", messageId);
            return;
        }
        RecipientMessage recipientMessage = messageOpt.get();
        String announcementId = recipientMessage.getAnnouncementId();

        // Send to all users who received the same announcement
        List<RecipientMessage> allForAnnouncement = recipientMessageRepository.findByAnnouncementId(announcementId);
        if (allForAnnouncement == null || allForAnnouncement.isEmpty()) {
            log.debug("No recipients found for announcement: {} (from message: {})", announcementId, messageId);
            return;
        }
        List<String> userIds = allForAnnouncement.stream().map(RecipientMessage::getUserId).collect(Collectors.toList());
        sendToUsers(userIds, event);
    }
    
    /**
     * Send event to the creator of an announcement
     */
    public void sendToAnnouncementCreator(String announcementId, AnnouncementEvent event) {
        log.debug("Sending event {} to creator of announcement: {}", event.getType(), announcementId);
        
        // This would require getting the announcement and its creator
        // For now, we'll implement this when we have the announcement details
        // TODO: Implement when needed
    }
    
    /**
     * Broadcast event to all users in an institute
     */
    public void broadcastToInstitute(String instituteId, AnnouncementEvent event) {
        log.debug("Broadcasting event {} to institute: {}", event.getType(), instituteId);
        
        // Set institute ID in event
        event.setInstituteId(instituteId);
        
        // Broadcast via connection manager
        connectionManager.broadcastToInstitute(instituteId, event);
    }
    
    /**
     * Send task-related event to task recipients
     */
    public void sendToTaskRecipients(String announcementId, AnnouncementEvent event) {
        log.debug("Sending task event {} to recipients of announcement: {}", event.getType(), announcementId);
        
        // For task events, send to all announcement recipients
        sendToAnnouncementRecipients(announcementId, event);
    }
    
    /**
     * Send system alert to all users in institute
     */
    public void sendSystemAlert(String instituteId, String title, String message, String priority) {
        log.info("Sending system alert to institute: {} with priority: {}", instituteId, priority);
        
        AnnouncementEvent event = AnnouncementEvent.builder()
                .type(EventType.SYSTEM_ALERT)
                .instituteId(instituteId)
                .data(new SystemAlertData(title, message))
                .priority(priority)
                .persistent(true)
                .build();
        
        broadcastToInstitute(instituteId, event);
    }
    
    /**
     * Send dashboard pin event
     */
    public void sendDashboardPinEvent(String announcementId, EventType eventType, Object pinData) {
        log.debug("Sending dashboard pin event {} for announcement: {}", eventType, announcementId);
        
        AnnouncementEvent event = new AnnouncementEvent(eventType, announcementId, pinData);
        event.setModeType(vacademy.io.notification_service.features.announcements.enums.ModeType.DASHBOARD_PIN);
        sendToAnnouncementRecipients(announcementId, event);
    }
    
    /**
     * Send message interaction event
     */
    public void sendMessageInteractionEvent(String messageId, String userId, EventType eventType, Object data) {
        log.debug("Sending message interaction event {} for message: {} by user: {}", 
                eventType, messageId, userId);
        
        AnnouncementEvent event = AnnouncementEvent.builder()
                .type(eventType)
                .targetUserId(userId)
                .data(data)
                .build();
        
        // Send to message recipients (for read receipts, etc.)
        sendToMessageRecipients(messageId, event);
    }
    
    /**
     * Send task status change event
     */
    public void sendTaskStatusChangeEvent(String announcementId, String taskId, String oldStatus, 
                                        String newStatus, Object taskData) {
        log.info("Sending task status change event: {} -> {} for task: {}", 
                oldStatus, newStatus, taskId);
        
        TaskStatusChangeData data = new TaskStatusChangeData(taskId, oldStatus, newStatus, taskData);
        
        AnnouncementEvent event = AnnouncementEvent.builder()
                .type(EventType.TASK_STATUS_CHANGED)
                .announcementId(announcementId)
                .data(data)
                .priority("HIGH")
                .persistent(true)
                .build();
        event.setModeType(vacademy.io.notification_service.features.announcements.enums.ModeType.TASKS);
        
        sendToTaskRecipients(announcementId, event);
    }
    
    /**
     * Send task reminder event
     */
    public void sendTaskReminderEvent(String announcementId, String taskId, String taskTitle, 
                                    int minutesUntilDeadline) {
        log.info("Sending task reminder for task: {} ({} minutes until deadline)", 
                taskId, minutesUntilDeadline);
        
        TaskReminderData data = new TaskReminderData(taskId, taskTitle, minutesUntilDeadline);
        
        AnnouncementEvent event = AnnouncementEvent.builder()
                .type(EventType.TASK_REMINDER)
                .announcementId(announcementId)
                .data(data)
                .priority("HIGH")
                .persistent(true)
                .build();
        event.setModeType(vacademy.io.notification_service.features.announcements.enums.ModeType.TASKS);
        
        sendToTaskRecipients(announcementId, event);
    }
    
    /**
     * Get connection statistics
     */
    public SSEConnectionManager.ConnectionStats getConnectionStats() {
        return connectionManager.getConnectionStats();
    }
    
    // Data classes for specific event types
    
    public static class SystemAlertData {
        private final String title;
        private final String message;
        
        public SystemAlertData(String title, String message) {
            this.title = title;
            this.message = message;
        }
        
        public String getTitle() { return title; }
        public String getMessage() { return message; }
    }
    
    public static class TaskStatusChangeData {
        private final String taskId;
        private final String oldStatus;
        private final String newStatus;
        private final Object taskData;
        
        public TaskStatusChangeData(String taskId, String oldStatus, String newStatus, Object taskData) {
            this.taskId = taskId;
            this.oldStatus = oldStatus;
            this.newStatus = newStatus;
            this.taskData = taskData;
        }
        
        public String getTaskId() { return taskId; }
        public String getOldStatus() { return oldStatus; }
        public String getNewStatus() { return newStatus; }
        public Object getTaskData() { return taskData; }
    }
    
    public static class TaskReminderData {
        private final String taskId;
        private final String taskTitle;
        private final int minutesUntilDeadline;
        
        public TaskReminderData(String taskId, String taskTitle, int minutesUntilDeadline) {
            this.taskId = taskId;
            this.taskTitle = taskTitle;
            this.minutesUntilDeadline = minutesUntilDeadline;
        }
        
        public String getTaskId() { return taskId; }
        public String getTaskTitle() { return taskTitle; }
        public int getMinutesUntilDeadline() { return minutesUntilDeadline; }
    }
}
