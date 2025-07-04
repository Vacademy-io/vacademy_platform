package vacademy.io.admin_core_service.features.course.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.common.auth.dto.UserDTO;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AddFacultyToCourseDTO {
    private boolean isNewUser;
    private UserDTO user;
    private String status;
}
