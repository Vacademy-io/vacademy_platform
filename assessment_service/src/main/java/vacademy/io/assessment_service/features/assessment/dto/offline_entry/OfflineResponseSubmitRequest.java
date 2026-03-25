package vacademy.io.assessment_service.features.assessment.dto.offline_entry;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class OfflineResponseSubmitRequest {
    private List<OfflineSectionResponse> sections;
    // Optional: for combined create-and-submit (batch students without registration)
    private String userId;
    private String fullName;
    private String email;
    private String username;
    private String mobileNumber;
    private String batchId;
}
