package vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.util.Map;


@Getter
@Setter
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class TotalMarksAssessmentResponse {
    Double totalAchievableMarks;
    Map<String, Double> sectionWiseAchievableMarks;
}
