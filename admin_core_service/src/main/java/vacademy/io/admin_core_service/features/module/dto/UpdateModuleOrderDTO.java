package vacademy.io.admin_core_service.features.module.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class UpdateModuleOrderDTO {
    private String subjectId;
    private String moduleId;
    private Integer moduleOrder;
}
