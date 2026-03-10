package vacademy.io.admin_core_service.features.hr_salary.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class EmployeeSalaryComponentDTO {

    private String id;
    private String componentId;
    private String componentName;
    private String componentCode;
    private String componentType;
    private BigDecimal monthlyAmount;
    private BigDecimal annualAmount;
    private String calculationType;
    private BigDecimal percentageValue;
    private Boolean isOverridden;
}
