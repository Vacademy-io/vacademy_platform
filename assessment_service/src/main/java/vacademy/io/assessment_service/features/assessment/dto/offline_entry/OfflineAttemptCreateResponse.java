package vacademy.io.assessment_service.features.assessment.dto.offline_entry;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class OfflineAttemptCreateResponse {
    private String attemptId;
    private String registrationId;
    private String assessmentId;
}
