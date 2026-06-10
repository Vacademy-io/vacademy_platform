package vacademy.io.admin_core_service.features.counsellor_workbench.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;

/**
 * One row in the counsellor's activity feed. The feed is built by UNION-ing
 * three existing tables (telephony_call_log, lead_followup, timeline_event),
 * so source_table tells the UI which detail screen to deep-link.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ActivityFeedItemDTO {
    private String id;
    private String sourceTable;            // 'telephony_call_log' | 'lead_followup' | 'timeline_event'
    private String actionType;             // canonical label: CALL | FOLLOWUP_CREATED | FOLLOWUP_CLOSED | STATUS_CHANGED | NOTE_ADDED | LEAD_TRANSFERRED_OUT | LEAD_TRANSFERRED_IN
    private String leadId;                 // user_lead_profile.id when resolvable; null for orphan rows
    private String leadName;
    private String title;
    private String description;
    private String metadataJson;
    private Timestamp createdAt;
}
