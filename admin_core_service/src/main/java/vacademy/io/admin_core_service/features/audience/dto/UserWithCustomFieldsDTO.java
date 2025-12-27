package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.Map;

/**
 * Response DTO containing complete user details with custom fields
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class UserWithCustomFieldsDTO {
    
    /**
     * Complete user details from auth service
     */
    private UserDTO user;
    
    /**
     * Custom field values associated with this user
     * Key: field_key (e.g., "Phone Number", "Full Name")
     * Value: field value (e.g., "+916263442911", "raj")
     */
    private Map<String, String> customFields;
}
