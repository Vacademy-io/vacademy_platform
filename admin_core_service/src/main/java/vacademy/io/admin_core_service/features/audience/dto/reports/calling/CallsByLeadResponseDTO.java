package vacademy.io.admin_core_service.features.audience.dto.reports.calling;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * GET /v1/reports/calls-by-lead — per-lead call-attempt roll-up for the report
 * window plus the "new leads never called" cohort.
 *
 * The three per-call buckets are NOT mutually exclusive (a COMPLETED call can
 * also carry a CALLBACK disposition), so they must not be summed against
 * attempts:
 *   - connected   = status in the institute's connected set (default COMPLETED)
 *   - callbacks   = disposition category CALLBACK, or a promised callback_at
 *   - notPicked   = NO_ANSWER/BUSY status, or disposition category NOT_CONNECTED
 *
 * Exactly one of {@code rows} / {@code uncalledRows} is populated per response,
 * driven by the {@code view} request param; {@code summary} always covers both
 * populations. Timestamps are ISO-8601 UTC strings.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CallsByLeadResponseDTO {

    private Summary summary;
    /** view=CALLED — leads with ≥1 dial in the window, most-tried first. */
    private List<CalledLeadRow> rows;
    /** view=UNCALLED — in-window new leads with zero dials ever, newest first. */
    private List<UncalledLeadRow> uncalledRows;
    /** Total rows for the requested view (for pagination). */
    private long totalRows;
    private int page;
    private int size;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Summary {
        private long leadsCalled;
        private long totalDials;
        private long leadsConnected;
        /** Leads with ≥1 callback-category disposition or promised callback_at. */
        private long leadsCallback;
        /** leadsCalled − leadsConnected: tried but never got through. */
        private long leadsNeverConnected;
        /** In-window new leads with zero call attempts ever. */
        private long uncalledNewLeads;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class CalledLeadRow {
        private String responseId;
        private String userId;
        private String leadName;
        private String leadPhone;
        private String leadStatusLabel;
        private String leadStatusColor;
        /** Most recent caller on this lead; name hydrated via auth-service. */
        private String counsellorUserId;
        private String counsellorName;
        private long attempts;
        private long connected;
        private long callbacks;
        private long notPicked;
        private long failed;
        private String lastCallAt;
        private String lastCallStatus;
        private String lastDispositionKey;
        /** Earliest still-future promised callback, if any. */
        private String nextCallbackAt;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class UncalledLeadRow {
        private String responseId;
        private String userId;
        private String leadName;
        private String leadPhone;
        private String sourceType;
        private String submittedAt;
        private String leadStatusLabel;
        private String leadStatusColor;
        /** Assigned counsellor (lead ownership, not call ownership). */
        private String counsellorUserId;
        private String counsellorName;
    }
}
