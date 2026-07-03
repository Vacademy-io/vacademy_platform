package vacademy.io.admin_core_service.features.counsellor_target.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;

/**
 * Ask for target-vs-completed progress for a set of counsellors over a window.
 *
 * periodType picks the timeline; fromDate/toDate are optional overrides:
 *   * WEEK / MONTH  → omit dates to use the current week/month (institute TZ);
 *                     supply them to look at a specific past week/month.
 *   * CUSTOM        → fromDate/toDate are required.
 */
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CounsellorTargetProgressRequest {
    private String instituteId;
    private List<String> counsellorUserIds;
    private String periodType;   // WEEK | MONTH | CUSTOM
    private String fromDate;     // yyyy-MM-dd (optional for WEEK/MONTH)
    private String toDate;       // yyyy-MM-dd (optional for WEEK/MONTH)
}
