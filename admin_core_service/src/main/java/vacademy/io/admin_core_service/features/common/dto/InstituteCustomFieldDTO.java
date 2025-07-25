package vacademy.io.admin_core_service.features.common.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.persistence.Column;
import lombok.Data;

import java.sql.Date;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class InstituteCustomFieldDTO {
    private String id;

    private String instituteId;

    private String type; // e.g., "session"

    private String typeId; // session id

    private CustomFieldDTO customField;
}
