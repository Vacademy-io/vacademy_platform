package vacademy.io.admin_core_service.features.sales_dashboard.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One row of the "where do conversions come from" widget. Counts both the
 * raw lead volume and the converted subset per source so the UI can render a
 * conversion-rate percentage alongside the absolute numbers.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SourceConversionDTO {
    /** Source label as stored on audience_response.source_type (e.g. META, GOOGLE, ORGANIC). */
    private String source;
    /** Total leads that came in from this source within the window. */
    private long leads;
    /** Subset of {@link #leads} that converted within the window. */
    private long conversions;
    /** 0–100 (rounded) — conversions / leads * 100. 0 when leads = 0. */
    private double conversionRate;
}
