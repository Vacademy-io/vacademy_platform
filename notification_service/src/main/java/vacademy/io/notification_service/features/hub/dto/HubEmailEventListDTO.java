package vacademy.io.notification_service.features.hub.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * Paginated drill-down for a hub email stat tile: the individual emails behind the
 * Delivered / Opened / Clicked / Bounced / Complained counts.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HubEmailEventListDTO {

    /** DELIVERY | OPEN | CLICK | BOUNCE | COMPLAINT */
    private String eventType;
    private int page;
    private int size;
    private long totalElements;
    private int totalPages;
    private List<Item> content;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Item {
        /** EMAIL_EVENT log id. */
        private String id;
        /** Parent EMAIL log id (notification_log.source) — joinable to email tracking APIs. */
        private String emailLogId;
        private String recipient;
        /** Subject parsed from the SES event headers; null when SES omitted them. */
        private String subject;
        private Instant timestamp;
        // Event-specific details parsed from the event body (null when absent):
        private String bounceType;
        private String bounceSubType;
        private String clickedLink;
        private String ipAddress;
        private String userAgent;
        private String complaintType;
    }
}
