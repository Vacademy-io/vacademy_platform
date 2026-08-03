package vacademy.io.assessment_service.features.learner_assessment.dto.context;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.AssessmentOverviewDto;

import java.util.Date;

/**
 * Concrete, Jackson-round-trippable mirror of {@link AssessmentOverviewDto}.
 * {@code AssessmentOverviewDto} is a Spring Data interface projection over a
 * native query — a runtime proxy that Jackson can serialise but never
 * deserialise back into (no concrete type to instantiate). This class exists
 * purely so the bulk-export job context can survive a JSON round-trip
 * (context_snapshot) across a resume. See ASSESSMENT_BULK_REPORT_EXPORT_ARCHITECTURE.md §5.2 / X1.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AssessmentOverviewSnapshot implements AssessmentOverviewDto {
    private Date createdOn;
    private Date startDateAndTime;
    private Date endDateAndTime;
    private Long durationInMin;
    private Long totalParticipants;
    private Double averageDuration;
    private Double averageMarks;
    private Long totalAttempted;
    private Long totalOngoing;
    private String subjectId;

    public static AssessmentOverviewSnapshot from(AssessmentOverviewDto p) {
        if (p == null) return null;
        return AssessmentOverviewSnapshot.builder()
                .createdOn(p.getCreatedOn())
                .startDateAndTime(p.getStartDateAndTime())
                .endDateAndTime(p.getEndDateAndTime())
                .durationInMin(p.getDurationInMin())
                .totalParticipants(p.getTotalParticipants())
                .averageDuration(p.getAverageDuration())
                .averageMarks(p.getAverageMarks())
                .totalAttempted(p.getTotalAttempted())
                .totalOngoing(p.getTotalOngoing())
                .subjectId(p.getSubjectId())
                .build();
    }
}
