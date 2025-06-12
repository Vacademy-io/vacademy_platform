package vacademy.io.admin_core_service.features.learner_invitation.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
@Builder
public class LearnerInvitationCustomFieldDTO {
    private String id;
    private String fieldName;
    private String fieldType;
    private String defaultValue;
    private String description;
    private Boolean isMandatory = true;
    private String commaSeparatedOptions;
    private String status;
    private Integer fieldOrder;
}
