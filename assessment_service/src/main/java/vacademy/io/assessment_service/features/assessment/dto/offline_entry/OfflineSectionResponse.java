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
public class OfflineSectionResponse {
    private String sectionId;
    private List<OfflineQuestionResponse> questions;
}
