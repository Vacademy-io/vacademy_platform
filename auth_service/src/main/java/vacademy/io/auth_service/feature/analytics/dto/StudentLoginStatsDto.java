package vacademy.io.auth_service.feature.analytics.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for student login statistics within a date range
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentLoginStatsDto {
        private Integer totalLogins;
        private String lastLoginTime; // ISO 8601 format
        private Double avgSessionDurationMinutes;
        private Long totalActiveTimeMinutes;
}
