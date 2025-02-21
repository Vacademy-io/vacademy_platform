package vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response;


import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

import java.util.List;
import java.util.Map;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@Builder
public class StudentReportOverallDetailDto {
    private ParticipantsQuestionOverallDetailDto questionOverallDetailDto;
    private Map<String, List<StudentReportAnswerReviewDto>> allSections;
}
