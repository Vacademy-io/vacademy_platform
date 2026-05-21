package vacademy.io.admin_core_service.features.audience.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

/**
 * A "remind N minutes before the deadline" window for the TAT SLA. An institute can have
 * several (e.g. 60 min and 15 min before) to escalate.
 */
@Entity
@Table(name = "lead_sla_reminder_window")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LeadSlaReminderWindow {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    /** TAT (only TAT has multiple before-windows; follow-up's single window is on lead_sla_config). */
    @Column(name = "sla_type", nullable = false, length = 20)
    @Builder.Default
    private String slaType = "TAT";

    @Column(name = "before_minutes", nullable = false)
    private Integer beforeMinutes;

    @Column(name = "display_order", nullable = false)
    @Builder.Default
    private Integer displayOrder = 0;
}
