package vacademy.io.admin_core_service.features.audience.dto.reports.custom;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * GET /v1/reports/custom/catalog — the self-serve report builder's whitelisted semantic model.
 *
 * The builder NEVER accepts raw SQL. The catalog advertises exactly which dimensions (group-by),
 * measures (aggregates) and filterable fields the server understands; {@code /custom/run} rejects
 * anything not listed here. Filter options for the small enumerable fields (source, tier, status,
 * counsellor) are pre-resolved so the FE can render multi-selects without extra calls.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CustomReportCatalogDTO {

    private List<Field> dimensions;
    private List<Field> measures;
    private List<FilterField> filters;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Field {
        private String key;
        private String label;
        /** 'string' | 'number' (measures only; dimensions are always string-ish labels). */
        private String type;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class FilterField {
        private String key;
        private String label;
        /** Pre-resolved choices ({value,label}); empty for free-form fields. */
        private List<Option> options;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Option {
        private String value;
        private String label;
    }
}
