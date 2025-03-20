package vacademy.io.admin_core_service.features.learner_invitation.dto.json_mapper;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import java.util.List;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class LearnerChoiceSessionDTO {
    private Integer maxSelectableLevels;
    private String id;
    private String name;
    private List<LevelSelectionDTO>learnerChoiceLevels;
}
