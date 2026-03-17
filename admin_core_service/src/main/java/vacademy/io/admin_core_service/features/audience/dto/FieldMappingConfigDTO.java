package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * DTO for field mapping configuration
 * Used to map form provider field names to standardized user fields
 * 
 * Example:
 * Form has: "Email", "Primary Email", "E-mail"
 * All should map to: "email"
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class FieldMappingConfigDTO {
    
    /**
     * Map of form field names to standardized field names
     * Key: Field name from form (e.g., "Email", "Primary Email")
     * Value: Standardized field name (e.g., "email")
     * 
     * Example:
     * {
     *   "Email": "email",
     *   "Primary Email": "email",
     *   "Full Name": "fullName",
     *   "Phone Number": "phoneNumber",
     *   "Mobile": "phoneNumber"
     * }
     */
    private Map<String, String> fieldMapping;
    
    /**
     * Get mapped field name
     * @param formFieldName Field name from the form
     * @return Standardized field name, or null if not mapped
     */
    public String getMappedFieldName(String formFieldName) {
        if (fieldMapping == null) {
            return null;
        }
        return fieldMapping.get(formFieldName);
    }
    
    /**
     * Check if a field is mapped
     * @param formFieldName Field name from the form
     * @return true if mapped, false otherwise
     */
    public boolean isMapped(String formFieldName) {
        return fieldMapping != null && fieldMapping.containsKey(formFieldName);
    }
}
