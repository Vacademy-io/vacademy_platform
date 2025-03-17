package vacademy.io.admin_core_service.features.learner_invitation.dto.json_mapper;

import java.util.List;

public class PreSelectedSessionDTO {
    private Boolean instituteAssigned;
    private Integer maxSelectableLevels;
    private String name;
    private List<LevelSelectionDTO>preSelectedLevels;
    private List<LevelSelectionDTO>learnerChoiceLevels;
}
