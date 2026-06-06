package vacademy.io.admin_core_service.features.telephony.persistence.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

/**
 * One row per ExoPhone (or equivalent). Multiple per institute — the selector
 * strategies route between them per call.
 */
@Entity
@Table(name = "telephony_provider_number")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TelephonyProviderNumber {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "config_id", nullable = false)
    private String configId;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "provider_type", nullable = false, length = 32)
    private String providerType;

    @Column(name = "phone_number", nullable = false, length = 20)
    private String phoneNumber;

    @Column(name = "provider_resource_id", length = 64)
    private String providerResourceId;

    @Column(name = "label", length = 64)
    private String label;

    /** STD code or region tag used by REGION_MATCH selector — free-form. */
    @Column(name = "region", length = 64)
    private String region;

    @Column(name = "priority", nullable = false)
    @Builder.Default
    private Integer priority = 100;

    @Column(name = "enabled", nullable = false)
    @Builder.Default
    private Boolean enabled = true;

    /**
     * Outcome of the most recent Exotel-flow attach attempt:
     *   ATTACHED | PENDING | FAILED | DETACHED.
     * NULL = never attempted (e.g. {@code flow_sid} was empty when this
     * number was created). The Numbers card surfaces this as a status pill.
     */
    @Column(name = "flow_attach_status", length = 16)
    private String flowAttachStatus;

    /** Body of the failure response when {@code flow_attach_status = FAILED}. */
    @Column(name = "flow_attach_error", columnDefinition = "TEXT")
    private String flowAttachError;

    @Column(name = "flow_attached_at")
    private Timestamp flowAttachedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}
