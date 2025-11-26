package vacademy.io.admin_core_service.features.institute_learner.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class CustomFieldFilterRequest {
    @NotBlank(message = "Institute ID is required")
    private String instituteId;
    
    @NotEmpty(message = "At least one filter is required")
    @Valid
    private List<CustomFieldFilter> filters;
    
    private List<String> statuses; // Optional: filter by student statuses
    
    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    public static class CustomFieldFilter {
        @Size(max = 255, message = "Custom field ID must not exceed 255 characters")
        private String customFieldId; // Custom field ID (preferred)
        
        @Size(max = 255, message = "Field name must not exceed 255 characters")
        private String fieldName; // Deprecated: kept for backward compatibility, maps to customFieldId
        
        @NotBlank(message = "Field value is required")
        @Size(max = 1000, message = "Field value must not exceed 1000 characters")
        private String fieldValue;
        
        @Size(max = 50, message = "Operator must not exceed 50 characters")
        private String operator; // equals, contains, startsWith, endsWith - default: equals
    }
}

