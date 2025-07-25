package vacademy.io.common.auth.dto.learner;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.common.auth.dto.UserDTO;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LearnerSignupDTO {
    private UserDTO user;
    private String instituteId;
    private String subjectId;
    private String vendorId;
    private LearnerPackageSessionsEnrollDTO learnerPackageSessionsEnrollDTO;
}
