package vacademy.io.admin_core_service.features.counsellor_workbench.service;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * Flat view of the workbench config that lives inside LEAD_SETTING JSON.
 * Used by both reads (controller responses) and writes (request bodies).
 * Defaults match {@link LeadWorkbenchSettingService#get} fallback behaviour.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class WorkbenchConfig {

    private String instituteId;

    /** Root team for the leads/sales subtree. Null until admin sets it. */
    private String leadsTeamId;

    // ── Rating strategy (flat — service handles JSON nesting) ────────────
    private String strategyType;            // STATIC | STRATEGY_BASED
    private BigDecimal startingRating;
    private Integer windowDays;
    private List<String> successStatusKeys;
    private BigDecimal wConversion;
    private BigDecimal wVelocity;
    private Integer idealVelocityHours;
    private Integer worstVelocityHours;
    private Integer minSampleSize;

    public static WorkbenchConfig withDefaults(String instituteId) {
        return WorkbenchConfig.builder()
                .instituteId(instituteId)
                .leadsTeamId(null)
                .strategyType("STRATEGY_BASED")
                .startingRating(BigDecimal.ZERO)
                .windowDays(90)
                .successStatusKeys(List.of("CONVERTED"))
                .wConversion(new BigDecimal("0.6"))
                .wVelocity(new BigDecimal("0.4"))
                .idealVelocityHours(24)
                .worstVelocityHours(720)
                .minSampleSize(5)
                .build();
    }
}
