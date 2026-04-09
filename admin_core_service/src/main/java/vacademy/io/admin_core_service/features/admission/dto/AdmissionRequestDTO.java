package vacademy.io.admin_core_service.features.admission.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Typed request DTO for POST /v1/admission/submit
 * Contains all fields from the 4-screen admission form.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class AdmissionRequestDTO {

    // === Routing / Workflow ===
    private String instituteId;
    private String source;
    private String sourceId;
    private String sessionId;
    private String destinationPackageSessionId;

    /**
     * If provided, reuse the existing enquiry's audience_response instead of creating fresh entries.
     */
    private String enquiryId;

    /**
     * If provided (applicant UUID), reuse the existing application's audience_response
     * and applicant instead of creating fresh entries.
     */
    private String applicationId;

    // === Screen 1: Student Details ===
    @Size(max = 255, message = "First name must not exceed 255 characters")
    private String firstName;

    @Size(max = 255, message = "Last name must not exceed 255 characters")
    private String lastName;

    @Pattern(regexp = "^(MALE|FEMALE|OTHER|)$", message = "Gender must be MALE, FEMALE, or OTHER")
    private String gender;

    private String classApplyingFor;
    private String section;

    @Size(max = 50, message = "Admission number must not exceed 50 characters")
    private String admissionNo;

    private String dateOfAdmission;
    private Boolean hasTransport;

    @Size(max = 255, message = "Student type must not exceed 255 characters")
    private String studentType;

    private String classGroup;
    private String dateOfBirth;

    @Size(max = 15, message = "Mobile number must not exceed 15 characters")
    private String mobileNumber;

    @Size(max = 255, message = "Admission type must not exceed 255 characters")
    private String admissionType;

    @Pattern(regexp = "^(\\d{12}|)$", message = "Aadhaar must be exactly 12 digits")
    private String studentAadhaar;

    // === Screen 2: Previous School & Other Details ===
    @Size(max = 255, message = "School name must not exceed 255 characters")
    private String previousSchoolName;

    @Size(max = 255, message = "Previous class must not exceed 255 characters")
    private String previousClass;

    @Size(max = 255, message = "Board must not exceed 255 characters")
    private String previousBoard;

    @Pattern(regexp = "^(\\d{4}|)$", message = "Year of passing must be 4 digits")
    private String yearOfPassing;

    @Size(max = 10, message = "Percentage must not exceed 10 characters")
    private String previousPercentage;

    @Size(max = 50, message = "Previous admission number must not exceed 50 characters")
    private String previousAdmissionNo;

    @Size(max = 255, message = "Religion must not exceed 255 characters")
    private String religion;

    @Size(max = 255, message = "Caste must not exceed 255 characters")
    private String caste;

    @Size(max = 255, message = "Mother tongue must not exceed 255 characters")
    private String motherTongue;

    @Size(max = 10, message = "Blood group must not exceed 10 characters")
    private String bloodGroup;

    @Size(max = 255, message = "Nationality must not exceed 255 characters")
    private String nationality;

    @Size(max = 255, message = "How did you know must not exceed 255 characters")
    private String howDidYouKnow;

    // === Screen 3: Parent Details ===
    // Father
    @Size(max = 255, message = "Father name must not exceed 255 characters")
    private String fatherName;

    @Size(max = 15, message = "Father mobile must not exceed 15 characters")
    private String fatherMobile;

    @Email(message = "Father email must be a valid email address")
    @Size(max = 320, message = "Father email must not exceed 320 characters")
    private String fatherEmail;

    @Pattern(regexp = "^(\\d{12}|)$", message = "Father Aadhaar must be exactly 12 digits")
    private String fatherAadhaar;

    @Size(max = 255, message = "Father qualification must not exceed 255 characters")
    private String fatherQualification;

    @Size(max = 255, message = "Father occupation must not exceed 255 characters")
    private String fatherOccupation;

    // Mother
    @Size(max = 255, message = "Mother name must not exceed 255 characters")
    private String motherName;

    @Size(max = 15, message = "Mother mobile must not exceed 15 characters")
    private String motherMobile;

    @Email(message = "Mother email must be a valid email address")
    @Size(max = 320, message = "Mother email must not exceed 320 characters")
    private String motherEmail;

    @Pattern(regexp = "^(\\d{12}|)$", message = "Mother Aadhaar must be exactly 12 digits")
    private String motherAadhaar;

    @Size(max = 255, message = "Mother qualification must not exceed 255 characters")
    private String motherQualification;

    @Size(max = 255, message = "Mother occupation must not exceed 255 characters")
    private String motherOccupation;

    // Guardian
    @Size(max = 255, message = "Guardian name must not exceed 255 characters")
    private String guardianName;

    @Size(max = 15, message = "Guardian mobile must not exceed 15 characters")
    private String guardianMobile;

    @Email(message = "Guardian email must be a valid email address")
    @Size(max = 320, message = "Guardian email must not exceed 320 characters")
    private String guardianEmail;

    // === Screen 4: Address Details ===
    @Size(max = 512, message = "Current address must not exceed 512 characters")
    private String currentAddress;

    @Size(max = 512, message = "Current locality must not exceed 512 characters")
    private String currentLocality;

    @Pattern(regexp = "^(\\d{6}|)$", message = "Pin code must be exactly 6 digits")
    private String currentPinCode;

    @Size(max = 512, message = "Permanent address must not exceed 512 characters")
    private String permanentAddress;

    @Size(max = 512, message = "Permanent locality must not exceed 512 characters")
    private String permanentLocality;

    // === Custom Fields (optional) ===
    private Map<String, String> customFieldValues;
}
