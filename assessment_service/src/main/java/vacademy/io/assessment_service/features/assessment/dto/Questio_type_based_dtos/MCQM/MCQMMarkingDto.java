package vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.MCQM;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class MCQMMarkingDto {

    private String type;
    private DataFields data;

    @Getter
    @Setter
    public static class DataFields {
        private double totalMark;
        private double negativeMark;
        private int negativeMarkingPercentage;
        private int partialMarking;
        private int partialMarkingPercentage;
    }
}
