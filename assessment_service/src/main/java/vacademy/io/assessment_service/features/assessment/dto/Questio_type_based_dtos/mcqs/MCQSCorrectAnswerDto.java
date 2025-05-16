package vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.mcqs;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class MCQSCorrectAnswerDto {
    private String type;
    private DataFields data;

    @Getter
    @Setter
    public static class DataFields {
        private List<String> correctOptionIds;
    }
}
