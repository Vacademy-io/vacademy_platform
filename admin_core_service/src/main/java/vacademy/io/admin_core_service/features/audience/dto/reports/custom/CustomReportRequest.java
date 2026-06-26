package vacademy.io.admin_core_service.features.audience.dto.reports.custom;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;

/**
 * POST body for /v1/reports/custom/run. Every {@code field} string is validated against the
 * catalog whitelist server-side; unknown keys are rejected. Filter values bind as JDBC parameters.
 */
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CustomReportRequest {

    private String instituteId;
    /** yyyy-MM-dd (institute TZ), inclusive; optional — defaults to last 30 days. */
    private String fromDate;
    private String toDate;
    private String teamId;
    private String counsellorUserId;

    /** ≥1 dimension key from the catalog (group-by, in display order). */
    private List<String> dimensions;
    /** ≥1 measure key from the catalog. */
    private List<String> measures;
    private List<Filter> filters;
    private Sort sort;
    /** Row cap; clamped server-side to [1, 1000]. */
    private Integer limit;

    @Data
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Filter {
        /** A filterable field key from the catalog. */
        private String field;
        /** Match any of these values (IN list). */
        private List<String> values;
    }

    @Data
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Sort {
        /** A selected dimension or measure key. */
        private String field;
        /** 'asc' | 'desc' (default desc). */
        private String dir;
    }
}
