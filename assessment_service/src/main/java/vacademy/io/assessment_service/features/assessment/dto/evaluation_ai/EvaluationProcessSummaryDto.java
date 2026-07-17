package vacademy.io.assessment_service.features.assessment.dto.evaluation_ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

/**
 * One row of the AI-evaluations dashboard for an assessment: enough to show
 * status, participant, progress and a "needs review" badge, and to re-open (or
 * retry) the run — replacing the old localStorage-only handoff.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EvaluationProcessSummaryDto {

    @JsonProperty("process_id")
    private String processId;

    @JsonProperty("attempt_id")
    private String attemptId;

    @JsonProperty("participant_name")
    private String participantName;

    @JsonProperty("status")
    private String status;

    @JsonProperty("questions_completed")
    private Integer questionsCompleted;

    @JsonProperty("questions_total")
    private Integer questionsTotal;

    @JsonProperty("needs_review_count")
    private Long needsReviewCount;

    @JsonProperty("started_at")
    private Date startedAt;

    @JsonProperty("completed_at")
    private Date completedAt;
}
