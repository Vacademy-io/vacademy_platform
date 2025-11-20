package vacademy.io.admin_core_service.features.system_files.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Getter
@Setter
public class EntityAccessDTO {
    private String id;
    private String accessType;  // view, edit
    private String level;       // user, batch, institute, role
    private String levelId;
}
