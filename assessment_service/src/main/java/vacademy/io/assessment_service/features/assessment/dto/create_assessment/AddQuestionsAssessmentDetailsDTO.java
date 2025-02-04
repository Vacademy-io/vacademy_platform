package vacademy.io.assessment_service.features.assessment.dto.create_assessment;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.assessment_service.features.assessment.dto.SectionAddEditRequestDto;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AddQuestionsAssessmentDetailsDTO {

    private List<SectionAddEditRequestDto> addedSections = new ArrayList<>();
    private List<SectionAddEditRequestDto> updatedSections = new ArrayList<>();
    private List<SectionAddEditRequestDto> deletedSections = new ArrayList<>();
    private TestDuration testDuration;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class TestDuration {
        private Integer entireTestDuration;
        private String distributionDuration;
    }
}
