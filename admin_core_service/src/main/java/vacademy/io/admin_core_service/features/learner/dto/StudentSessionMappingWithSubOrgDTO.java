package vacademy.io.admin_core_service.features.learner.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

/**
 * Complete DTO for student_session_institute_group_mapping with sub-org details
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class StudentSessionMappingWithSubOrgDTO {
    // Mapping fields
    private String id;
    private String userId;
    private String instituteEnrolledNumber;
    private Date enrolledDate;
    private Date expiryDate;
    private String status;
    private Date createdAt;
    private Date updatedAt;

    // Related IDs
    private String groupId;
    private String instituteId;
    private String packageSessionId;
    private String destinationPackageSessionId;
    private String userPlanId;
    private String typeId;
    private String type;
    private String source;
    private String desiredLevelId;
    private String desiredPackageId;
    private String automatedCompletionCertificateFileId;

    // Sub-org specific
    private String subOrgId;
    private String commaSeparatedOrgRoles;

    // New fields
    private String packageName;
    private String levelName;
    private String sessionName;

    // Sub-org details (nested institute object)
    private InstituteBasicDTO subOrgDetails;
    private String inviteCode;
}
