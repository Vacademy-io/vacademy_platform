package vacademy.io.admin_core_service.features.telephony.persistence.entity;

import jakarta.persistence.*;
import lombok.*;

import java.sql.Timestamp;

/**
 * Per-institute call-outcome vocabulary the "quick disposition" picker uses
 * (Interested, Callback, RNR, Wrong Number, …). Distinct from the lead-status
 * pipeline: a disposition is the OUTCOME of a single call; {@code mapsToLeadStatusId}
 * optionally advances the lead's pipeline status when that outcome is chosen.
 *
 * Seeded lazily on first read (see CallDispositionService) — institutes are
 * created dynamically, so there's no global seed in the migration.
 */
@Entity
@Table(name = "call_disposition_catalog")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CallDispositionCatalog {

    @Id
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "disposition_key", nullable = false, length = 64)
    private String dispositionKey;

    @Column(name = "label", nullable = false, length = 128)
    private String label;

    @Column(name = "color", length = 20)
    private String color;

    /** CONNECTED | NOT_CONNECTED | CALLBACK | OTHER. */
    @Column(name = "category", nullable = false, length = 24)
    private String category;

    /** lead_status.id this outcome routes the lead to; null = recorded-only, no status change. */
    @Column(name = "maps_to_lead_status_id", length = 36)
    private String mapsToLeadStatusId;

    @Column(name = "display_order", nullable = false)
    @Builder.Default
    private Integer displayOrder = 0;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}
