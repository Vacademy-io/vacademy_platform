package vacademy.io.admin_core_service.features.audience.dto.reports;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * GET /v1/reports/funnel-velocity — per-stage throughput + dwell time derived from
 * lead_status_history "stints" (a stint = the interval between a transition INTO a status and
 * the lead's next transition, via LEAD() OVER (PARTITION BY lead ORDER BY changed_at)).
 *
 * Stage semantics (window = stints STARTED in range, institute TZ; RBAC-scoped; OPTED_OUT excluded):
 *   entered              — transitions into the stage in-window
 *   current_stock        — leads holding this status RIGHT NOW (point-in-time, not date-bounded)
 *   median_days_in_stage — PERCENTILE_CONT(0.5) over completed stints that started in-window
 *   advanced / regressed — completed stints that moved to a higher / lower display_order status
 *   advanced_rate        — advanced / entered as a 0–100 percentage (null when entered = 0)
 *
 * Overall:
 *   median_days_to_convert — for leads with a CONVERTED transition in-window: median of
 *                            (converted_at − first history row, falling back to submitted_at)
 *   conversion_rate        — won-in-window / submitted-in-window, same cohort definitions as
 *                            the source-performance totals
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class FunnelVelocityReportDTO {

    private List<Stage> stages;
    private Overall overall;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Stage {
        private String statusKey;
        private String label;
        private String color;
        private int displayOrder;
        private long entered;
        private long currentStock;
        private Double medianDaysInStage; // null when no completed in-window stints
        private long advanced;
        private Double advancedRate;      // % 0–100, one decimal; null when entered = 0
        private long regressed;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Overall {
        private Double medianDaysToConvert; // null when nothing converted in-window
        private Double conversionRate;      // % 0–100, one decimal; null when no leads in-window
    }
}
