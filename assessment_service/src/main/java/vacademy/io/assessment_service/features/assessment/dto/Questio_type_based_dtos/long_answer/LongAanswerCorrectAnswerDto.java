package vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.long_answer;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LongAanswerCorrectAnswerDto {
    private String type;
    private DataFields data;

    @Getter
    @Setter
    public static class DataFields {
        private AnswerFields answer;
    }

    @Getter
    @Setter
    public static class AnswerFields {
        private String id;
        private String type;
        private String content;
    }
}
