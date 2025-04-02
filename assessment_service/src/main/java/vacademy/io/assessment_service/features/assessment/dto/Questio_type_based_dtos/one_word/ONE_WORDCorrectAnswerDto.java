package vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.one_word;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ONE_WORDCorrectAnswerDto {
    private String type;
    private DataFields data;

    @Getter
    @Setter
    public static class DataFields {
        private String answer;
    }
}
