package vacademy.io.admin_core_service.features.module.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
public class ModuleDTO {
    private String id;
    private String moduleName;
    private String status;
    private String description;
    private String thumbnailId;
}
