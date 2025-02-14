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

    private String assessmentId;
    private Integer rank;
    private Double percentile;
    private Double marks;
    private Integer attempted;
    private Integer Skipped;
    private Integer correctAttempt;
    private Integer partiallyCorrectAttempt;
    private Integer wrongAttempt;
    private Map<String, List<StudentReportAnswerReviewDto>> allQuestions;
}
