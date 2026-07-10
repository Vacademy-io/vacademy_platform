package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Per-destination result of a link request.
 * outcome: CREATED | ALREADY_LINKED | SHARED_CHAPTER_DEDUPED
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ContentLinkOutcomeDTO {
    private String packageSessionId;
    private String chapterId;
    private String outcome;
    private String slideId;
    private String message;
}
