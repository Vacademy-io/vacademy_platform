package vacademy.io.admin_core_service.features.admission.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One row payload for bulk admission submission.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class BulkAdmissionSubmitRowDTO {
    private String sessionId;
    private String destinationPackageSessionId;

    private String parentName;
    private String parentEmail;
    private String parentMobile;

    private String childName;
    private String childDob;
    private String childGender; // MALE / FEMALE / OTHER

    // Optional CSV extras (not mandatory for payload mapping, but kept for parity).
    private String status;
    private String sourceType;
}

