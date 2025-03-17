package vacademy.io.admin_core_service.features.learner_invitation.dto.json_mapper;

import java.util.List;

public class BatchSelectionDTO {
    private Boolean instituteAssigned;
    private Integer maxSelectablePackages;
    private List<PreselectedPackageDTO>preSelectedPackages;
    private List<LearnerChoicePackageDTO>learnerChoicePackages;
}
