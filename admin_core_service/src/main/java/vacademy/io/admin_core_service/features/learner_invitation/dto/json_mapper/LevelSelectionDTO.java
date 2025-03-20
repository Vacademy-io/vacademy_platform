package vacademy.io.admin_core_service.features.learner_invitation.dto.json_mapper;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class LevelSelectionDTO {
    private String id;
    private String name;
    private String packageSessionId;
}
