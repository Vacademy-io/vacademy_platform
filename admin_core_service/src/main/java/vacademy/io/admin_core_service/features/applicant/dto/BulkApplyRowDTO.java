package vacademy.io.admin_core_service.features.applicant.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One row payload for bulk application submission.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class BulkApplyRowDTO {
    private String sessionId;
    private String destinationPackageSessionId;

    private String fatherName;
    private String fatherMobile;
    private String fatherEmail;
    private String motherName;
    private String motherMobile;
    private String motherEmail;

    private String childName;
    private String childDob;
    private String childGender; // MALE / FEMALE / OTHER

    private String addressLine;
}

