package vacademy.io.admin_core_service.features.audience.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

/**
 * Per-institute TAT + Follow-up SLA configuration. Replaces the tatReminder/followUp
 * objects that used to live inside the LEAD_SETTING JSON. One row per institute.
 */
@Entity
@Table(name = "lead_sla_config")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LeadSlaConfig {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "institute_id", nullable = false, unique = true)
    private String instituteId;

    @Column(name = "tat_enabled", nullable = false)
    @Builder.Default
    private Boolean tatEnabled = false;

    /** Legacy whole-hour TAT, kept in sync as CEIL(tatMinutes / 60). Read tatMinutes instead. */
    @Column(name = "tat_hours", nullable = false)
    @Builder.Default
    private Integer tatHours = 24;

    /** TAT duration in minutes — the source of truth since V550. */
    @Column(name = "tat_minutes", nullable = false)
    @Builder.Default
    private Integer tatMinutes = 1440;

    @Column(name = "followup_enabled", nullable = false)
    @Builder.Default
    private Boolean followupEnabled = false;

    /** Legacy whole-hour follow-up SLA, kept in sync as CEIL(followupSlaMinutes / 60). */
    @Column(name = "followup_sla_hours", nullable = false)
    @Builder.Default
    private Integer followupSlaHours = 24;

    /** Follow-up SLA duration in minutes — the source of truth since V550. */
    @Column(name = "followup_sla_minutes", nullable = false)
    @Builder.Default
    private Integer followupSlaMinutes = 1440;

    @Column(name = "followup_remind_before_minutes", nullable = false)
    @Builder.Default
    private Integer followupRemindBeforeMinutes = 30;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at")
    private Timestamp updatedAt;
}
