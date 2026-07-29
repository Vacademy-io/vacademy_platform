package vacademy.io.assessment_service.features.institute_pulse.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Whole assessment rail for one institute, in one payload, from one poll. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InstitutePulseSummaryResponse {

    /** Assessments whose bound window contains now(), soonest-to-end first. */
    private List<AssessmentFunnel> assessments;

    /** Institute-wide totals across those assessments — the KPI strip numbers. */
    private Totals totals;

    /** In-flight attempts needing attention, capped; see {@code returnedRisks}/{@code riskCapped}. */
    private List<AttemptRisk> risks;

    /** 0-based index of the assessment page in {@code assessments}. */
    private int page;

    /** True when more live assessments exist beyond this page. */
    private boolean hasMore;

    private int returnedRisks;

    /** True when the risk list hit its server-side cap, so the UI can say "showing first N". */
    private boolean riskCapped;

    /**
     * Attempts submitted inside the feed window, newest first. Feeds the institute-wide live
     * feed, which is otherwise blind to standalone assessments: the feed's own
     * SUBMITTED_ASSESSMENT events come from admin_core's {@code assessment_slide_tracked} and
     * describe an assessment SLIDE inside course content, which is a different thing.
     */
    private List<RecentSubmission> recentSubmissions;

    /**
     * Results pipeline for assessments that ended recently — where submitted attempts sit between
     * submission and results going out. Scoped BACKWARDS in time, unlike everything else on this
     * rail, because evaluation only happens after an assessment's window closes.
     */
    private List<EvaluationPipelineRow> evaluationPipeline;

    /** True when the results pipeline hit its cap, so the UI can say "showing first N". */
    private boolean evaluationCapped;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AssessmentFunnel {
        private String assessmentId;
        private String assessmentName;
        private Long startEpoch;
        private Long endEpoch;
        private long enrolled;
        private long notStarted;
        private long inPreview;
        private long inProgress;
        private long submitted;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Totals {
        /** Live assessments across the WHOLE institute, not just this page. */
        private long liveAssessments;

        /** Attempts in progress across the whole institute. */
        private long inProgress;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EvaluationPipelineRow {
        private String assessmentId;
        private String assessmentName;
        private Long endedAtEpoch;
        /** Submitted attempts. awaiting + evaluating + evaluated + failed sums to this. */
        private long submitted;
        private long awaiting;
        private long evaluating;
        private long evaluated;
        private long failed;
        /** Subset of evaluated, not a further disjoint stage. */
        private long released;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecentSubmission {
        private String attemptId;
        private String assessmentId;
        private String assessmentName;
        private String userId;
        private String participantName;
        private Long submittedAtEpoch;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AttemptRisk {
        private String attemptId;
        private String assessmentId;
        private String assessmentName;
        private String userId;
        private String participantName;
        private Long secondsSinceSync;
        private Long secondsRemaining;

        /** Every rule this attempt tripped: STALLED, AUTO_SUBMIT_SOON, OVERRUN. */
        private List<String> reasons;

        /** Highest-severity reason, for sorting and for the single-line UI label. */
        private String primaryReason;
    }
}
