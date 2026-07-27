package vacademy.io.admin_core_service.features.course_pulse.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Live Feed payload: recent events, newest first, capped by a time window and row limit.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PulseFeedResponse {

    private List<FeedEvent> events;
    private int windowMinutes;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FeedEvent {
        private long occurredAtEpoch;
        private String userId;
        private String fullName;
        private String slideId;
        private String slideTitle;
        private String slideType;
        private String eventType;
        private String detail;
    }
}
