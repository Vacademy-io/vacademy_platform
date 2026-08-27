package vacademy.io.admin_core_service.features.certificate.service;

import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.certificate.repository.CertificateNumberSequenceDao;
import vacademy.io.admin_core_service.features.institute.dto.settings.certificate.CertificateNumberingDto;
import vacademy.io.common.institute.entity.Institute;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

/**
 * Covers the certificate-number formatter against the three formats the redesign
 * asked for, plus the edge cases that used to produce malformed ids.
 *
 * <p>Allocation itself is a single atomic SQL statement and is exercised
 * end-to-end rather than here — these tests pin the pure formatting half.
 */
class CertificateNumberServiceTest {

    private final CertificateNumberService service = new CertificateNumberService(null);

    private Institute institute(String name) {
        Institute institute = new Institute();
        institute.setInstituteName(name);
        return institute;
    }

    private CertificateNumberingDto numbering(String pattern) {
        return CertificateNumberingDto.builder().pattern(pattern).build();
    }

    @Test
    void formatsInstituteYearSequence() {
        String result = service.format(numbering("{PREFIX}-{YYYY}-{SEQ:4}"), "SN", null, 1L, 2026);
        assertEquals("SN-2026-0001", result);
    }

    @Test
    void formatsCourseCodeWithoutYear() {
        String result = service.format(numbering("{PREFIX}-{COURSE_CODE}-{SEQ:5}"), "VC", "CSE", 125L, 2026);
        assertEquals("VC-CSE-00125", result);
    }

    @Test
    void formatsCourseCodeWithYear() {
        String result = service.format(numbering("{PREFIX}-{COURSE_CODE}-{YYYY}-{SEQ:3}"), "AIIMS", "NEET", 34L, 2026);
        assertEquals("AIIMS-NEET-2026-034", result);
    }

    /**
     * The shipped default: three letters of the institute name, the year, then a
     * 3-digit sequence with no separators — EDU2026001, EDU2026002.
     */
    @Test
    void defaultPatternIsPrefixYearSequence() {
        assertEquals("EDU2026001", service.format(null, "EDU", null, 1L, 2026));
        assertEquals("EDU2026002", service.format(null, "EDU", null, 2L, 2026));
        assertEquals("EDU2026042", service.format(null, "EDU", null, 42L, 2026));
    }

    /** Past 999 the sequence widens rather than wrapping or truncating. */
    @Test
    void defaultPatternWidensBeyondThreeDigits() {
        assertEquals("EDU20261000", service.format(null, "EDU", null, 1000L, 2026));
    }

    /**
     * An empty {@code COURSE_CODE} used to leave a doubled separator behind
     * ("VC--00125"). The token collapses instead.
     */
    @Test
    void collapsesSeparatorLeftByEmptyCourseCode() {
        assertEquals("VC-00125", service.format(numbering("{PREFIX}-{COURSE_CODE}-{SEQ:5}"), "VC", null, 125L, 2026));
        assertEquals("VC-00125", service.format(numbering("{PREFIX}-{COURSE_CODE}-{SEQ:5}"), "VC", "  ", 125L, 2026));
    }

    @Test
    void trimsDanglingSeparatorFromEmptySuffix() {
        // Carries {SEQ} because every real pattern must: one without it formats
        // to the same string for every learner. See the guard below.
        assertEquals("SN-2026-001",
                service.format(numbering("{PREFIX}-{YYYY}-{SEQ:3}-{SUFFIX}"), "SN", null, 1L, 2026));
    }

    /**
     * A pattern with no sequence token would mint the same number for every
     * certificate — and the number is the certificate's primary key, so the
     * second one issued collides. It is easy to write by accident: typing the
     * digits of a number you like ("{PREFIX}000111") reads as a starting point
     * and is really a constant.
     *
     * <p>The sequence is appended rather than the pattern rejected, so issuance
     * keeps working for institutes that already saved one. The settings page
     * warns before it gets this far.
     */
    @Test
    void appendsTheSequenceToAPatternThatHasNone() {
        assertEquals("EDU000111001",
                service.format(numbering("{PREFIX}000111"), "EDU", null, 1L, 2026));
        assertEquals("EDU000111002",
                service.format(numbering("{PREFIX}000111"), "EDU", null, 2L, 2026));
    }

    @Test
    void neverAppendsWhenThePatternAlreadyHasASequence() {
        assertEquals("EDU2026001",
                service.format(numbering("{PREFIX}{YYYY}{SEQ:3}"), "EDU", null, 1L, 2026));
    }

    /** A sequence wider than its padding must widen, never truncate. */
    @Test
    void doesNotTruncateOverflowingSequence() {
        assertEquals("SN-123456", service.format(numbering("{PREFIX}-{SEQ:4}"), "SN", null, 123456L, 2026));
    }

