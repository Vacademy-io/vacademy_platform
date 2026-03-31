package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SendAudienceMessageResponseDTO {

    private String communicationId;
    private int recipientCount;
    private int accepted;
    private int failed;
    private String batchId;
    private String status;  // COMPLETED, PROCESSING, PARTIAL, FAILED
}
