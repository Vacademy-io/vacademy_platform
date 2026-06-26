package vacademy.io.admin_core_service.features.audience.dto.reports.custom;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * POST /v1/reports/custom/run result — a tabular grid. {@code columns} are the selected dimensions
 * (in order) followed by the selected measures; each row in {@code rows} is cell-aligned to it.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CustomReportResponseDTO {

    private List<Column> columns;
    /** Cell values aligned to {@code columns}; numbers for measures, strings for dimensions. */
    private List<List<Object>> rows;
    private int rowCount;
    /** True when the row cap was hit (more rows exist than returned). */
    private boolean truncated;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Column {
        private String key;
        private String label;
        /** 'dimension' | 'measure'. */
        private String kind;
        /** 'string' | 'number'. */
        private String type;
    }
}
