package vacademy.io.admin_core_service.features.super_admin.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class PlatformDashboardDTO {
    private Long totalInstitutes;
    private Long totalStudents;
    private Long totalCourses;
    private Long totalBatches;
    private Long institutesCreatedThisMonth;
    private Long studentsEnrolledThisMonth;
}
