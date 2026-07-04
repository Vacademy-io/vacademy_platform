package vacademy.io.admin_core_service.features.call_intelligence.dto;

import lombok.Builder;
import lombok.Data;

import java.sql.Timestamp;
import java.util.List;
import java.util.Map;

/**
 * Coaching insights for a single counsellor over a window — the "what can this
 * team member improve" view. Built by aggregating the transcript-derived analysis
 * ({@code analysis_json}) across their COMPLETED calls: which rubric qualities are
 * weakest, the coaching tips that recur most, the objections they hit most, and a
 * list of recent calls to drill into (each opens the per-call transcript analysis).
 */
@Data
@Builder
public class CallIntelligenceCoachingDto {

    private String counsellorUserId;
    private long totalAnalyzed;
    private Double avgCallerSelfGoalRating;
    private Double avgCallOutputRating;

    /** Per-rubric-quality average (0-10) across the window — lowest = biggest gap. */
    private List<QualityAvg> qualityAverages;
    /** Most-recurring coaching tips (the concrete "improve this" items). */
    private List<CoachingTip> topCoachingTips;
    /** Objections this counsellor hits most, and how often they handled them. */
    private List<ObjectionStat> topObjections;
    /** lead_sentiment → count. */
    private Map<String, Long> sentimentDistribution;
    /** Recent analyzed calls for drill-down (newest first). */
    private List<RecentCall> recentCalls;

    @Data
    @Builder
    public static class QualityAvg {
        private String key;
        private Double avgScore;
        private long count;
        /**
         * In whole-team coaching, the counsellors weakest in this quality (below the
         * team average for it), so the UI can say "X can improve in this field".
         * Null/empty for single-counsellor coaching.
         */
        private List<WeakCounsellor> weakCounsellors;
    }

    @Data
    @Builder
    public static class WeakCounsellor {
        private String counsellorUserId;
        private String name;
        private Double avgScore;
    }

    @Data
    @Builder
    public static class CoachingTip {
        private String text;
        private long count;
    }

    @Data
    @Builder
    public static class ObjectionStat {
        private String objection;
        private long count;
        private long handledCount;
    }

    @Data
    @Builder
    public static class RecentCall {
        private String callLogId;
        private Timestamp callStartedAt;
        private java.math.BigDecimal callerSelfGoalRating;
        private java.math.BigDecimal callOutputRating;
        private String genericStatus;
        private String summary;
    }
}
