package vacademy.io.notification_service.features.email_verification.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * Current SES verification state for one institute sender address, returned by both
 * the "verify" and "status" endpoints so the admin UI can render a single consistent view.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SenderVerificationResponse {
    private boolean enabled;          // whether SES verification is provisioned on this deployment
    private String type;              // EMAIL_SETTING key
    private String email;             // the from-address
    private String identity;          // what was sent to SES (email address, or domain for DKIM)
    private String mode;              // EMAIL | DOMAIN
    private String status;            // NOT_STARTED | PENDING | VERIFIED | FAILED
    private boolean verified;         // convenience: status == VERIFIED
    private String message;           // human-friendly next-step for the UI
    private List<DnsRecordDTO> dnsRecords; // populated for DOMAIN mode (records to add to DNS)
}
