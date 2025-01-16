package vacademy.io.auth_service.feature.auth.dto.learner;


import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.institute.dto.InstituteInfoDTO;


@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class RegisterLearnerRequest {
    private String userName;
    private String email;
    private String password;
    private InstituteInfoDTO institute;
}
