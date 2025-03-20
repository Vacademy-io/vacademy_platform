package vacademy.io.assessment_service.features.assessment.dto.manual_evaluation;


import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ManualSubmitMarksRequest {

    private String setId;
    private String fileId;
    private String dataJson;
    private List<SubmitMarksDto> request;


    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class SubmitMarksDto{
        private String sectionId;
        private String questionId;
        private String status;
        private Double marks;
    }
}
