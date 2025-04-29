package vacademy.io.admin_core_service.features.learner_invitation.dto.json_mapper;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import java.util.List;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class LearnerChoicePackageDTO {
    private List<LearnerChoiceSessionDTO> learnerChoiceSessions;
    private Integer maxSelectableSessions;
    private String id;
    private String name;
}
