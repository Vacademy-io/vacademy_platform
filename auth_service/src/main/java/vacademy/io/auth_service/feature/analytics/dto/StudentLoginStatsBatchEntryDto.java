package vacademy.io.auth_service.feature.analytics.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Per-user login/activity stats within the requested window.
 * Present in the batch response only for users that had any activity.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentLoginStatsBatchEntryDto {
        private String lastLoginAt; // ISO-8601 instant (UTC) or null
        private Long loginCount;
        private Long totalActivityMinutes;
}
