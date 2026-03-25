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
public class OfflineAttemptCreateRequest {
    private String setId;
    // For batch students who don't yet have an AssessmentUserRegistration
    private String userId;
    private String fullName;
    private String email;
    private String username;
    private String mobileNumber;
    private String batchId;
}
