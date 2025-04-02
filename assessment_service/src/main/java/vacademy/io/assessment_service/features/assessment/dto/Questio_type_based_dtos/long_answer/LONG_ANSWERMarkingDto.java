package vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.long_answer;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LONG_ANSWERMarkingDto {
    private String type;
    private DataFields data;

    @Getter
    @Setter
    public static class DataFields {
        private double totalMark;
        private double negativeMark;
        private double negativeMarkingPercentage;
        private double partialMarking;
        private double partialMarkingPercentage;
    }
}
