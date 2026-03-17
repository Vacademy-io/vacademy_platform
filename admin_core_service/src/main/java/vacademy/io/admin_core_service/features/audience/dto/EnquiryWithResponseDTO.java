package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.auth.dto.UserDTO;

import java.sql.Timestamp;
import java.util.Map;
import java.util.UUID;

/**
 * DTO combining Enquiry, AudienceResponse, User and CustomFields
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class EnquiryWithResponseDTO {

    // Enquiry fields
    private UUID enquiryId;
    private String checklist;
    private String enquiryStatus;
    private String convertionStatus;
    private String referenceSource;
    private Boolean assignedUserId;
    private Boolean assignedVisitSessionId;
    private String feeRangeExpectation;
    private String transportRequirement;
    private String mode;
    private String enquiryTrackingId;
    private Integer interestScore;
    private String notes;
    private Timestamp enquiryCreatedAt;

    // Audience Response fields
    private String audienceResponseId;
    private String audienceId;
    private String sourceType;
    private String sourceId;
    private String destinationPackageSessionId;
    private String parentName;
    private String parentEmail;
    private String parentMobile;
    private Timestamp submittedAt;

    // User details
    private UserDTO parentUser;

    // Linked child user details (if parent-child relationship exists)
    private UserDTO childUser;

    // Custom fields as Map
    private Map<String, String> customFields;

    // Assigned counsellor user ID from linked_users table
    private String assignedCounsellorId;
}
