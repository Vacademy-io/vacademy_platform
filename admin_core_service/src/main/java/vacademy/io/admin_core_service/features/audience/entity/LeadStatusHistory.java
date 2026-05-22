package vacademy.io.admin_core_service.features.audience.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

/**
 * One lead status transition. Powers conversion-funnel / time-in-stage reporting and
 * audit, and gives automatic status updates a clean place to record what changed.
 */
@Entity
@Table(name = "lead_status_history")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LeadStatusHistory {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "audience_response_id", nullable = false)
    private String audienceResponseId;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "from_status_id")
    private String fromStatusId;

    @Column(name = "to_status_id")
    private String toStatusId;

    @Column(name = "changed_by_user_id")
    private String changedByUserId;

    /** MANUAL | WORKFLOW | AUTO */
    @Column(name = "source", nullable = false, length = 30)
    @Builder.Default
    private String source = "MANUAL";

    @Column(name = "changed_at", insertable = false, updatable = false)
    private Timestamp changedAt;
}
