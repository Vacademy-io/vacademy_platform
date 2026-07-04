package vacademy.io.admin_core_service.features.counsellor_target.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Target-vs-completed for a set of counsellors over a resolved window. The
 * "completed" numbers are computed live (getCounselorPerformance for
 * conversions/leads, a telephony_call_log count for calls), so they always
 * agree with the Reports Center.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CounsellorTargetProgressDTO {

    private String periodType;   // WEEK | MONTH | CUSTOM
    private String fromDate;     // resolved window start (yyyy-MM-dd)
    private String toDate;       // resolved window end (yyyy-MM-dd)
    private List<Row> rows;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Row {
        private String counsellorUserId;
        private List<Item> items;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Item {
        private String metric;        // CONVERSIONS | LEADS_ASSIGNED | CALLS_MADE
        /** null when no target is set for this metric+period. */
        private Integer targetValue;
        private long completed;
        /** completed ÷ target × 100; null when no target set. */
        private Double attainmentPct;
    }
}
