package vacademy.io.admin_core_service.features.admission.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class AdmissionResponsesListRequestDTO {

    /**
     * Academic year session id (e.g. "2025-2026"). Mandatory.
     */
    private String sessionId;

    /**
     * Optional top-bar filter. Only applied if sessionId is provided.
     */
    private String destinationPackageSessionId;

    private Timestamp createdFrom;
    private Timestamp createdTo;

    /**
     * Optional: ENQUIRY | APPLICATION | ALL
     */
    private String from;

    /**
     * Optional: PARENT_EMAIL | PARENT_MOBILE | STUDENT_NAME | ENQUIRY_ID | APPLICANT_ID
     */
    private String searchBy;
    private String searchText;
}

