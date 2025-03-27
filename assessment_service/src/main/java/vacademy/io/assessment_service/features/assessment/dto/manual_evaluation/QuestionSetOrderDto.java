package vacademy.io.assessment_service.features.assessment.dto.manual_evaluation;


import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class QuestionSetOrderDto {
    private String questionId;
    private Integer order;
}
