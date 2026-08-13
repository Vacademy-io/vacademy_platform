package vacademy.io.admin_core_service.features.learner_offline.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

/**
 * One offline event in a POST .../offline-sync/v1/batch request (offline
 * plan, Part A4). {@code payload} deliberately stays a raw JsonNode here --
 * OfflineSyncEventProcessor converts it to the matching ActivityLogDTO shape
 * only once it knows eventType, since each type expects a different subset
 * of ActivityLogDTO's fields populated (documents/videos/audios/questionSlides
 * /quizSides/assignmentSlides), or (for DOWNLOAD_STATE) a small unrelated
 * shape entirely.
 */
@Getter
@Setter
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class OfflineSyncEventRequestDTO {
    private String clientEventId;
    private Long seq;
    private Long clientTs;
    private String eventType;
    private String slideId;
    private String chapterId;
    private String moduleId;
    private String subjectId;
    private String packageSessionId;
    private JsonNode payload;
}
