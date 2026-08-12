package vacademy.io.admin_core_service.features.certificate.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

/**
 * What a public certificate verification returns.
 *
 * <p>Everything here is visible to anyone holding the QR, so the field list is
 * the disclosure decision. Deliberately absent:
 *
 * <ul>
 *   <li>{@code fileId} — media-service turns any file id into a permanent,
 *       non-expiring public URL, so exposing it would hand out the PDF forever</li>
 *   <li>{@code userId}, email, phone — no learner identifiers</li>
 *   <li>{@code packageSessionId}, institute id — nothing to pivot from</li>
 * </ul>
 *
 * <p>The learner's name is masked to initials-plus-shape. It is enough for the
 * holder to confirm the certificate is theirs and for an employer to corroborate
 * a claim, without making a harvested set of these worth anything.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CertificateVerificationDto {

    private boolean valid;

    /** The human-readable number, echoed so the page can show what was checked. */
    private String certificateId;

    private String instituteName;
    private String courseName;
    private Date issuedAt;
    private Integer completionPercentage;

    /** Masked, e.g. "A··· S·····". Never the full name. */
    private String learnerName;
}
