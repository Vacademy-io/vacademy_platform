package vacademy.io.admin_core_service.features.invoice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;

/**
 * Remembered "Bill To" details for a user within an institute, so the admin
 * Create-Invoice dialog can prefill the user-linked template fields instead of
 * re-typing them each time. Upserted (last-write-wins) whenever an admin creates a
 * single-user invoice; used only to seed editable defaults — never authoritative.
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Entity
@Table(name = "invoice_billing_profile")
public class InvoiceBillingProfile {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "billing_name", length = 512)
    private String billingName;

    @Column(name = "billing_email", length = 320)
    private String billingEmail;

    @Column(name = "billing_address", columnDefinition = "TEXT")
    private String billingAddress;

    // Buyer tax id (GSTIN / VAT number) — maps to the {{user_tax_info}} placeholder.
    @Column(name = "tax_info", length = 255)
    private String taxInfo;

    @Column(name = "place_of_supply", length = 255)
    private String placeOfSupply;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    // Hibernate-managed so the timestamp advances on every upsert-update (Postgres has no
    // implicit ON UPDATE and the table has no trigger).
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
