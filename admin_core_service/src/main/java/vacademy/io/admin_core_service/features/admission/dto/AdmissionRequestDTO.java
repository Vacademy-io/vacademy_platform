package vacademy.io.admin_core_service.features.admission.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
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

    // === Screen 1: Student Details ===
    private String firstName;
    private String lastName;
    private String gender; // MALE / FEMALE
    private String classApplyingFor; // maps to applying_for_class
    private String section;
    private String admissionNo;
    private String dateOfAdmission; // ISO date string e.g. "2024-06-01"
    private Boolean hasTransport;
    private String studentType;
    private String classGroup;
    private String dateOfBirth; // ISO date string
    private String mobileNumber; // maps to mobile_number in user + student
    private String admissionType;
    private String studentAadhaar; // maps to id_number (id_type = AADHAAR)

    // === Screen 2: Previous School & Other Details ===
    private String previousSchoolName;
    private String previousClass; // maps to last_class_attended
    private String previousBoard; // maps to previous_school_board (SSC/CBSE/ICSE/IGCSE/IB)
    private String yearOfPassing;
    private String previousPercentage; // maps to last_exam_result
    private String previousAdmissionNo;
    private String religion;
    private String caste;
    private String motherTongue;
    private String bloodGroup;
    private String nationality;
    private String howDidYouKnow;

    // === Screen 3: Parent Details ===
    // Father
    private String fatherName; // maps to fathers_name
    private String fatherMobile; // maps to parents_mobile_number
    private String fatherEmail; // maps to parents_email
    private String fatherAadhaar;
    private String fatherQualification;
    private String fatherOccupation;

    // Mother
    private String motherName; // maps to mothers_name
    private String motherMobile; // maps to parents_to_mother_mobile_number
    private String motherEmail; // maps to parents_to_mother_email
    private String motherAadhaar;
    private String motherQualification;
    private String motherOccupation;

    // Guardian
    private String guardianName;
    private String guardianMobile;

    // === Screen 4: Address Details ===
    private String currentAddress; // maps to address_line
    private String currentLocality; // maps to city
    private String currentPinCode; // maps to pin_code
    private String permanentAddress;
    private String permanentLocality;

    // === Custom Fields (optional) ===
    private Map<String, String> customFieldValues;
}
