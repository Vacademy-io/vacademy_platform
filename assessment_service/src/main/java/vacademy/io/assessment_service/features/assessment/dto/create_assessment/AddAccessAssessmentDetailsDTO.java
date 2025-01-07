package vacademy.io.assessment_service.features.assessment.dto.create_assessment;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AddAccessAssessmentDetailsDTO {
    private List<AssessmentAccessDto> addedAccesses = new ArrayList<>();
    private List<AssessmentAccessDto> deletedAccesses = new ArrayList<>();
}
