package vacademy.io.admin_core_service.features.certificate.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.certificate.repository.CertificateNumberSequenceRepository;
import vacademy.io.admin_core_service.features.institute.dto.settings.certificate.CertificateNumberingDto;
import vacademy.io.common.institute.entity.Institute;

import java.util.Calendar;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Builds certificate numbers from an institute's configured pattern.
 *
 * <p>Replaces {@code InstituteSettingService#generateUniqueCertificateId}, which
 * picked a random 4-digit number, probed {@code existsById} up to 50 times, then
 * fell back to a 6-digit number with no uniqueness check at all. That scheme was
 * both non-sequential and racy — concurrent issuances could collide, and the
 * losing INSERT was swallowed, leaving a learner holding a PDF with no audit row.
 *
 * <p>Numbers now come from an atomic per-(institute, year) counter. Formatting is
 * pure; allocation is the only side effect.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CertificateNumberService {

    private final CertificateNumberSequenceRepository sequenceRepository;

    /**
     * Default shape: first three letters of the institute name, the year, then a
     * zero-padded sequence, with no separators — e.g. {@code EDU2026001},
     * {@code EDU2026002}. Institutes can override the whole pattern from
     * Certificate Settings.
     */
    static final String DEFAULT_PATTERN = "{PREFIX}{YYYY}{SEQ:3}";
    static final int DEFAULT_SEQUENCE_PADDING = 3;
    /** Characters of the institute name used for the default prefix. */
    static final int DEFAULT_PREFIX_LENGTH = 3;
    private static final String FALLBACK_PREFIX = "XXX";

    private static final Pattern SEQ_TOKEN = Pattern.compile("\\{SEQ(?::(\\d+))?}");
    /** Collapses separators orphaned by an empty token, e.g. "VC--00125" or a trailing "-". */
    private static final Pattern ORPHANED_SEPARATORS = Pattern.compile("([-/_])\\1+");

    /**
     * Allocate and format the next certificate number.
     *
     * @param courseCode value for {@code {COURSE_CODE}}; may be null/blank, in
     *                   which case the token resolves to empty and its adjacent
     *                   separator is collapsed
     */
    public String generate(Institute institute, CertificateNumberingDto numbering, String courseCode) {
        int year = Calendar.getInstance().get(Calendar.YEAR);
        String instituteId = institute != null ? institute.getId() : null;
        if (!StringUtils.hasText(instituteId)) {
            throw new IllegalArgumentException("Cannot allocate a certificate number without an institute id");
        }
        long sequence = sequenceRepository.allocateNext(instituteId, year);
        return format(numbering, resolvePrefix(institute, numbering), courseCode, sequence, year);
    }

    /**
     * Format without allocating — used by the admin settings page to preview the
     * next number, and by tests. Sequence is supplied by the caller.
     */
    public String preview(Institute institute, CertificateNumberingDto numbering, String courseCode, long sequence) {
        int year = Calendar.getInstance().get(Calendar.YEAR);
        return format(numbering, resolvePrefix(institute, numbering), courseCode, sequence, year);
    }

    String format(CertificateNumberingDto numbering, String prefix, String courseCode, long sequence, int year) {
        String pattern = numbering != null && StringUtils.hasText(numbering.getPattern())
                ? numbering.getPattern()
                : DEFAULT_PATTERN;

        int defaultPadding = numbering != null && numbering.getSequencePadding() != null
                && numbering.getSequencePadding() > 0
                ? numbering.getSequencePadding()
                : DEFAULT_SEQUENCE_PADDING;

        String suffix = numbering != null && numbering.getSuffix() != null ? numbering.getSuffix() : "";

        // {SEQ} / {SEQ:n} first — it is the only token carrying an argument.
        StringBuilder sb = new StringBuilder();
        Matcher m = SEQ_TOKEN.matcher(pattern);
        while (m.find()) {
            int padding = m.group(1) != null ? Integer.parseInt(m.group(1)) : defaultPadding;
            m.appendReplacement(sb, Matcher.quoteReplacement(zeroPad(sequence, padding)));
        }
        m.appendTail(sb);

        String out = sb.toString()
                .replace("{PREFIX}", prefix == null ? "" : prefix)
                .replace("{SUFFIX}", suffix)
                .replace("{YYYY}", String.valueOf(year))
                .replace("{YY}", String.format("%02d", year % 100))
                .replace("{COURSE_CODE}", courseCode == null ? "" : courseCode.trim());

        return tidy(out);
    }

    /**
     * An empty {@code {COURSE_CODE}} or {@code {SUFFIX}} leaves a doubled or
     * dangling separator behind ("VC--00125", "SN-2026-"). Collapse runs and trim
     * the edges so the number still reads correctly.
     */
    private String tidy(String value) {
        String collapsed = ORPHANED_SEPARATORS.matcher(value).replaceAll("$1");
        return collapsed.replaceAll("^[-/_]+", "").replaceAll("[-/_]+$", "").trim();
    }

    private String zeroPad(long sequence, int padding) {
        String digits = Long.toString(sequence);
        if (digits.length() >= padding) {
            return digits;  // never truncate — an overflowing sequence just gets wider
        }
        return "0".repeat(padding - digits.length()) + digits;
    }

    /**
     * Configured prefix wins; otherwise the first three alphanumeric characters
     * of the institute name, uppercased — "EduStream" becomes "EDU".
     *
     * <p>Shorter names are padded with X so the prefix is always a stable width,
     * which keeps numbers aligned when read in a column.
     */
    String resolvePrefix(Institute institute, CertificateNumberingDto numbering) {
        if (numbering != null && StringUtils.hasText(numbering.getPrefix())) {
            return numbering.getPrefix().trim();
        }
        String name = institute != null ? institute.getInstituteName() : null;
        if (!StringUtils.hasText(name)) {
            return FALLBACK_PREFIX;
        }
        String letters = name.replaceAll("[^A-Za-z0-9]", "").toUpperCase();
        if (letters.isEmpty()) {
            return FALLBACK_PREFIX;
        }
        if (letters.length() >= DEFAULT_PREFIX_LENGTH) {
            return letters.substring(0, DEFAULT_PREFIX_LENGTH);
        }
        return letters + "X".repeat(DEFAULT_PREFIX_LENGTH - letters.length());
    }
}
