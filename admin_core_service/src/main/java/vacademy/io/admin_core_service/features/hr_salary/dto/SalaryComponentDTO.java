package vacademy.io.admin_core_service.features.hr_salary.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SalaryComponentDTO {

    private String id;
    private String instituteId;
    private String name;
    private String code;
    private String type;
    private String category;
    private Boolean isTaxable;
    private Boolean isStatutory;
    private Boolean isActive;
    private Integer displayOrder;
    private String description;
}
