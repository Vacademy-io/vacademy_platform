package vacademy.io.admin_core_service.features.audience.dto.combined;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.List;
import java.util.Map;

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

    // Enrollment data from v2 (populated for institute users)
    private String status;
    private String faceFileId;
    private String subOrgName;
    private String subOrgId;
    private String commaSeparatedOrgRoles;
    private String packageSessionId;
    private String instituteEnrollmentNumber;
    private String paymentStatus;
    private String instituteId;
    private String fathersName;
    private String mothersName;
    private String parentsMobileNumber;
    private String parentsEmail;
    private String parentsToMotherMobileNumber;
    private String parentsToMotherEmail;
    private String linkedInstituteName;
    private Map<String, String> customFieldsMap;

    // Lead profile data (populated when lead system is active)
    private Integer leadScore;
    private String leadTier;
    private String leadConversionStatus;
}
