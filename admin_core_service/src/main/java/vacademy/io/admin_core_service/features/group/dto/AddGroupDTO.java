package vacademy.io.admin_core_service.features.group.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class AddGroupDTO {
    private String id;
    private String groupName;
    private String groupValue;
    private boolean isNewGroup;
}
