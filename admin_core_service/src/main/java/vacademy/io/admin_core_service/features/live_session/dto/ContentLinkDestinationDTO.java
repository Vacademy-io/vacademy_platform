package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ContentLinkDestinationDTO {
    private String packageSessionId;
    private String chapterId;
    private String moduleId;
    private String subjectId;
}
