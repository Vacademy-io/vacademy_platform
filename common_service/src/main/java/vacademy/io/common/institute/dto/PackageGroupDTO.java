package vacademy.io.common.institute.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class PackageGroupDTO {
    private GroupDTO group;
    private PackageDTO packageDTO;
    private String id;
}
