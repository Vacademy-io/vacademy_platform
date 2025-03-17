package vacademy.io.admin_core_service.features.learner_invitation.dto.json_mapper;

import java.util.List;

public class PreselectedPackageDTO {
    private Boolean instituteAssigned;
    private Integer maxSelectableSessions;
    private String name;
    private List<PreSelectedSessionDTO> preSelectedSessionDTOS;
    private List<LearnerChoiceSessionDTO>learnerChoiceSessions;
}
