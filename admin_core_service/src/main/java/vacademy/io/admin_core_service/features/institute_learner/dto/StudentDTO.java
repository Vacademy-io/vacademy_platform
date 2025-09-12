package vacademy.io.admin_core_service.features.institute_learner.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class StudentDTO {

    private String id;
    private String username;
    private String userId;
    private String email;
    private String fullName;
    private String addressLine;
    private String region;
    private String city;
    private String pinCode;
    private String mobileNumber;
    private Date dateOfBirth;
    private String gender;
    private String fatherName;
    private String motherName;
    private String parentsMobileNumber;
    private String parentsEmail;
    private String linkedInstituteName;
    private String packageSessionId;
    private String instituteEnrollmentId;
    private String status;
    private String sessionExpiryDays;
    private String instituteId;
    private String faceFileId;
    private Date expiryDate;
    private Date createdAt;
    private Date updatedAt;
    private String parentsToMotherMobileNumber;
    private String parentsToMotherEmail;
    private String userPlanId;
    private Double attendancePercent;

    // 🔑 Dynamic custom fields (fieldKey -> value)
    private Map<String, String> customFields = new HashMap<>();

    // Constructor that takes a Student entity
    public StudentDTO(Student student) {
        this.id = student.getId();
        this.username = student.getUsername();
        this.userId = student.getUserId();
        this.email = student.getEmail();
        this.fullName = student.getFullName();
        this.addressLine = student.getAddressLine();
        this.region = student.getRegion();
        this.city = student.getCity();
        this.pinCode = student.getPinCode();
        this.mobileNumber = student.getMobileNumber();
        this.dateOfBirth = student.getDateOfBirth();
        this.gender = student.getGender();
        this.fatherName = student.getFatherName();
        this.motherName = student.getMotherName();
        this.parentsMobileNumber = student.getParentsMobileNumber();
        this.parentsEmail = student.getParentsEmail();
        this.linkedInstituteName = student.getLinkedInstituteName();
        this.createdAt = student.getCreatedAt();
        this.updatedAt = student.getUpdatedAt();
        this.faceFileId = student.getFaceFileId();
        this.parentsToMotherMobileNumber = student.getParentToMotherMobileNumber();
        this.parentsToMotherEmail = student.getParentsToMotherEmail();
    }

    // Constructor that takes an Object[]
    public StudentDTO(Object[] objects) {
        if (objects != null && objects.length >= 20) { // Ensure there are enough elements
            this.id = (String) objects[0];
            this.username = (String) objects[1];
            this.userId = (String) objects[2];
            this.email = (String) objects[3];
            this.fullName = (String) objects[4];
            this.addressLine = (String) objects[5];
            this.region = (String) objects[6];
            this.city = (String) objects[7];
            this.pinCode = (String) objects[8];
            this.mobileNumber = (String) objects[9];
            this.dateOfBirth = (Date) objects[10];
            this.gender = (String) objects[11];
            this.fatherName = (String) objects[12];
            this.motherName = (String) objects[13];
            this.parentsMobileNumber = (String) objects[14];
            this.parentsEmail = (String) objects[15];
            this.linkedInstituteName = (String) objects[16];
            this.createdAt = (Date) objects[17];
            this.updatedAt = (Date) objects[18];
            // Assuming these additional fields are at indices 17, 18, and 19
            if (objects.length > 19) {
                this.packageSessionId = (String) objects[19]; // Additional field from mapping table
            }
            if (objects.length > 20) {
                this.instituteEnrollmentId = (String) objects[20]; // Additional field from mapping table
            }
            if (objects.length > 21) {
                this.status = (String) objects[21]; // Additional field from mapping table
            }
            if (objects.length > 22) {
                this.instituteId = (String) objects[22]; // Additional field from mapping table
            }
            if (objects.length > 23) {
                this.expiryDate = (Date) objects[23]; // Additional field from mapping table
            }
            if (objects.length > 24) {
                this.faceFileId = (String) objects[24]; // Additional field from mapping table
            }
            if (objects.length > 25) {
                this.parentsToMotherMobileNumber = (String) objects[25]; // Additional field from mapping table
            }
            if (objects.length > 26) {
                this.parentsToMotherEmail = (String) objects[26]; // Additional field from mapping table
            }
            if (objects.length > 27){
                this.userPlanId = (String) objects[27]; // Additional field from mapping table
            }
            if (objects.length > 28){
                this.attendancePercent = (Double) objects[28]; // Additional field for attendance percentage
            }
        }
    }
}