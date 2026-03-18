package vacademy.io.admin_core_service.features.hr_attendance.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.time.LocalDate;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class HolidayDTO {

    private String id;
    private String instituteId;
    private String name;
    private LocalDate date;
    private String type;
    private Boolean isOptional;
    private Integer maxOptionalAllowed;
    private Integer year;
    private String description;
}
