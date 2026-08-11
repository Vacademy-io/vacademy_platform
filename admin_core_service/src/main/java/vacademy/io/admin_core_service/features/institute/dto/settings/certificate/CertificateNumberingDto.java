package vacademy.io.admin_core_service.features.institute.dto.settings.certificate;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Per-institute certificate numbering configuration.
 *
 * <p>Replaces the hardcoded {@code {2 letters of institute name}-{random 4
 * digits}-{year}} scheme. Everything here is optional: an institute that never
 * opens the numbering card keeps the historical shape, but sequence-backed
 * instead of random.
 */
@Setter
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CertificateNumberingDto {

    /**
     * Format string built from tokens. Supported tokens:
     *
     * <ul>
     *   <li>{@code {PREFIX}} — {@link #prefix}, or the first two alphanumeric
     *       characters of the institute name when prefix is unset</li>
     *   <li>{@code {SUFFIX}} — {@link #suffix}</li>
     *   <li>{@code {YYYY}} / {@code {YY}} — issuance year, 4- or 2-digit</li>
     *   <li>{@code {COURSE_CODE}} — reserved; currently always empty and its
     *       adjacent separator is collapsed. Numbering is institute-wide, so
     *       there is no per-course value to substitute.</li>
     *   <li>{@code {SEQ}} or {@code {SEQ:n}} — the allocated sequence number,
     *       zero-padded to {@code n} digits ({@link #sequencePadding} when
     *       unqualified)</li>
     * </ul>
     *
     * <p>Examples: {@code {PREFIX}-{YYYY}-{SEQ:4}} → {@code SN-2026-0001};
     * {@code {PREFIX}-{COURSE_CODE}-{SEQ:5}} → {@code VC-CSE-00125};
     * {@code {PREFIX}-{COURSE_CODE}-{YYYY}-{SEQ:3}} → {@code AIIMS-NEET-2026-034}.
     */
    private String pattern;

    /** Overrides the institute-name-derived prefix when set. */
    private String prefix;

    private String suffix;

    /** Zero-pad width for a bare {@code {SEQ}}. Null falls back to 4. */
    private Integer sequencePadding;
}
