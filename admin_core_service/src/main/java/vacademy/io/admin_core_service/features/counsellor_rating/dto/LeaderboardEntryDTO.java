package vacademy.io.admin_core_service.features.counsellor_rating.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LeaderboardEntryDTO {
    private Integer rank;
    private String counsellorUserId;
    private String fullName;
    private BigDecimal score;
    private BigDecimal conversionRatioScore;
    private BigDecimal velocityScore;
    private Integer sampleSize;
    private String strategyType;
}
