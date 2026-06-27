package vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Report metadata section — always present at the top of the v2 report.
 * Serializes as {@code meta} in the top-level JSON.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class MetaSection {

    /** Always "v2". */
    @Builder.Default
    private String reportVersion = "v2";

    /** Human-readable report name, e.g. "June 2026 Progress Report". */
    private String reportName;

    /** Unique report ID derived from the process ID. */
    private String reportId;

    /** ISO datetime when the report was generated. */
    private String generatedAt;

    /** Language code, default "en". */
    @Builder.Default
    private String language = "en";
}
