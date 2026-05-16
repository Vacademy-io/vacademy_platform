package vacademy.io.notification_service.features.hub.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HubOverviewDTO {

    private int windowDays;

    private EmailStats email;
    private WhatsAppStats whatsapp;
    private BatchStats batches;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EmailStats {
        /** Institute has at least one configured sender email. */
        private boolean configured;
        /** Institute has at least one active inbound email mapping (SES → S3 → SQS wired). */
        private boolean inboundConfigured;
        private long sent;
        private long delivered;
        private long opened;
        private long clicked;
        private long bounced;
        private long complained;
        private long inbound;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WhatsAppStats {
        /** Institute has at least one channel-to-institute mapping. */
        private boolean configured;
        private long outgoing;
        private long incoming;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BatchStats {
        private long active;       // QUEUED + PROCESSING
        private long completedInWindow;
    }
}
