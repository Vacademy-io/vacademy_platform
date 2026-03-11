package vacademy.io.admin_core_service.features.hr_employee.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class DepartmentDTO {

    private String id;
    private String name;
    private String code;
    private String parentId;
    private String headUserId;
    private String description;
    private String status;
    private List<DepartmentDTO> children;
}
