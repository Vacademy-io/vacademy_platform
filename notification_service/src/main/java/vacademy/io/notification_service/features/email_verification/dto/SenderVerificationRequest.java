package vacademy.io.notification_service.features.email_verification.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Request to (re)initiate SES verification for an institute's sender address.
 * The sender is stored under {@code EMAIL_SETTING.data.<type>}; `type` is the
 * immutable key (e.g. UTILITY_EMAIL, MARKETING_EMAIL).
 */
@Getter
@Setter
@NoArgsConstructor
public class SenderVerificationRequest {
    private String email;   // the "from" address to verify, e.g. noreply@myschool.com
    private String name;    // optional display name shown in recipients' inboxes
    private String type;    // EMAIL_SETTING key, e.g. UTILITY_EMAIL
    private String mode;    // "EMAIL" (verify the single address) or "DOMAIN" (DKIM). Defaults to EMAIL.
}
