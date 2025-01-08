package vacademy.io.admin_core_service.features.student.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class StudentCsvDTO {
    private String id;
    private String username;
    private String email;
    private String fullName;
    private String addressLine;
    private String region;
    private String city;
    private String pinCode;
    private String mobileNumber;
    private String dateOfBirth;
    private String gender;
    private String fatherName;
    private String motherName;
    private String parentsMobileNumber;
    private String parentsEmail;
    private String linkedInstituteName;
    private String instituteId;
    private String packageSessionId;
    private String enrollmentId;
    private String enrollmentStatus;
    private String enrollmentDate;
    private String errorMessage;
    private String statusMessage;
    private Boolean status;
    private String password;
    private String userId;
}