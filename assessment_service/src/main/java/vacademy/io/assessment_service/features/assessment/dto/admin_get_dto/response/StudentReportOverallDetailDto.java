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
    private String evaluatedFileId;
    // The learner's own submitted answer file (from the attempt's attemptData),
    // so the report can offer "view submitted" alongside "view evaluated".
    private String responseFileId;
    private ParticipantsQuestionOverallDetailDto questionOverallDetailDto;
    private Map<String, List<StudentReportAnswerReviewDto>> allSections;
}
