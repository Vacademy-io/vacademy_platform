package vacademy.io.admin_core_service.features.hr_tax.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class TaxComputationDTO {

    private String id;
    private String employeeId;
    private String financialYear;
    private Integer month;
    private Integer year;
    private BigDecimal projectedAnnualIncome;
    private BigDecimal projectedAnnualTax;
    private BigDecimal projectedMonthlyTax;
    private BigDecimal actualIncomeTillDate;
    private BigDecimal actualTaxDeducted;
    private BigDecimal totalExemptions;
    private BigDecimal totalDeductions80c;
    private Map<String, Object> computationDetails;
}
