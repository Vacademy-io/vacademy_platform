package vacademy.io.admin_core_service.features.student_analysis.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for student login statistics from auth service
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentLoginStatsDto {
        private Integer totalLogins;
        private String lastLoginTime;
        private Double avgSessionDurationMinutes;
        private Long totalActiveTimeMinutes;
}
