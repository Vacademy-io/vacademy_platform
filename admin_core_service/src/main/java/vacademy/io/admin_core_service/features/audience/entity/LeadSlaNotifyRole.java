package vacademy.io.admin_core_service.features.audience.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

/**
 * An institute role to notify when a TAT / follow-up trigger fires. Passed into the workflow
 * trigger context (ctx.notifyRoles) so the workflow targets these roles.
 */
@Entity
@Table(name = "lead_sla_notify_role")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LeadSlaNotifyRole {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    /** TAT | FOLLOWUP */
    @Column(name = "sla_type", nullable = false, length = 20)
    private String slaType;

    @Column(name = "role_name", nullable = false)
    private String roleName;
}
