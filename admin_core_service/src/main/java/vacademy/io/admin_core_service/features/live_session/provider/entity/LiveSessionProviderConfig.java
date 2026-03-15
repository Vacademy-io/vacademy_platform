package vacademy.io.admin_core_service.features.live_session.provider.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

/**
 * Maps an institute to a live session provider.
 * Mirrors InstitutePaymentGatewayMapping exactly:
 * - provider → equivalent of vendor
 * - configJson → equivalent of paymentGatewaySpecificData
 *
 * All provider-specific credentials (clientId, clientSecret, accessToken,
 * refreshToken, tokenExpiresAt, zohoUserId, domain, etc.) are stored as
 * a flat JSON object in configJson — no schema changes needed for new
 * providers.
 */
@Entity
@Table(name = "institute_live_session_provider_mapping")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LiveSessionProviderConfig {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    /** Institute that owns this provider config */
    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    /**
     * Provider name e.g. ZOHO_MEETING, ZOOM, MS_TEAMS.
     * Maps to MeetingProvider enum.
     */
    @Column(name = "provider", nullable = false, length = 50)
    private String provider;

    /**
     * All provider-specific credentials as a JSON string.
     *
     * Zoho example:
     * {
     * "clientId": "...",
     * "clientSecret": "...",
     * "accessToken": "...",
     * "refreshToken": "...",
     * "tokenExpiresAt": 1234567890,
     * "zohoUserId": "12345678",
     * "domain": "zoho.com"
     * }
     *
     * Zoom example (future):
     * {
     * "accountId": "...",
     * "clientId": "...",
     * "clientSecret": "..."
     * }
     */
    /**
     * Optional: Zoho / provider user ID of the individual organizer.
     * NULL means this is the institute-wide fallback credential used for
     * any organizer that does not have their own personal config.
     */
    @Column(name = "vendor_user_id", length = 100)
    private String vendorUserId;

    @Column(name = "config_json", columnDefinition = "TEXT", nullable = false)
    private String configJson;

    @Column(name = "status", length = 20)
    @Builder.Default
    private String status = "ACTIVE";

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at")
    private Date updatedAt;
}
