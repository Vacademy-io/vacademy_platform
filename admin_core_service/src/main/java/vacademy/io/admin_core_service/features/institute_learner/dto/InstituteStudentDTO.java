package vacademy.io.admin_core_service.features.institute_learner.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.auth.dto.UserDTO;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class InstituteStudentDTO {
    private UserDTO userDetails;
    private StudentExtraDetails studentExtraDetails;
    private InstituteStudentDetails instituteStudentDetails;
    private Boolean status;           // Status indicating if the tenant is active or inactive; logic may enforce certain status values
    private String statusMessage;     // Status message providing details about the tenant's state
    private String errorMessage;      // Error message, if any, related to tenant operations
}
