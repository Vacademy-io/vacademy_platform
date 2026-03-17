package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for FormWebhookConnector
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class FormWebhookConnectorDTO {
    
    private String id;
    private String vendor;
    private String vendorId;
    private String instituteId;
    private String audienceId;
    private String type;
    private String sampleMapJson;
    private Boolean isActive;
}
