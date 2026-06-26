package vacademy.io.admin_core_service.features.audience.dto.reports;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * GET /v1/reports/revenue-forecast — projected revenue for the next 30 / 60 / 90 days.
 *
 * Leads carry no stored deal value, so the forecast is derived from history and the live pipeline
 * and is fully auditable via {@link #assumptions}. Two independent signals per horizon:
 *
 *   run_rate_revenue  — trailing average daily collected revenue × horizon days.
 *   pipeline_revenue  — open leads expected to convert and pay within the horizon:
 *                       open_pipeline_leads × historical_conversion_rate × avg_deal_value,
 *                       ramped in by horizon (≈ horizon ÷ 90, capped at 1.0) since the open
 *                       pipeline converts over roughly the trailing conversion window.
 *   blended_revenue   — the average of the two signals (a deliberately simple consensus).
 *
 * The forecast is global to the resolved RBAC scope (not source/counsellor split).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class RevenueForecastDTO {

    private String currency;
    private Assumptions assumptions;
    private List<HorizonRow> horizons;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Assumptions {
        /** Trailing window the history metrics were computed over (days). */
        private int trailingDays;
        /** Collected revenue over the trailing window. */
        private double trailingRevenue;
        /** trailingRevenue / trailingDays. */
        private double avgDailyRevenue;
        /** Leads acquired in the trailing window. */
        private long trailingLeads;
        /** Of those, how many converted — drives the historical conversion rate. */
        private long trailingConversions;
        /** % 0–100; null when trailingLeads = 0. */
        private Double historicalConversionRate;
        /** trailingRevenue / paying converted leads in the trailing window; null when none. */
        private Double avgDealValue;
        /** Open leads right now (conversion_status = 'LEAD'), scoped. */
        private long openPipelineLeads;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class HorizonRow {
        /** 30, 60 or 90. */
        private int days;
        private double runRateRevenue;
        private double pipelineRevenue;
        private double blendedRevenue;
    }
}
