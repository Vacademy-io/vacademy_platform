package vacademy.io.admin_core_service.features.applicant.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Request DTO for POST /v1/applicant/apply API
 * Handles both pre-filled (from enquiry) and manual (direct) application
 * submissions
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class ApplyRequestDTO {

    /**
     * Enquiry ID if user came from enquiry flow (GET was called first)
     * NULL for direct/manual applications
     */
    private String enquiryId;

    /**
     * Session ID - required for manual/direct applications to find the correct
     * audience
     */
    private String sessionId;

    /**
     * Institute ID - required for determining application workflow
     */
    private String instituteId;

    /**
     * Source type (e.g., LEVEL, INSTITUTE, CAMPAIGN)
     */
    private String source;

    /**
     * Source ID (e.g., class_5, campaign_id, etc.)
     */
    private String sourceId;

    /**
     * Form data containing all application fields
     * Flexible structure to accommodate various form configurations
     */
    private Map<String, Object> formData;
}
