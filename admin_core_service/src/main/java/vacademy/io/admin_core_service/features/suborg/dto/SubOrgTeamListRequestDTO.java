package vacademy.io.admin_core_service.features.suborg.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SubOrgTeamListRequestDTO {
    private String subOrgId;
    private String instituteId;
    private List<String> roles;
    private List<String> status;
    private String name;
    private Integer pageNumber = 0;
    private Integer pageSize = 10;
}
