package vacademy.io.admin_core_service.features.applicant.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.List;

/**
 * Response DTO containing child information with their applications and
 * enrollments.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChildDetailsDTO {

    /**
     * Child user information from auth service
     */
    private UserDTO childInfo;

    /**
     * All applications (from audience_response table) for this child
     */
    private List<AudienceResponse> applications;

    /**
     * All enrollments (from student table) for this child
     */
    private List<Student> enrollments;
}
