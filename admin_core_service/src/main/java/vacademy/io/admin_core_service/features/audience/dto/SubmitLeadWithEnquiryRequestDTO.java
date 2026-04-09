package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
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

    @Size(max = 255, message = "Source type must not exceed 255 characters")
    private String sourceType;

    @Size(max = 255, message = "Source ID must not exceed 255 characters")
    private String sourceId;

    // Custom field values
    // Key: fieldKey (e.g., "email", "phone"), Value: submitted value
    private Map<String, String> customFieldValues;

    // Parent and child user payloads (REQUIRED)
    @Valid
    private UserDTO parentUserDTO;

    @Valid
    private UserDTO childUserDTO;

    // New AudienceResponse fields
    private String destinationPackageSessionId;

    @Size(max = 255, message = "Parent name must not exceed 255 characters")
    private String parentName;

    @Email(message = "Parent email must be a valid email address")
    @Size(max = 320, message = "Parent email must not exceed 320 characters")
    private String parentEmail;

    @Size(max = 15, message = "Parent mobile must not exceed 15 characters")
    private String parentMobile;

    // Counsellor assignment (optional)
    private String counsellorId;

    /**
     * Optional CSV-friendly alias.
     * If provided and {@link #enquiry} is null (or enquiry_status is missing),
     * bulk/single-row handlers can map this into {@code enquiry.enquiry_status}.
     */
    private String status;

    /**
     * Optional CSV-friendly alias.
     * If provided and {@link #sourceType} is null/blank, handler can map this into {@code source_type}.
     */
    private String source;

    // Enquiry Data
    @Valid
    private EnquiryDTO enquiry;
}
