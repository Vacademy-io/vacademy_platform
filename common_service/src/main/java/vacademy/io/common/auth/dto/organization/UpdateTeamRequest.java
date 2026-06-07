package vacademy.io.common.auth.dto.organization;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

/**
 * All fields optional. Set {@code moveParent=true} to indicate the request
 * intends to change parent_id (parent_id=null with moveParent=true means
 * "move to root"). Leaving moveParent off keeps the existing parent.
 */
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class UpdateTeamRequest {
    private String name;
    private String description;
    private Integer sortOrder;
    private Boolean moveParent;
    private String parentId;
}
