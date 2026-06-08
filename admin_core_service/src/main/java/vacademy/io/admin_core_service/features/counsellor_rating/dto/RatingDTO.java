package vacademy.io.admin_core_service.features.counsellor_rating.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.sql.Timestamp;

/**
 * Per-counsellor cached rating. Persisted inside the institute_setting JSON
 * under LEAD_SETTING.workbench.counsellor_ratings.{userId}, so this DTO is
 * also the on-disk shape — Jackson serializes it directly via
 * {@code ObjectMapper.valueToTree(...)} / {@code treeToValue(...)} inside
 * LeadWorkbenchSettingService.
 *
 * Null-component fields are dropped on write so STATIC entries stay small
 * (no junk conversion_ratio_score / velocity_score).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RatingDTO {
    private String counsellorUserId;
    private String instituteId;
    /** STATIC | STRATEGY_BASED — snapshot of the strategy that produced this score. */
    private String strategyType;
    /** 0..100. The "effective" score callers should read. */
    private BigDecimal score;
    /** Component, populated only for STRATEGY_BASED snapshots. */
    private BigDecimal conversionRatioScore;
    /** Component, populated only for STRATEGY_BASED snapshots. */
    private BigDecimal velocityScore;
    /** Assigned leads observed in the window. NULL for STATIC. */
    private Integer sampleSize;
    private Timestamp lastComputedAt;
    /** Remembered admin-set value. Survives strategy toggles. */
    private BigDecimal manualOverride;
}
