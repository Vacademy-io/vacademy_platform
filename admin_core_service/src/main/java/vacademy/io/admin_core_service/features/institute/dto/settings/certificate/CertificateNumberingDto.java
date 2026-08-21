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

    /**
     * The number the series should start at — "our certificates continue from
     * 1500", the common ask when an institute is migrating off paper or off
     * another system.
     *
     * <p>It is a <b>floor, not a set</b>. Allocation takes
     * {@code max(counter + 1, startFrom)}, so raising it moves the series
     * forward and lowering it does nothing. That is what makes it safe to put in
     * front of an admin: the certificate number is the issued row's primary key,
     * so re-issuing a number already printed on a learner's certificate would
     * collide, and the settings screen warns when a value is being ignored.
     *
     * <p>Null or {@code <= 0} means "no floor" — the counter simply continues.
     */
    private Long startFrom;

    /**
     * Whether the counter restarts on 1 January (the historical behaviour, and
     * still the default when null).
     *
     * <p>Set false for one unbroken series across years. This matters more than
     * it looks: with a yearly reset and a pattern carrying no {@code {YYYY}} /
     * {@code {YY}} token — {@code {PREFIX}{SEQ:4}} is an offered preset — the
     * first certificate of the next year formats to a number already issued, and
     * the insert collides on the primary key. It matters again with
     * {@link #startFrom}: a yearly reset re-applies the floor every January, so
     * a series told to start at 1500 would start at 1500 again next year.
     */
    private Boolean resetAnnually;
}
