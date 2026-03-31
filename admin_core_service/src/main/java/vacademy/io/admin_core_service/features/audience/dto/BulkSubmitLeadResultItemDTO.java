package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Per-row result for bulk lead submission.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class BulkSubmitLeadResultItemDTO {

    private int index;

    /**
     * SUCCESS / FAILED / SKIPPED
     */
    private String status;

    private String message;

    private String audienceResponseId;

    private String userId;
}
