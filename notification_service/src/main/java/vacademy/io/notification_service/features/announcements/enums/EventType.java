package vacademy.io.notification_service.features.announcements.enums;

/**
 * Defines the types of real-time events that can be sent via Server-Sent Events (SSE)
 */
public enum EventType {
    /**
     * A new announcement has been created and sent to users
     */
    NEW_ANNOUNCEMENT,
    
    /**
     * A task's status has changed (DRAFT → SCHEDULED → LIVE → OVERDUE/COMPLETED)
     */
    TASK_STATUS_CHANGED,
    
    /**
     * A reminder for an upcoming task deadline
     */
    TASK_REMINDER,
    
    /**
     * A new dashboard pin has been added
     */
    DASHBOARD_PIN_ADDED,
    
    /**
     * A dashboard pin has expired or been removed
     */
    DASHBOARD_PIN_REMOVED,
    
    /**
     * A high-priority system alert
     */
    SYSTEM_ALERT,
    
    /**
     * A message has been marked as read
     */
    MESSAGE_READ,
    
    /**
     * A message has been dismissed by the user
     */
    MESSAGE_DISMISSED,
    
    /**
     * A new reply has been added to a message
     */
    MESSAGE_REPLY_ADDED,
    
    /**
     * An announcement has been updated (content, settings, etc.)
     */
    ANNOUNCEMENT_UPDATED,
    
    /**
     * A scheduled announcement has been cancelled
     */
    ANNOUNCEMENT_CANCELLED,
    
    /**
     * Heartbeat event to keep SSE connections alive
     */
    HEARTBEAT
}
