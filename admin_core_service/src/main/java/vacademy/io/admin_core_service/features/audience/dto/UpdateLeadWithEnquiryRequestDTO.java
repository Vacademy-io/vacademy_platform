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
 * DTO for updating an existing lead with enquiry information
 * All fields are optional - only provided fields will be updated
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class UpdateLeadWithEnquiryRequestDTO {

    // Parent user updates (optional)
    private UserDTO parentUserDTO;

    // Child user updates (optional)
    private UserDTO childUserDTO;

    // Enquiry updates (optional)
    private EnquiryDTO enquiry;

    // Custom field values updates (optional)
    // Upsert strategy: updates existing fields, adds new ones, keeps others
    private Map<String, String> customFieldValues;

    // Audience response field updates (optional)
    private String destinationPackageSessionId;
    private String parentName;
    private String parentEmail;
    private String parentMobile;

    // Counsellor assignment update (optional)
    // null = skip update, "" = skip update, valid ID = update counselor
    private String counsellorId;
}
