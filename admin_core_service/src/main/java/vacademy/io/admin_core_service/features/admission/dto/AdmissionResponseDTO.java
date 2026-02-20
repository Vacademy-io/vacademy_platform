package vacademy.io.admin_core_service.features.admission.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response DTO for POST /v1/admission/submit
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AdmissionResponseDTO {

    private String applicantId;
    private String trackingId;
    private String workflowType; // Always "ADMISSION"
    private String overallStatus;
    private String currentStageId;
    private String message;
    private boolean isTransition; // true if existing applicant was transitioned
}
