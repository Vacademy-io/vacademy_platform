package vacademy.io.admin_core_service.features.institute_pulse.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Institute-wide live feed: content events and live-class joins, interleaved, newest first. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InstitutePulseFeedResponse {

    private List<FeedEvent> events;

    private int windowMinutes;

    /**
     * More events exist in the window than were returned.
     *
     * <p>The feed grows its limit rather than paging by offset. A time-ordered live feed shifts
     * as new events arrive, so offset paging would duplicate or skip rows between polls; asking
     * for a larger newest-N is always internally consistent.
     */
    private boolean hasMore;

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
        /** CONTENT or LIVE_CLASS. */
        private String rail;
        private String eventType;
        private String detail;

        /** HOST when the actor was hosting the class, else null. */
        private String actorRole;
    }
}
