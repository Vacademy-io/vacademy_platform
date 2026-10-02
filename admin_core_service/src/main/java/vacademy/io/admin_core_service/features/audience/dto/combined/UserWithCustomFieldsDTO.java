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

    /**
     * TRIAL or PAID for an enrolled contact, null for a lead who has no plan at all.
     *
     * <p>Derived from {@code user_plan.is_trial}, which follows the MONEY rather than the
     * enrollment: every path that collects a plan's price clears the flag, so a learner who
     * converted mid-trial reads PAID from that moment. A contact with no plan gets null
     * rather than PAID -- "not a member" and "paying member" are different things and the
     * badge must not conflate them.
     */
    private String membershipType;

    /** ssigm.enrolled_date -- the date this contact joined the batch. */
    private String enrolledDate;
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
    private String assignedCounselorId;
    private String assignedCounselorName;
}
