package vacademy.io.admin_core_service.features.sales_dashboard.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Deterministic, computed insight strip — NOT LLM-generated. Each insight
 * has a severity so the UI can colour-code; the message is human-ready.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class InsightDTO {
    private String key;                  // stable identifier ('CONVERSION_WOW', 'OVERDUE_SPIKE', …)
    private String severity;             // INFO | SUCCESS | WARN | DANGER
    private String headline;
    private String detail;
}
