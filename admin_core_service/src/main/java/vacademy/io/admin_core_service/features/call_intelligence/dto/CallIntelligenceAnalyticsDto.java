package vacademy.io.admin_core_service.features.call_intelligence.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * Aggregate intelligence over a cohort of calls (a counsellor, or a sales head's
 * whole team) within a date window. The per-counsellor breakdown is populated
 * only for the team view.
 */
@Data
@Builder
public class CallIntelligenceAnalyticsDto {

    private long totalAnalyzed;
    private Double avgCallerSelfGoalRating;
    private Double avgCallOutputRating;

    /** generic_status → count. */
    private Map<String, Long> statusDistribution;
    /** lead_sentiment → count. */
    private Map<String, Long> sentimentDistribution;

    /** Populated for the team view: one row per counsellor under the caller. */
    private List<CounsellorStat> perCounsellor;

    @Data
    @Builder
    public static class CounsellorStat {
        private String counsellorUserId;
        private long totalAnalyzed;
        private Double avgCallerSelfGoalRating;
        private Double avgCallOutputRating;
    }
}
