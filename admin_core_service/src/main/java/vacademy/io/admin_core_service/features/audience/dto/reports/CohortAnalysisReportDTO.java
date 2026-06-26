package vacademy.io.admin_core_service.features.audience.dto.reports;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * GET /v1/reports/cohort-analysis — leads grouped by ACQUISITION MONTH (the institute-TZ month of
 * {@code user_lead_profile.created_at}), tracking how each acquisition cohort matured.
 *
 * Per cohort:
 *   leads            — leads acquired that month (scoped, this institute)
 *   converted        — of those, how many ever reached conversion_status = 'CONVERTED'
 *   conversion_rate  — converted / leads (0–100)
 *   revenue          — lifetime PAID revenue from that cohort's converted leads
 *   avg_deal_value   — revenue / converted
 *   revenue_per_lead — revenue / leads (acquisition-cost yardstick)
 *   median_days_to_convert — converted_at − created_at median, in days
 *
 * Cohorts are the acquisition months that fall inside the [from, to) window; pick a wider range
 * (90d / custom) to see more cohorts. Amounts are in {@link #currency}.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CohortAnalysisReportDTO {

    private String currency;
    private List<CohortRow> cohorts;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class CohortRow {
        /** Acquisition month, yyyy-MM (institute TZ). */
        private String cohort;
        private long leads;
        private long converted;
        /** % 0–100, one decimal; null when leads = 0. */
        private Double conversionRate;
        private double revenue;
        /** revenue / converted — null when converted = 0. */
        private Double avgDealValue;
        /** revenue / leads — null when leads = 0. */
        private Double revenuePerLead;
        /** Median days from acquisition to conversion; null when no conversions. */
        private Double medianDaysToConvert;
    }
}
