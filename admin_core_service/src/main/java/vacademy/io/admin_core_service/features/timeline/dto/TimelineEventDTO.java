package vacademy.io.admin_core_service.features.timeline.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.timeline.enums.TimelineCategory;

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
        /** ISO-8601 without timezone offset — raw value from DB (e.g. "2026-05-23T09:03:36.590"). Frontend adds IST offset. */
        private String createdAt;
}
