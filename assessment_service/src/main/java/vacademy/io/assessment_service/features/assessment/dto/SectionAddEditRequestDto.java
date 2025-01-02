package vacademy.io.assessment_service.features.assessment.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SectionAddEditRequestDto {
    private String sectionDescription;
    private Integer sectionDuration;
    private Double totalMarks;
    private Double cutoffMarks;
    private Boolean problemRandomization;
    private List<QuestionAndMarking> questionAndMarking;


    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class QuestionAndMarking {
        private String questionId;
        private String markingJson;
        private Boolean isUpdated;
    }
}
