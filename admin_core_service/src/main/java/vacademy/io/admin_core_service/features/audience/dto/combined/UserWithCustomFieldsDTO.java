package vacademy.io.admin_core_service.features.audience.dto.combined;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.List;

/**
 * DTO for user with custom fields
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class UserWithCustomFieldsDTO {

    // Complete user information
    private UserDTO user;
    
    // Source tracking
    private Boolean isInstituteUser;
    private Boolean isAudienceRespondent;
    
    // All custom fields for this user
    private List<CustomFieldDTO> customFields;
}
