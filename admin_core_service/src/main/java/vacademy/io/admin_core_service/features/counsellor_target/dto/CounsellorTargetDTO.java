package vacademy.io.admin_core_service.features.counsellor_target.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One configured target as stored under the institute setting blob
 * (LEAD_SETTING → data → workbench → targets → &lt;counsellorUserId&gt; → [ ... ]).
 * period_start / period_end are yyyy-MM-dd, set only for CUSTOM targets.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CounsellorTargetDTO {
    /** Stable id so the frontend can delete/replace a specific (esp. custom) target. */
    private String id;
    private String counsellorUserId;
    /** CONVERSIONS | LEADS_ASSIGNED | CALLS_MADE. */
    private String metric;
    /** WEEK | MONTH | CUSTOM. */
    private String periodType;
    private Integer targetValue;
    /** CUSTOM only (yyyy-MM-dd). */
    private String periodStart;
    /** CUSTOM only (yyyy-MM-dd). */
    private String periodEnd;
}
