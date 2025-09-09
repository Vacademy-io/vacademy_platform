package vacademy.io.admin_core_service.features.institute_learner.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class InstituteCustomFieldSetupDTO {
    private String customFieldId;
    private String fieldKey;
    private String fieldName;
    private String fieldType;
    private Integer formOrder;
    private Boolean isHidden;
    private String groupName;
    private String type;
    private String typeId;
    private String status;
}
