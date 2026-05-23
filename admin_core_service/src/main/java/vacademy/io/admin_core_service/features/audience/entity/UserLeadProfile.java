package vacademy.io.admin_core_service.features.audience.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

/**
 * Aggregated lead profile per user, across all campaigns in an institute.
 * Updated asynchronously after score recalculation or lead events.
 * Keyed by (user_id, institute_id) — user_id can be a parent or a student.
 */
@Entity
@Table(name = "user_lead_profile")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserLeadProfile {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    /** Auth user ID — parent user ID if parent flow, student user ID if direct enrollment. */
    @Column(name = "user_id", nullable = false, unique = true)
    private String userId;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    /** Best raw_score across all audience_responses for this user. */
    @Column(name = "best_score", nullable = false)
    @Builder.Default
    private Integer bestScore = 0;

    /** audience_response.id that produced the best score. */
    @Column(name = "best_score_response_id")
    private String bestScoreResponseId;

    /** HOT / WARM / COLD — derived from bestScore. */
    @Column(name = "lead_tier", length = 10)
    private String leadTier;

    /** LEAD | CONVERTED | LOST. Once CONVERTED, score updates are frozen. */
    @Column(name = "conversion_status", nullable = false, length = 20)
    @Builder.Default
    private String conversionStatus = "LEAD";

    @Column(name = "converted_at")
    private Timestamp convertedAt;

    /**
     * First time this profile's conversion_status moved off the default 'LEAD' — set ONCE,
     * by UserLeadProfileService on first non-default status change (or first markConverted).
     * Powers the "Reach out by → ✓ Responded in N" display in the leads tables / reports.
     */
    @Column(name = "first_response_at")
    private Timestamp firstResponseAt;

    /** How many distinct campaigns (audiences) this user has submitted to. */
    @Column(name = "campaign_count", nullable = false)
    @Builder.Default
    private Integer campaignCount = 0;

    /** Source type (e.g. WALK_IN, GOOGLE_ADS) of the best-scoring response. */
    @Column(name = "best_source_type")
    private String bestSourceType;

    /** Total timeline/note events across all campaigns for this user. */
    @Column(name = "total_timeline_events", nullable = false)
    @Builder.Default
    private Integer totalTimelineEvents = 0;

    /** Number of demo class logins recorded for this user. */
    @Column(name = "demo_login_count", nullable = false)
    @Builder.Default
    private Integer demoLoginCount = 0;

    /** Number of live sessions where attendance was recorded for this user. */
    @Column(name = "demo_attendance_count", nullable = false)
    @Builder.Default
    private Integer demoAttendanceCount = 0;

    /** Timestamp of the most recent lead activity (submission, note, login, etc.). */
    @Column(name = "last_activity_at")
    private Timestamp lastActivityAt;

    @Column(name = "last_calculated_at", nullable = false)
    @Builder.Default
    private Timestamp lastCalculatedAt = new Timestamp(System.currentTimeMillis());

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    /** Auth user ID of the assigned counselor (nullable). */
    @Column(name = "assigned_counselor_id")
    private String assignedCounselorId;

    /** Cached display name of the assigned counselor (nullable). */
    @Column(name = "assigned_counselor_name")
    private String assignedCounselorName;

    @Column(name = "updated_at")
    private Timestamp updatedAt;

    /** Compute tier from bestScore (same thresholds as LeadScore). */
    public String computeTier() {
        if (bestScore >= 80) return "HOT";
        if (bestScore >= 50) return "WARM";
        return "COLD";
    }
}
