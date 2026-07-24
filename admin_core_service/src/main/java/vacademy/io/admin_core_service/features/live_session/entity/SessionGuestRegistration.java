package vacademy.io.admin_core_service.features.live_session.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "session_guest_registrations", uniqueConstraints = {
                @UniqueConstraint(columnNames = { "session_id", "email" })
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SessionGuestRegistration {

        @Id
        private String id;

        @Column(name = "session_id", nullable = false)
        private String sessionId;

        // Nullable since V398: phone-identity institutes register without email.
        // At least one of email / mobileNumber is always present (service-enforced).
        @Column
        private String email;

        // Second guest identity (V398), unique per session when present. Stored
        // digits-only (E.164 without the "+") so lookups are format-insensitive.
        @Column(name = "mobile_number")
        private String mobileNumber;

        @Column(name = "registered_at", columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
        private LocalDateTime registeredAt;

        // ── Paid live-session fields (V397) ─────────────────────────────────
        // Payers always get an auth user (created on registration if needed) so the
        // invoice machinery — which requires a non-null user — can bill them.
        @Column(name = "user_id")
        private String userId;

        // NULL = free-session registration; PENDING = awaiting payment; PAID = settled.
        @Column(name = "payment_status")
        private String paymentStatus;

        @Column(name = "payment_amount")
        private java.math.BigDecimal paymentAmount;

        @Column(name = "payment_currency")
        private String paymentCurrency;

        // Invoice (source=LIVE_SESSION) raised for this registration; the open
        // /pay/invoice/{id} page settles it and the webhook flips paymentStatus.
        @Column(name = "invoice_id")
        private String invoiceId;

        @Column(name = "payment_log_id")
        private String paymentLogId;

        @PrePersist
        @PreUpdate
        private void normalizeIdentity() {
                if (this.email != null) {
                        this.email = this.email.toLowerCase();
                }
                this.mobileNumber = normalizeMobileNumber(this.mobileNumber);
        }

        /** Digits-only canonical form ("+91 98765-43210" → "919876543210"); null when blank. */
        public static String normalizeMobileNumber(String raw) {
                if (raw == null) {
                        return null;
                }
                String digits = raw.replaceAll("\\D", "");
                return digits.isEmpty() ? null : digits;
        }
}
