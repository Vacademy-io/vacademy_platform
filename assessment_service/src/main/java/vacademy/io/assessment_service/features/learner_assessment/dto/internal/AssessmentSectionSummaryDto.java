package vacademy.io.assessment_service.features.learner_assessment.dto.internal;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Per-section breakdown returned by the internal student-analysis endpoint.
 * Fields mirror the JSON contract specified in the Phase-2 design doc.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
public class AssessmentSectionSummaryDto {

    private String sectionId;
    private String sectionName;
    private Double studentMarks;
    private Double sectionTotalMarks;
    private Double sectionAverageMarks;
    private Double studentAccuracy;
    private Double classAccuracy;
}
