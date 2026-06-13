package vacademy.io.admin_core_service.features.audience.dto.reports;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * GET /v1/reports/activity-timeline — per-counsellor activity volume over a
 * window, broken down by activity type, plus a daily total series across the
 * RBAC scope.
 *
 * "Activity" here is the union of four counsellor-driven sources, each scoped on
 * the ACTOR id and windowed on the activity timestamp (UTC wall-clock columns
 * converted to the institute timezone, same as the calling reports):
 *   - notes           = timeline_event rows with category = ACTIVITY (actor_id);
 *   - calls           = telephony_call_log (counsellor_user_id);
 *   - statusChanges   = lead_status_history (changed_by_user_id), OPTED_OUT excluded;
 *   - followupsCreated/Closed = lead_followup created_by / closed_by, OPTED_OUT excluded.
 *
 * {@code byCounsellor} is sorted by total activity descending; {@code daily} is
 * the total activity per institute-TZ calendar day across the whole scope.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ActivityTimelineReportDTO {

    private List<CounsellorRow> byCounsellor;
    private List<DayPoint> daily;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class CounsellorRow {
        private String userId;
        /** Hydrated via auth-service batch lookup; null when hydration fails. */
        private String name;
        private long notes;
        private long calls;
        private long statusChanges;
        private long followupsCreated;
        private long followupsClosed;
        /** Sum of all activity counts for this counsellor over the window. */
        private long total;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class DayPoint {
        /** Institute-TZ calendar date, yyyy-MM-dd. */
        private String date;
        /** Total activity across all scoped counsellors on this day. */
        private long total;
    }
}
