package vacademy.io.admin_core_service.features.hr_attendance.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalTime;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ShiftDTO {

    private String id;
    private String instituteId;
    private String name;
    private String code;
    private LocalTime startTime;
    private LocalTime endTime;
    private Integer breakDurationMin;
    private Boolean isNightShift;
    private Integer gracePeriodMin;
    private BigDecimal minHoursFullDay;
    private BigDecimal minHoursHalfDay;
    private Boolean isDefault;
    private String status;
}
