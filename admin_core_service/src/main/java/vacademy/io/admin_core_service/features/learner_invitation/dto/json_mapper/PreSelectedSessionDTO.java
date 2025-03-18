package vacademy.io.admin_core_service.features.learner_invitation.dto.json_mapper;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import java.util.List;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class PreSelectedSessionDTO {
    private Boolean instituteAssigned;
    private Integer maxSelectableLevels;
    private String name;
    private String id;
    private List<LevelSelectionDTO>preSelectedLevels;
    private List<LevelSelectionDTO>learnerChoiceLevels;
}
