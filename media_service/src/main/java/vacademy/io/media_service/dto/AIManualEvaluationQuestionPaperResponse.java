package vacademy.io.media_service.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

import java.util.List;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class AIManualEvaluationQuestionPaperResponse {
    private String htmlQuestion;
    private String htmlAnswer;
    private Double marksObtained;
    private Double totalMarks;
    private List<String> answerTips;
    private String explanation;
    private String topicWiseUnderstanding;
}
