package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;
import java.util.Map;
import vacademy.io.common.auth.dto.UserDTO;

/**
 * DTO for detailed lead information with custom field values
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LeadDetailDTO {

    private String responseId;
    private String audienceId;
    private String campaignName;
    private String userId;
    private String sourceType;
    private String sourceId;
    private Timestamp submittedAtLocal;
    
    // Optional hydrated user details (batch fetched)
    private UserDTO user;
    
    // Custom field values with field metadata
    // Key: fieldKey (e.g., "email", "phone"), Value: submitted value
    private Map<String, String> customFieldValues;
    
    // Additional metadata
    private Map<String, Object> customFieldMetadata; // fieldKey -> {fieldName, fieldType, etc.}
}

