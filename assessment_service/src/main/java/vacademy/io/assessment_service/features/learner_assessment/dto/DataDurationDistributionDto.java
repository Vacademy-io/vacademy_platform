package vacademy.io.assessment_service.features.learner_assessment.dto;


import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
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
        DataDurationModel assessmentDuration;
        private List<DataDurationModel> sectionsDuration;
        private List<DataDurationModel> questionsDuration;
    }


    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    public static class DataDurationModel {
        private String id;
        private Long newMaxTimeInSeconds;
    }
}
