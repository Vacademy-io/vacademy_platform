package vacademy.io.admin_core_service.features.institute_learner.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.Date;
import java.util.Map;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class StudentV2DTO {
    private String id;
    private String userId;
    private String username;
    private String email;
    private String fullName;
    private String addressLine;
    private String region;
    private String city;
    private String pinCode;
    private String mobileNumber;
    private Date dateOfBirth;
    private String gender;
    private String fathersName;
    private String mothersName;
    private String parentsMobileNumber;
    private String parentsEmail;
    private String linkedInstituteName;
    private Date createdAt;
    private Date updatedAt;
    private String faceFileId;
    private Date expiryDate;
    private String parentsToMotherMobileNumber;
    private String parentsToMotherEmail;

    // v2 additional fields
    private String password;
    private String paymentStatus;
    private String packageSessionId;
    private Integer accessDays;
    private String instituteEnrollmentNumber;
    private String instituteId;
    private String groupId;
    private String status;

    // Custom fields as Map<customFieldId, value>
    private Map<String, String> customFields;
}
