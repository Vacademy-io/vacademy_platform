package vacademy.io.admin_core_service.features.audience.dto.reports.calling;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * GET /v1/reports/calls-daily — daily dial/connect series plus a per-counsellor
 * breakdown over the same window. "Connected" is the institute-configurable set
 * of telephony statuses (default ["COMPLETED"]); day bucketing follows the
 * institute timezone setting.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CallsDailyResponseDTO {

    private List<DayRow> days;
    private List<CounsellorRow> byCounsellor;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class DayRow {
        /** Institute-TZ calendar date, yyyy-MM-dd. */
        private String date;
        private long dials;
        private long connected;
        /** % (0–100, 1 decimal) — null when dials == 0. */
        private Double connectRate;
        /** SUM(COALESCE(duration_seconds, 0)) over connected calls. */
        private long talkSeconds;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class CounsellorRow {
        private String userId;
        /** Hydrated via auth-service batch lookup; null when hydration fails. */
        private String name;
        private long dials;
        private long connected;
        /** % (0–100, 1 decimal) — null when dials == 0. */
        private Double connectRate;
        private long talkSeconds;
        /** talkSeconds / connected, 1 decimal — null when connected == 0. */
        private Double avgCallSeconds;
        /** CallStatus enum NAME → count (e.g. "COMPLETED": 12, "NO_ANSWER": 4). */
        private Map<String, Long> outcomes;
    }
}
