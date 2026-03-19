package vacademy.io.admin_core_service.features.hr_leave.dto;

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
public class LeaveTypeDTO {

    private String id;
    private String instituteId;
    private String name;
    private String code;
    private Boolean isPaid;
    private Boolean isCarryForward;
    private Integer maxCarryForward;
    private Boolean isEncashable;
    private Boolean requiresDocument;
    private BigDecimal minDays;
    private Integer maxConsecutiveDays;
    private String applicableGender;
    private String description;
    private String status;
}
