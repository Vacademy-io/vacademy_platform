package vacademy.io.admin_core_service.features.learner_management.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.common.dto.CustomFieldValueDTO;

import java.util.List;

/**
 * DTO for creating new users inline during bulk assignment.
 * Maps directly to fields needed by
 * AuthService.createUserFromAuthServiceForLearnerEnrollment.
 * <p>
 * All fields beyond email are optional. The backend will use sensible defaults
 * (e.g. email as username, auto-generated password, role=STUDENT).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class NewUserDTO {

    // ──── Core user fields (existing) ────

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

    // ──── Additional user profile fields ────

    /** Date of birth (ISO format string, e.g. "2000-01-15") */
    private String dateOfBirth;

    /** Address line */
    private String addressLine;

    /** City */
    private String city;

    /** Region / State */
    private String region;

    /** PIN / Postal code */
    private String pinCode;

    // ──── Learner extra details (parent/guardian info) ────

    /** Father/Male Guardian's Name */
    private String fathersName;

    /** Mother/Female Guardian's Name */
    private String mothersName;

    /** Father/Male Guardian's Mobile Number */
    private String parentsMobileNumber;

    /** Father/Male Guardian's Email */
    private String parentsEmail;

    /** Mother/Female Guardian's Mobile Number */
    private String parentsToMotherMobileNumber;

    /** Mother/Female Guardian's Email */
    private String parentsToMotherEmail;

    /** College/School name */
    private String linkedInstituteName;

    // ──── Custom field values (institute-specific fields) ────

    /**
     * Per-user custom field values from CSV/manual entry.
     * These get saved against each enrollment mapping created for this user.
     * Assignment-level custom fields (from AssignmentItemDTO) take precedence
     * over user-level ones for the same custom_field_id.
     */
    private List<CustomFieldValueDTO> customFieldValues;
}
