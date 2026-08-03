package vacademy.io.assessment_service.features.learner_assessment.dto.context;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.MarksRankDto;

/** Concrete mirror of {@link MarksRankDto}. See AssessmentOverviewSnapshot for why. */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class MarksRankSnapshot implements MarksRankDto {
    private Double marks;
    private Integer rank;
    private Integer noOfParticipants;
    private Double percentile;

    public static MarksRankSnapshot from(MarksRankDto p) {
        if (p == null) return null;
        return MarksRankSnapshot.builder()
                .marks(p.getMarks())
                .rank(p.getRank())
                .noOfParticipants(p.getNoOfParticipants())
                .percentile(p.getPercentile())
                .build();
    }
}
