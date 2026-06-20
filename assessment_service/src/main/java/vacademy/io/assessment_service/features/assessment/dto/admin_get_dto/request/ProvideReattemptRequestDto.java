package vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.request;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ProvideReattemptRequestDto {
    // assessment_user_registration ids of the participants to grant a reattempt to
    private List<String> registrationIds;

    // number of additional attempts to grant; defaults to 1 when null/invalid
    private Integer reattemptCount;
}
