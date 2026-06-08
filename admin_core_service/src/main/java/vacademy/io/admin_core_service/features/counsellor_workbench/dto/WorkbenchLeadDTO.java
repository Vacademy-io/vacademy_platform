package vacademy.io.admin_core_service.features.counsellor_workbench.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;

/**
 * One row in the workbench's lead list. Built from UserLeadProfile +
 * the latest AudienceResponse so the UI can show campaign + status without
 * a second fetch.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class WorkbenchLeadDTO {
    private String leadId;                  // user_lead_profile.id
    private String userId;                  // user_lead_profile.user_id
    private String leadName;
    private String leadEmail;
    private String leadPhone;
    private String conversionStatus;        // LEAD / CONVERTED / LOST or custom
    private String leadStatusLabel;         // resolved label from lead_status table when present
    private String leadTier;                // HOT / WARM / COLD
    private Integer bestScore;
    private String assignedCounselorId;
    private String assignedCounselorName;
    private Timestamp assignedAt;
    private Timestamp lastActivityAt;
    private String campaignName;
    private String sourceType;
}
