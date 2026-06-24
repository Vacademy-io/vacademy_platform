package vacademy.io.admin_core_service.features.telephony.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;

/**
 * Per-institute AI-calling provider credentials (Aavtaar et al.), in their own table
 * so they never collide with the institute's outbound telephony provider (Airtel /
 * Exotel) — which lives in {@code institute_telephony_config} (UNIQUE per institute).
 *
 * <p>{@code UNIQUE(institute_id, provider, company_code)} → an institute can hold
 * multiple accounts per provider; the enabled one is the active account for calls.
 */
@Entity
@Table(name = "ai_calling_config")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiCallingConfig {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, updatable = false)
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    /** AI-voice provider code, e.g. AAVTAAR. */
    @Column(name = "provider", nullable = false)
    private String provider;

    /** Account identifier — Aavtaar's company code (the path segment of its API). */
    @Column(name = "company_code", nullable = false)
    private String companyCode;

    @Column(name = "token_enc")
    private String tokenEnc;

    @Column(name = "webhook_secret_enc")
    private String webhookSecretEnc;

    /** The active account for this (institute, provider) when placing calls. */
    @Column(name = "enabled", nullable = false)
    private boolean enabled;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
