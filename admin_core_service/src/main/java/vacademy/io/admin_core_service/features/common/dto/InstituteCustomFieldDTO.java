package vacademy.io.admin_core_service.features.common.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class InstituteCustomFieldDTO {
    private String id;

    private String instituteId;

    private String type; // e.g., "session"

    private String typeId; // session id

    private String groupName;

    private CustomFieldDTO customField;

    private String status;
}
