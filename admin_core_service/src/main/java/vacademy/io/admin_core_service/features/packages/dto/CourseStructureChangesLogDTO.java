package vacademy.io.admin_core_service.features.packages.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.sql.Timestamp;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CourseStructureChangesLogDTO {
    private String id;
    private String userId;
    private String sourceId;
    private String sourceType;
    private String parentId;
    private String jsonData;
    private String status;
}
