package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.sql.Timestamp;

/**
 * DTO for lead score details including factor breakdown.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LeadScoreDTO {

    private String audienceResponseId;
    private Integer rawScore;           // 0-100
    private String tier;                // HOT / WARM / COLD
    private BigDecimal percentileRank;  // 0-100
    private Object scoringFactors;      // Parsed JSON breakdown for UI tooltip
    private Timestamp lastCalculatedAt;
}
