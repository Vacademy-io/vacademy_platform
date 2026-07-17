package vacademy.io.auth_service.feature.analytics.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Response body for the batched student login stats internal endpoint.
 * byUserId contains an entry ONLY for users with any activity in the window;
 * absence of a userId means "no data".
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentLoginStatsBatchResponseDto {
        private Map<String, StudentLoginStatsBatchEntryDto> byUserId;
}
