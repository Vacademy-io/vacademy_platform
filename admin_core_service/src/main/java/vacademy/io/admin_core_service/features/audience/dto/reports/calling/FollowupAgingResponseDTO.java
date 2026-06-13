package vacademy.io.admin_core_service.features.audience.dto.reports.calling;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * GET /v1/reports/followup-aging — point-in-time aging of OPEN follow-ups
 * (lead_followup.is_closed = false), bucketed by schedule_time vs "now" in the
 * institute timezone, plus closure reasons over the trailing 30 days.
 *
 * Day bands (calendar-day difference, institute TZ):
 *   UPCOMING = scheduled after today · DUE_TODAY = scheduled today ·
 *   OVERDUE_1_3 = 1–3 days past · OVERDUE_3_7 = 4–7 days past ·
 *   OVERDUE_7_PLUS = 8+ days past.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class FollowupAgingResponseDTO {

    /** Always exactly five buckets, in DUE_TODAY → UPCOMING order, zeroes included. */
    private List<Bucket> buckets;
    private List<CounsellorRow> byCounsellor;
    /** Top closer_reason values over follow-ups closed in the last 30 days (max 15). */
    private List<ClosureReason> closureReasons;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Bucket {
        /** DUE_TODAY | OVERDUE_1_3 | OVERDUE_3_7 | OVERDUE_7_PLUS | UPCOMING */
        private String key;
        private long count;
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
        private long dueToday;
        // SnakeCaseStrategy doesn't insert underscores around digits
        // ("overdue1To3" → "overdue1_to3"), so the digit-banded fields carry
        // explicit @JsonProperty names to match the API contract exactly.
        @JsonProperty("overdue_1_3")
        private long overdue1To3;
        @JsonProperty("overdue_3_7")
        private long overdue3To7;
        @JsonProperty("overdue_7_plus")
        private long overdue7Plus;
        private long upcoming;
        /** MAX days past due across this counsellor's open follow-ups; null when none overdue. */
        private Long oldestOverdueDays;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class ClosureReason {
        /** Trimmed closer_reason; blank/null normalized to "(no reason)". */
        private String reason;
        private long count;
    }
}