    @Test
    void appliesConfiguredPaddingToBareSeqToken() {
        CertificateNumberingDto dto = CertificateNumberingDto.builder()
                .pattern("{PREFIX}-{SEQ}")
                .sequencePadding(6)
                .build();
        assertEquals("SN-000042", service.format(dto, "SN", null, 42L, 2026));
    }

    @Test
    void supportsTwoDigitYear() {
        assertEquals("SN-26-0001", service.format(numbering("{PREFIX}-{YY}-{SEQ:4}"), "SN", null, 1L, 2026));
    }

    @Test
    void derivesThreeCharacterPrefixFromInstituteName() {
        assertEquals("EDU", service.resolvePrefix(institute("EduStream"), null));
        assertEquals("SHI", service.resolvePrefix(institute("Shiksha Nation"), null));
        assertEquals("COD", service.resolvePrefix(institute("CodeCircle.org"), null));
        // Punctuation and spaces are skipped, not counted.
        assertEquals("ABC", service.resolvePrefix(institute("A.B.C. School"), null));
    }

    @Test
    void padsShortInstituteNamesAndFallsBackWhenEmpty() {
        assertEquals("AXX", service.resolvePrefix(institute("A"), null));
        assertEquals("ABX", service.resolvePrefix(institute("AB"), null));
        assertEquals("XXX", service.resolvePrefix(institute("!!!"), null));
        assertEquals("XXX", service.resolvePrefix(null, null));
    }

    /** End to end on the default: institute name in, EDU2026001 out. */
    @Test
    void defaultEndToEndForAnInstituteName() {
        String prefix = service.resolvePrefix(institute("EduStream"), null);
        assertEquals("EDU2026001", service.format(null, prefix, null, 1L, 2026));
    }

    @Test
    void configuredPrefixWinsOverInstituteName() {
        CertificateNumberingDto dto = CertificateNumberingDto.builder().prefix("AIIMS").build();
        assertEquals("AIIMS", service.resolvePrefix(institute("Shiksha Nation"), dto));
    }

    // --- Start number and reset scope -------------------------------------
    //
    // Allocation itself is one atomic SQL statement (see
    // CertificateNumberSequenceDao) and is exercised against a database, not
    // here. What these pin is the config-to-parameter translation: which counter
    // is asked for, and what floor is handed to it. Getting either wrong is
    // silent — the certificate still issues, just with the wrong number.

    @Test
    void startFromDefaultsToNoFloor() {
        assertEquals(0L, CertificateNumberService.startFrom(null));
        assertEquals(0L, CertificateNumberService.startFrom(CertificateNumberingDto.builder().build()));
    }

    @Test
    void startFromPassesTheConfiguredFloorThrough() {
        assertEquals(1500L, CertificateNumberService.startFrom(
                CertificateNumberingDto.builder().startFrom(1500L).build()));
    }

    /**
     * A negative floor is normalised away rather than reaching SQL, where
     * {@code GREATEST} would take it as "no floor" anyway — but only by accident.
     */
    @Test
    void startFromClampsNegativesToNoFloor() {
        assertEquals(0L, CertificateNumberService.startFrom(
                CertificateNumberingDto.builder().startFrom(-40L).build()));
    }

    /** Unset means the historical behaviour: the counter resets each January. */
    @Test
    void bucketDefaultsToTheIssuanceYear() {
        assertEquals(2026, CertificateNumberService.bucketFor(null, 2026));
        assertEquals(2026, CertificateNumberService.bucketFor(
                CertificateNumberingDto.builder().build(), 2026));
        assertEquals(2026, CertificateNumberService.bucketFor(
                CertificateNumberingDto.builder().resetAnnually(true).build(), 2026));
    }

    /**
     * Turning the reset off has to select one counter for every year, otherwise
     * "start at 1500" would re-apply every 1 January and an institute whose
     * pattern carries no year token would re-issue numbers already printed.
     */
    @Test
    void bucketIsTheContinuousCounterWhenTheResetIsOff() {
        CertificateNumberingDto dto = CertificateNumberingDto.builder().resetAnnually(false).build();
        assertEquals(CertificateNumberSequenceDao.CONTINUOUS_BUCKET,
                CertificateNumberService.bucketFor(dto, 2026));
        assertEquals(CertificateNumberService.bucketFor(dto, 2026),
                CertificateNumberService.bucketFor(dto, 2027));
        assertNotEquals(CertificateNumberService.bucketFor(dto, 2026),
                CertificateNumberService.bucketFor(null, 2026));
    }

    /** The start number is a position in the counter — the format still applies. */
    @Test
    void aStartedSeriesStillFormatsThroughThePattern() {
        CertificateNumberingDto dto = CertificateNumberingDto.builder()
                .pattern("{PREFIX}-{SEQ:4}")
                .startFrom(1500L)
                .resetAnnually(false)
                .build();
        assertEquals("SN-1500", service.format(dto, "SN", null, 1500L, 2026));
        assertEquals("SN-1501", service.format(dto, "SN", null, 1501L, 2026));
    }
}
