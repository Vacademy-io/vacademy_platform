package vacademy.io.admin_core_service.features.learner.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
public class LearnerDetailsEditDTO {
    private String userId;
    private String email;
    private String fullName;
    private String contactNumber;
    private String gender;
    private String addressLine;
    private String state;
    private String pinCode;
    private String instituteName; // this is where learner is enrolled, and we won't take this if learner institute == where learner is currently studying
    private String fatherName;
    private String motherName;
    private String parentsMobileNumber;
    private String parentsEmail;
    private String faceFileId;
    private String userName;
    private String password;
}
