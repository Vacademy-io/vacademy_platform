package vacademy.io.admin_core_service.features.learner_management.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO for creating new users inline during bulk assignment.
 * Maps directly to fields needed by
 * AuthService.createUserFromAuthServiceForLearnerEnrollment.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class NewUserDTO {

    /** Email address (used as unique identifier) */
    private String email;

    /** Full name of the learner */
    private String fullName;

    /** Mobile number (optional) */
    private String mobileNumber;

    /** Username — if null, email will be used */
    private String username;

    /** Password — if null, system will auto-generate */
    private String password;

    /** Roles to assign (default: ["STUDENT"]) */
    private List<String> roles;

    /** Gender (optional) */
    private String gender;
}
