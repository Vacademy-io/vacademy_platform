package vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ReportPeriodSection {

    /** ISO date string "YYYY-MM-DD". */
    private String startDate;

    /** ISO date string "YYYY-MM-DD". */
    private String endDate;

    /** Human-readable label, e.g. "1–30 June 2026". */
    private String label;

    /** Number of days in the report window (endDate - startDate + 1). */
    private Integer days;

    /** ISO datetime when the report was generated. */
    private String generatedAt;
}
