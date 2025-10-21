package vacademy.io.notification_service.features.email_tracking.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Request DTO for querying user email tracking
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserEmailTrackingRequest {
    
    /**
     * User ID to filter emails (optional if email is provided)
     */
    private String userId;
    
    /**
     * Email address to filter (optional if userId is provided)
     */
    private String email;
    
    /**
     * Filter by source (e.g., "announcement-service")
     */
    private String source;
    
    /**
     * Filter by source ID (e.g., specific announcement ID)
     */
    private String sourceId;
    
    /**
     * Filter by date range - start date
     */
    private LocalDateTime fromDate;
    
    /**
     * Filter by date range - end date
     */
    private LocalDateTime toDate;
    
    /**
     * Filter by latest event type
     */
    private String eventType;
    
    /**
     * Page number (0-indexed)
     */
    @Builder.Default
    private Integer page = 0;
    
    /**
     * Page size
     */
    @Builder.Default
    private Integer size = 20;
}

