package vacademy.io.notification_service.features.email_tracking.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Response DTO for user-centric email tracking
 * Shows all emails sent to a user with their latest tracking status
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserEmailTrackingResponse {
    
    /**
     * Original email log ID
     */
    private String emailId;
    
    /**
     * Email address where the email was sent
     */
    private String recipientEmail;
    
    /**
     * User ID associated with the email
     */
    private String userId;
    
    /**
     * Email subject/body preview
     */
    private String emailSubject;
    
    /**
     * Source of the email (e.g., "announcement-service", "email-service")
     */
    private String source;
    
    /**
     * Source ID (e.g., announcement ID)
     */
    private String sourceId;
    
    /**
     * When the email was sent
     */
    private LocalDateTime sentAt;
    
    /**
     * Latest tracking status for this email
     */
    private EmailTrackingStatus latestStatus;
    
    /**
     * Nested class for tracking status details
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EmailTrackingStatus {
        
        /**
         * Event type: delivered, opened, clicked, bounced, complaint, pending
         */
        private String eventType;
        
        /**
         * Timestamp of the latest event
         */
        private LocalDateTime eventTimestamp;
        
        /**
         * Additional event details
         */
        private String eventDetails;
        
        /**
         * For bounce: bounce type and subtype
         */
        private String bounceType;
        private String bounceSubType;
        
        /**
         * For click: the link that was clicked
         */
        private String clickedLink;
        
        /**
         * For open/click: IP address and user agent
         */
        private String ipAddress;
        private String userAgent;
        
        /**
         * For complaint: feedback type
         */
        private String complaintFeedbackType;
    }
}


