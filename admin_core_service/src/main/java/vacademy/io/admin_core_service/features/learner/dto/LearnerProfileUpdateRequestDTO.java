package vacademy.io.admin_core_service.features.learner.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.admin_core_service.features.common.dto.request.CustomFieldValueDto;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerExtraDetails;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LearnerProfileUpdateRequestDTO {
    private LearnerExtraDetails learnerExtraDetails;
    private UserDTO userDetails;
    private List<CustomFieldValueDto> customFieldValues;
}

