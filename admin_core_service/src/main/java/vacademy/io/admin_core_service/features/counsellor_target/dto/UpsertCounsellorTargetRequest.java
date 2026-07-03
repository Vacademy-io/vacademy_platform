package vacademy.io.admin_core_service.features.counsellor_target.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

/** Set/replace one counsellor's target for a (metric, period) slot. */
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class UpsertCounsellorTargetRequest {
    private String instituteId;
    private String counsellorUserId;
    private String metric;       // CONVERSIONS | LEADS_ASSIGNED | CALLS_MADE
    private String periodType;   // WEEK | MONTH | CUSTOM
    private Integer targetValue;
    private String periodStart;  // yyyy-MM-dd, CUSTOM only
    private String periodEnd;    // yyyy-MM-dd, CUSTOM only
}
