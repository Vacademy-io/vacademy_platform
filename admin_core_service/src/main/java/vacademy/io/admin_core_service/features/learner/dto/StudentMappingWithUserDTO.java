package vacademy.io.admin_core_service.features.learner.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.Date;

/**
 * DTO containing student_session_institute_group_mapping row data with user details
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class StudentMappingWithUserDTO {
    private String id;
    private String userId;
    private String instituteEnrollmentNumber;
    private Date enrolledDate;
    private Date expiryDate;
    private String status;
    private String packageSessionId;
    private String instituteId;
    private String groupId;
    private String subOrgId;
    private String userPlanId;
    private String destinationPackageSessionId;
    private UserDTO user;
}
