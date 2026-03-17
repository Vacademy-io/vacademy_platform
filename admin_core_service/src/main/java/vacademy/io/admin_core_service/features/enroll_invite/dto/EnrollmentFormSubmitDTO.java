package vacademy.io.admin_core_service.features.enroll_invite.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerExtraDetails;
import vacademy.io.common.common.dto.CustomFieldValueDTO;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class EnrollmentFormSubmitDTO {
    private String enrollInviteId;
    private String instituteId;
    private List<String> packageSessionIds;
    private UserDTO userDetails;
    private LearnerExtraDetails learnerExtraDetails;
    private List<CustomFieldValueDTO> customFieldValues;
}
