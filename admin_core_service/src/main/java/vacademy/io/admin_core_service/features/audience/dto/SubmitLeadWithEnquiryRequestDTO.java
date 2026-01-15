package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.enquiry.dto.EnquiryDTO;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.Map;

/**
 * DTO for submitting a lead with enquiry information
 * Combines audience response and enquiry data
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SubmitLeadWithEnquiryRequestDTO {

    // Audience & Lead Info (from SubmitLeadRequestDTO)
    private String audienceId;
    private String sourceType; // WEBSITE, GOOGLE_ADS, etc.
    private String sourceId; // Landing page ID, form URL, etc.
    
    // Custom field values
    // Key: fieldKey (e.g., "email", "phone"), Value: submitted value
    private Map<String, String> customFieldValues;

    // Optional direct user payload
    private UserDTO userDTO;
    
    // New AudienceResponse fields
    private String destinationPackageSessionId;
    private String parentName;
    private String parentEmail;
    private String parentMobile;
    
    // Enquiry Data
    private EnquiryDTO enquiry;
}
