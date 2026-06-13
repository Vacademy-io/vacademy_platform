package vacademy.io.admin_core_service.features.audience.dto.reports.calling;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * GET /v1/reports/calls-heatmap — dials/connects bucketed by day-of-week × hour
 * in the institute timezone. Only non-empty cells are emitted; the FE fills the
 * full 7×24 grid with zeroes.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CallsHeatmapResponseDTO {

    private List<Cell> cells;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Cell {
        /** ISO day-of-week: 1 = Monday … 7 = Sunday (institute TZ). */
        private int dow;
        /** Hour of day 0–23 (institute TZ). */
        private int hour;
        private long dials;
        private long connected;
    }
}
