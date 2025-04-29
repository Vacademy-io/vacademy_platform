package vacademy.io.assessment_service.features.assessment.dto.create_assessment;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class BasicAssessmentDetailsDTO {
    private String status;
    private String assessmentType;
    private TestCreation testCreation;
    private LiveDateRange testBoundation;
    private Integer assessmentPreviewTime;
    private Boolean switchSections;
    private String submissionType;
    private String evaluationType;
    private Boolean raiseReattemptRequest;
    private Boolean raiseTimeIncreaseRequest;
    private Boolean hasOmrMode;
    private Integer defaultReattemptCount = 1;
    private String source;
    private String sourceId;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class TestCreation {
        private String assessmentName;
        private String subjectId;
        private String assessmentInstructionsHtml;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class LiveDateRange {
        private String startDate;
        private String endDate;
    }


}
