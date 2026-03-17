package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Response DTO for update lead with enquiry operation
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class UpdateLeadWithEnquiryResponseDTO {

    private String audienceResponseId;
    private UUID enquiryId;
    private String parentUserId;
    private String childUserId;
    private String counsellorId;
    private String message;

    // Track which components were updated
    private Map<String, Object> updatedFields;
}
