package vacademy.io.admin_core_service.features.counsellor_workbench.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * A counsellor row in the workbench's left rail. Carries rating + open-lead
 * count so the card renders complete in one round-trip.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class WorkbenchCounsellorDTO {
    private String userId;
    private String fullName;
    private String email;
    private String teamId;
    private String teamName;
    private String roleLabel;
    private Boolean isActive;
    private Long openLeadsCount;
    private BigDecimal rating;
    private String ratingStrategyType;     // STATIC or STRATEGY_BASED — for badge styling
}
