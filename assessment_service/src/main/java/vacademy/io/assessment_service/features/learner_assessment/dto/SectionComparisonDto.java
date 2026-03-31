package vacademy.io.assessment_service.features.learner_assessment.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@Builder
public class SectionComparisonDto {
    private String sectionId;
    private String sectionName;
    private Double studentMarks;
    private Double sectionTotalMarks;
    private Double sectionAverageMarks;
    private Double sectionHighestMarks;
    private Double cutOffMarks;
    private Double studentAccuracy;
    private Double classAccuracy;
    private Boolean passed;
}
