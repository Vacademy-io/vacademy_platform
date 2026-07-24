package vacademy.io.admin_core_service.features.audience.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.audience.dto.AudienceResponseDTO;

import java.sql.Timestamp;

/**
 * Entity representing a Lead/Response submission to an Audience Campaign
 * Captures leads from multiple sources (website forms, Google Ads, Facebook
 * Ads, etc.)
 */
@Entity
@Table(name = "audience_response")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AudienceResponse {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "audience_id", nullable = true)
    private String audienceId;

    @Column(name = "user_id")
    private String userId; // Parent user ID (references auth_service.users)

    @Column(name = "student_user_id")
    private String studentUserId; // Child/Student user ID - explicitly stores which child this application is for

    @Column(name = "source_type", nullable = false, length = 50)
    private String sourceType; // WEBSITE, GOOGLE_ADS, FACEBOOK_ADS, LINKEDIN_ADS, etc.

    @Column(name = "source_id", length = 100)
    private String sourceId; // Landing page ID, Ad campaign ID, etc.

    @Column(name = "destination_package_session_id")
    private String destinationPackageSessionId;

    @Column(name = "enquiry_id")
    private String enquiryId;

    @Column(name = "parent_name")
    private String parentName;

    @Column(name = "parent_email")
    private String parentEmail;

    @Column(name = "parent_mobile", length = 20)
    private String parentMobile;

    /**
     * Date used for workflow day-difference filtering.
     * Can be offset from creation date based on audience
     * workflow_setting.offset_day
     */
    @Column(name = "workflow_activate_day_at")
    private Timestamp workflowActivateDayAt;

    @Column(name = "submitted_at", insertable = false, updatable = false)
    private Timestamp submittedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    @Column(name = "applicant_id")
    private String applicantId;

    @Column(name = "conversion_status", length = 50)
    private String conversionStatus;

    @Column(name = "overall_status", length = 50)
    private String overallStatus;

    /**
     * Soft-delete lifecycle — {@link vacademy.io.admin_core_service.features.audience.enums.AudienceStatusEnum}
     * as a bare String, matching how the other status columns on this row are stored.
     * NOT NULL DEFAULT 'ACTIVE' in the DB (V359), so existing rows and any insert path that
     * doesn't set it explicitly are ACTIVE.
     */
    @Column(name = "audience_status", length = 50, nullable = false)
    @Builder.Default
    private String audienceStatus = "ACTIVE";

    // ── Deduplication fields ──────────────────────────────────

    /** SHA-256 hash of normalized email+phone for dedup within campaign */
    @Column(name = "dedupe_key", length = 64)
    private String dedupeKey;

    /** True if this response is a known duplicate of another */
    @Column(name = "is_duplicate")
    @Builder.Default
    private Boolean isDuplicate = false;

    /** If duplicate, references the primary/original response ID */
    @Column(name = "primary_response_id")
    private String primaryResponseId;

    // ── TAT / Follow-up SLA reminder dedup state ──────────────
    // Linear stage machine: BEFORE_* -> OVERDUE -> FOLLOW_UP_DUE -> FOLLOW_UP_OVERDUE.
    // The scheduler only EMITS workflow triggers; these columns guarantee one emit per stage.

    /** Number of reminder stages emitted for this lead (monotonic). */
    @Column(name = "tat_reminder_count")
    @Builder.Default
    private Integer tatReminderCount = 0;

    /** Last stage emitted (e.g. BEFORE_30M, OVERDUE, FOLLOW_UP_DUE, FOLLOW_UP_OVERDUE). */
    @Column(name = "tat_reminder_stage", length = 40)
    private String tatReminderStage;

    /** Race guard: {leadId}_{counselorId}_{stage}; backed by a partial-unique index. */
    @Column(name = "tat_reminder_dedup_key", length = 255)
    private String tatReminderDedupKey;

    /** Counselor the last reminder was emitted for; a different current counselor resets the cycle. */
    @Column(name = "tat_reminder_assignee_id", length = 255)
    private String tatReminderAssigneeId;

    /** Denormalized TAT deadline (submitted_at + tatHours) for scanning + the frontend badge. */
    @Column(name = "tat_due_at")
    private Timestamp tatDueAt;

    /** Current pipeline status (FK to lead_status.id). Replaces the JSON/enquiry_status approach. */
    @Column(name = "lead_status_id")
    private String leadStatusId;

    /** Snapshot of audience.defaultInitialScore at creation time. Null for leads created before this feature → treated as 0 in scoring. */
    @Column(name = "initial_score")
    private Integer initialScore;

    /**
     * Constructor from DTO
     */
    public AudienceResponse(AudienceResponseDTO dto) {
        this.id = dto.getId();
        this.audienceId = dto.getAudienceId();
        this.userId = dto.getUserId();
        this.sourceType = dto.getSourceType();
        this.sourceId = dto.getSourceId();
    }
}
