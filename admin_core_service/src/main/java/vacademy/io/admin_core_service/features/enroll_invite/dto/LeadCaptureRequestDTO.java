package vacademy.io.admin_core_service.features.enroll_invite.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerExtraDetails;
import vacademy.io.common.common.dto.CustomFieldValueDTO;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LeadCaptureRequestDTO {
    private String instituteId;
    private String enrollInviteId;
    private String inviteCode;
    private List<String> packageSessionIds;
    private UserDTO userDetails;
    private List<CustomFieldValueDTO> customFieldValues;
    private LearnerExtraDetails learnerExtraDetails;
    private Map<String, Object> extraData;
}
