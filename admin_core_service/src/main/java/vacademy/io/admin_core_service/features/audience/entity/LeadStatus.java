package vacademy.io.admin_core_service.features.audience.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

/**
 * A per-institute lead pipeline status (e.g. New, Interested, Demo Scheduled).
 * Replaces the customStatuses list that previously lived inside the LEAD_SETTING JSON,
 * so statuses can be queried, filtered and reported on relationally.
 */
@Entity
@Table(name = "lead_status")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LeadStatus {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    /** Stable code used on the lead + in triggers (e.g. NEW, INTERESTED). */
    @Column(name = "status_key", nullable = false, length = 100)
    private String statusKey;

    @Column(name = "label", nullable = false)
    private String label;

    @Column(name = "color", length = 20)
    private String color;

    @Column(name = "display_order", nullable = false)
    @Builder.Default
    private Integer displayOrder = 0;

    /** Status auto-applied to brand-new leads. */
    @Column(name = "is_default", nullable = false)
    @Builder.Default
    private Boolean isDefault = false;

    /** Soft delete — kept so historical references stay valid. */
    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    /** System default (New/Converted/Lost): editable (rename/recolour) but not deletable. */
    @Column(name = "is_system", nullable = false)
    @Builder.Default
    private Boolean isSystem = false;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at")
    private Timestamp updatedAt;
}
