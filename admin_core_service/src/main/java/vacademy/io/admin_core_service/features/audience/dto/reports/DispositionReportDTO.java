package vacademy.io.admin_core_service.features.audience.dto.reports;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * GET /v1/reports/dispositions — who is moving leads to which statuses, plus per-counsellor
 * call outcome counts, all bounded to the window (institute TZ).
 *
 * statuses      — the institute's ACTIVE status catalog in display_order, so the FE renders a
 *                 stable column set (rows' changes maps may also contain keys of now-inactive
 *                 statuses; the FE simply won't have a column for them).
 * rows          — lead_status_history in-window grouped by actor × to-status. NULL
 *                 changed_by_user_id (workflow/auto transitions) is aggregated into a synthetic
 *                 user_id "SYSTEM" row named "System/Workflow" (only visible when the caller is
 *                 unscoped — scope filtering is on the actor id itself).
 * call_outcomes — telephony_call_log in-window grouped by counsellor × call status.
 * current_status_rows — POINT-IN-TIME snapshot (NOT window-bounded, matching funnel
 *                 current_stock): each counsellor's leads bucketed by the lead's CURRENT status
 *                 (response lead_status_id first, profile conversion_status fallback — the leads
 *                 list COALESCE). Leads with neither land in no_status_count. Leads with no
 *                 counsellor collapse into a synthetic "UNASSIGNED" row (admin/unscoped callers
 *                 only, same mechanics as SYSTEM). audienceId + RBAC scope are honoured.
 *
 * Map keys (status_key / CALL_STATUS) are emitted verbatim — snake_case naming only applies to
 * bean property names.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class DispositionReportDTO {

    private List<StatusMeta> statuses;
    private List<ActorChangesRow> rows;
    private List<CallOutcomeRow> callOutcomes;
    private List<CurrentStatusRow> currentStatusRows;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class StatusMeta {
        private String statusKey;
        private String label;
        private String color;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class ActorChangesRow {
        private String userId;            // auth-service user id, or "SYSTEM"
        private String name;              // hydrated via auth-service batch; "System/Workflow" for SYSTEM
        private long totalChanges;
        private Map<String, Long> changes; // status_key → transition count
        private long pendingCount;        // assigned leads with no status-change history (never touched)
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class CallOutcomeRow {
        private String userId;
        private String name;
        private Map<String, Long> outcomes; // CALL_STATUS → call count
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class CurrentStatusRow {
        private String userId;             // auth-service user id, or "UNASSIGNED"
        private String name;               // hydrated via auth-service batch; "Unassigned" for UNASSIGNED
        private long totalLeads;           // all leads on the counsellor's book = Σstatuses + no_status_count
        private Map<String, Long> statuses; // status_key → leads currently holding that status
        private long noStatusCount;        // leads with no status at all (never dispositioned)
    }
}
