package vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.numeric;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class NUMERICCorrectAnswerDto {
    private String type;
    private DataFields data;

    @Getter
    @Setter
    public static class DataFields {
        private List<Double> validAnswers;
    }
}
