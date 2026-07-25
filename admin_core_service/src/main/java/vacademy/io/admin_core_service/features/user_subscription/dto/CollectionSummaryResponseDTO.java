package vacademy.io.admin_core_service.features.user_subscription.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Aggregated PAID collection over a date window: the grand total plus a per-day
 * series (ascending by date) for charting.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CollectionSummaryResponseDTO {
    private double totalAmount;
    private long totalCount;
    /** Dominant currency of the summed payments (free-form string, e.g. "INR"). */
    private String currency;
    private List<DailyPoint> daily;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class DailyPoint {
        /** YYYY-MM-DD (UTC). */
        private String date;
        private double amount;
        private long count;
    }
}
