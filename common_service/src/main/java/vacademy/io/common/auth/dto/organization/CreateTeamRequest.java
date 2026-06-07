package vacademy.io.common.auth.dto.organization;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CreateTeamRequest {
    private String instituteId;
    private String parentId;     // null = root vertical
    private String name;
    private String description;
    private Integer sortOrder;
}
