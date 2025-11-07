package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;
import vacademy.io.common.auth.dto.UserDTO;

/**
 * DTO for submitting a lead from website form
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SubmitLeadRequestDTO {

    private String audienceId;
    private String sourceType; // WEBSITE (for now)
    private String sourceId; // Landing page ID, form URL, etc.
    
    // Custom field values
    // Key: fieldKey (e.g., "email", "phone"), Value: submitted value
    private Map<String, String> customFieldValues;

    // Optional direct user payload; if provided, it takes precedence over custom fields
    private UserDTO userDTO;
}

