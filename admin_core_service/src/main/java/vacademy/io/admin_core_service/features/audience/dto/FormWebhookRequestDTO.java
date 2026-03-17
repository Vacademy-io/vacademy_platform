package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Generic DTO for receiving form webhook submissions
 * This will be transformed by specific form provider strategies
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class FormWebhookRequestDTO {
    
    /**
     * The form provider type (ZOHO_FORMS, GOOGLE_FORMS, MICROSOFT_FORMS)
     */
    private String formProvider;
    
    /**
     * The audience/campaign ID to associate this submission with
     */
    private String audienceId;
    
    /**
     * Raw webhook payload from the form provider
     * Different providers send different payload structures
     */
    private Map<String, Object> payload;
    
    /**
     * Optional: Additional metadata
     */
    private Map<String, String> metadata;
}
