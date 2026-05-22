package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;
import java.util.Map;
import vacademy.io.common.auth.dto.UserDTO;

/**
 * DTO for detailed lead information with custom field values
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LeadDetailDTO {

    private String responseId;
    private String audienceId;
    private String campaignName;
    private String userId;
    private String studentUserId;
    private String sourceType;
    private String sourceId;
    private Timestamp submittedAtLocal;
    
    // Optional hydrated user details (batch fetched)
    private UserDTO user;
    
    // Custom field values with field metadata
    // Key: fieldKey (e.g., "email", "phone"), Value: submitted value
    private Map<String, String> customFieldValues;
    
    // Additional metadata
    private Map<String, Object> customFieldMetadata; // fieldKey -> {fieldName, fieldType, etc.}

    // ── Lead Score (auto-populated from lead_score table) ──
    private Integer leadScore;              // Raw score 0-100
    private String leadTier;                // HOT / WARM / COLD
    private Double percentileRank;          // 0-100

    // ── Counselor Assignment ──
    private String assignedCounselorId;
    private String assignedCounselorName;

    // ── Dedup Info ──
    private Boolean isDuplicate;
    private String primaryResponseId;

    // ── Parent Info ──
    private String parentName;
    private String parentEmail;
    private String parentMobile;

    // ── Status ──
    private String overallStatus;
    private String conversionStatus;
    private String enquiryId;
    /** Custom pipeline status (from the linked enquiry's enquiry_status, e.g. NEW / INTERESTED). */
    private String leadStatus;

    // ── Opt-Out Source ──
    private String sourceAudienceName; // name of the audience the user opted out FROM

    // ── TAT / Follow-up SLA (deadlines computed live from SLA config; badges from scheduler state) ──
    private Timestamp tatDueAt;          // reach-out deadline = submitted_at + tatHours (computed live when TAT enabled)
    private Timestamp followUpDueAt;     // follow-up deadline = last counselor action + followUpSlaHours (null until acted)
    private String tatReminderStage;     // canonical stage last emitted: TAT_BEFORE / TAT_OVERDUE / FOLLOW_UP_DUE / FOLLOW_UP_OVERDUE
    private Boolean tatOverdue;          // TAT breached and counselor hasn't acted
    private Boolean tatDueSoon;          // inside a "before TAT" / follow-up-due window
    private Boolean followUpOverdue;     // follow-up SLA crossed
}

