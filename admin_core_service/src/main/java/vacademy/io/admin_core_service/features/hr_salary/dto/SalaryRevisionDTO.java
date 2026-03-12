package vacademy.io.admin_core_service.features.hr_salary.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SalaryRevisionDTO {

    private String id;
    private String employeeId;
    private String employeeCode;
    private BigDecimal oldCtc;
    private BigDecimal newCtc;
    private BigDecimal incrementPct;
    private String reason;
    private LocalDate effectiveDate;
    private String oldStructureId;
    private String newStructureId;
}
