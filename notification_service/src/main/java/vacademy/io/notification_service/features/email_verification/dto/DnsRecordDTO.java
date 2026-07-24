package vacademy.io.notification_service.features.email_verification.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A single DNS record the institute must add to their domain's DNS so that AWS
 * SES can verify domain ownership / DKIM. Rendered as a copyable row in the admin UI.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DnsRecordDTO {
    private String type;   // "CNAME" or "TXT"
    private String name;   // host / record name, e.g. "abc123._domainkey.myschool.com"
    private String value;  // record value/target, e.g. "abc123.dkim.amazonses.com"
    private String purpose; // human label, e.g. "DKIM 1 of 3" / "Domain ownership"
}
