package vacademy.io.auth_service.feature.analytics.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Request body for the batched student login stats internal endpoint.
 * userIds is required (max 500); sinceDays is optional and defaults to 30.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentLoginStatsBatchRequestDto {
        private List<String> userIds;
        private Integer sinceDays;
}
