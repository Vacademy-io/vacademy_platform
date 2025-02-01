package vacademy.io.assessment_service.features.learner_assessment.dto;


import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class DataDurationDistributionDto {

    private DataDuration dataDuration;

    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    public static class DataDuration {
        private String id;
        private int newMaxTimeInMins;
        private List<Section> sections;
        private List<Question> questions;
    }

    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    public static class Section {
        private String id;
        private int newMaxTimeInMins;
    }

    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    public static class Question {
        private String id;
        private int newMaxTimeInMins;
    }
}
