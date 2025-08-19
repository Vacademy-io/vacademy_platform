package vacademy.io.notification_service.features.announcements.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.notification_service.features.announcements.enums.EventType;
import vacademy.io.notification_service.features.announcements.enums.ModeType;

import java.time.LocalDateTime;

/**
 * Represents a real-time event that will be sent to users via Server-Sent Events (SSE)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AnnouncementEvent {
    
    /**
     * Type of the event
     */
    private EventType type;
    
    /**
     * ID of the user this event is targeted to (optional for broadcast events)
     */
    private String targetUserId;
    
    /**
     * ID of the announcement this event relates to
     */
    private String announcementId;
    
    /**
     * Mode type this event pertains to (SYSTEM_ALERT, DASHBOARD_PIN, DM, STREAM, RESOURCES, COMMUNITY, TASKS)
     */
    private ModeType modeType;
    
    /**
     * ID of the institute this event belongs to
     */
    private String instituteId;
    
    /**
     * The main data payload of the event (can be any object)
     */
    private Object data;
    
    /**
     * Additional metadata about the event
     */
    private Object metadata;
    
    /**
     * When this event was created
     */
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime timestamp;
    
    /**
     * Priority level of the event (HIGH, MEDIUM, LOW)
     */
    private String priority;
    
    /**
     * Whether this event should be persisted for offline users
     */
    private boolean persistent;
    
    /**
     * Event ID for tracking and deduplication
     */
    private String eventId;
    
    /**
     * Constructor for simple events
     */
    public AnnouncementEvent(EventType type, String announcementId, Object data) {
        this.type = type;
        this.announcementId = announcementId;
        this.data = data;
        this.timestamp = LocalDateTime.now();
        this.eventId = generateEventId();
        this.priority = "MEDIUM";
        this.persistent = true;
    }
    
    /**
     * Constructor for user-specific events
     */
    public AnnouncementEvent(EventType type, String targetUserId, String announcementId, Object data) {
        this.type = type;
        this.targetUserId = targetUserId;
        this.announcementId = announcementId;
        this.data = data;
        this.timestamp = LocalDateTime.now();
        this.eventId = generateEventId();
        this.priority = "MEDIUM";
        this.persistent = true;
    }
    
    /**
     * Generate a unique event ID
     */
    private String generateEventId() {
        return type + "_" + System.currentTimeMillis() + "_" + Math.random();
    }
    
    /**
     * Create a heartbeat event
     */
    public static AnnouncementEvent heartbeat() {
        return AnnouncementEvent.builder()
                .type(EventType.HEARTBEAT)
                .timestamp(LocalDateTime.now())
                .priority("LOW")
                .persistent(false)
                .eventId("heartbeat_" + System.currentTimeMillis())
                .build();
    }
}
