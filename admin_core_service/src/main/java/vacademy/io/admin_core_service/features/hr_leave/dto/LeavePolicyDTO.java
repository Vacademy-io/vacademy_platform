package vacademy.io.admin_core_service.features.hr_leave.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LeavePolicyDTO {

    private String id;
    private String instituteId;
    private String leaveTypeId;
    private String leaveTypeName;
    private BigDecimal annualQuota;
    private String accrualType;
    private BigDecimal accrualAmount;
    private Boolean proRataEnabled;
    private Integer applicableAfterDays;
    private List<String> applicableEmploymentTypes;
    private LocalDate effectiveFrom;
    private LocalDate effectiveTo;
    private String status;
}
