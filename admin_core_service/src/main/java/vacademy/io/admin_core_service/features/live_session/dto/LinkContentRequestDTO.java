package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;

/**
 * Body for POST /admin-core-service/live-sessions/content/link.
 * slide_status: PUBLISHED | DRAFT. position: TOP | BOTTOM.
 */
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LinkContentRequestDTO {
    private String sessionId;
    private String scheduleId;
    private ContentLinkSourceDTO source;
    private String title;
    private String description;
    private String slideStatus;
    private boolean notify;
    private String position;
    private List<ContentLinkDestinationDTO> destinations;
}
