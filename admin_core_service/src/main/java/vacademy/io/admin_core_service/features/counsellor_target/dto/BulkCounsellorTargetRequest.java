package vacademy.io.admin_core_service.features.counsellor_target.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;

/** Apply the same target to many counsellors at once (bulk-apply to a team). */
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class BulkCounsellorTargetRequest {
    private String instituteId;
    private List<String> counsellorUserIds;
    private String metric;       // CONVERSIONS | LEADS_ASSIGNED | CALLS_MADE
    private String periodType;   // WEEK | MONTH | CUSTOM
    private Integer targetValue;
    private String periodStart;  // yyyy-MM-dd, CUSTOM only
    private String periodEnd;    // yyyy-MM-dd, CUSTOM only
}
