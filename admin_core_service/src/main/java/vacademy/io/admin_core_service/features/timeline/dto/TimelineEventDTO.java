package vacademy.io.admin_core_service.features.timeline.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.timeline.enums.TimelineCategory;

import java.sql.Timestamp;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class TimelineEventDTO {
        private String id;
        private String type;
        private String typeId;
        private String actionType;
        private String actorType;
        private String actorId;
        private String actorName;
        private String title;
        private String description;
        private Object metadata;
        private Boolean isPinned;
        private String studentUserId;
        /** JOURNEY = lifecycle event, ACTIVITY = manual note/call/meeting */
        private TimelineCategory category;
        /** Serialised by Jackson with the timezone offset (e.g. "2026-05-23T03:33:36.590+00:00").
         *  Frontend parses the offset directly so the same DB row renders the same wall-clock
         *  time in the lead-name subtitle (driven by the leads endpoint) and the Activity column
         *  (driven by this endpoint) — they must agree. */
        private Timestamp createdAt;
}
