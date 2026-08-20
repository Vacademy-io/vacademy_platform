package vacademy.io.admin_core_service.features.certificate.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.certificate.dto.CertificateVerificationDto;
import vacademy.io.admin_core_service.features.certificate.entity.IssuedCertificate;
import vacademy.io.admin_core_service.features.certificate.repository.IssuedCertificateRepository;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.institute.entity.Institute;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.Optional;

/**
 * Public certificate verification: turning a scanned QR into a page that proves
 * a certificate is genuine, without a login.
 *
 * <p><b>Why a token.</b> Certificate numbers are sequential and human-readable
 * by design ({@code EDU2026001}, {@code EDU2026002}…). A public lookup keyed on
 * the number alone would be trivially enumerable — one certificate would let
 * anyone walk the sequence and harvest every learner name and course in the
 * institute. So each certificate carries a random 128-bit token, and the public
 * endpoint requires the number <em>and</em> the token.
 *
 * <p><b>Two credentials, one rule.</b> The QR carries the full 128-bit token in
 * a URL. A barcode cannot — Code 128 spends ~11 modules per character, so the
 * token would need a barcode ~76mm wide to stay scannable. Barcodes therefore
 * carry a 10-character {@link #newShortCode() short code} instead. Both are
 * accepted; neither the number alone nor a wrong credential resolves anything.
 *
 * <p><b>What is disclosed.</b> Deliberately minimal, because anyone holding the
 * link can see it: institute, course, issue date, and the learner's name
 * <em>masked</em>. Enough for an employer to confirm a claim; not enough to be
 * worth scraping. The file id is never exposed — {@code media-service} can turn
 * any file id into a permanent, non-expiring public URL.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CertificateVerificationService {

    private final IssuedCertificateRepository issuedCertificateRepository;
    private final InstituteRepository instituteRepository;
    private final AuthService authService;

    private static final SecureRandom RANDOM = new SecureRandom();
    /** 16 bytes → 128 bits, url-safe base64 → 22 chars. Not guessable. */
    private static final int TOKEN_BYTES = 16;

    /**
     * Crockford base32, which drops I, L, O and U. The short code is printed in
     * a human-readable form beside the barcode and gets read aloud and retyped,
     * so an alphabet where 1/I/l and 0/O are distinct matters more here than the
     * two bits per character it costs.
     */
    private static final char[] SHORT_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ".toCharArray();
    /** 10 chars × 5 bits = 50 bits. See the class javadoc for why that's enough. */
    private static final int SHORT_CODE_LENGTH = 10;

    /**
     * Separator between the number and the short code inside a barcode payload.
     * {@code *} is in Code 128's character set, is not produced by any numbering
     * pattern ({@link CertificateNumberService} emits {@code -}, {@code /} and
     * {@code _}), and survives a copy-paste out of a scanner app unmangled.
     */
    public static final String BARCODE_SEPARATOR = "*";

    public String newVerificationToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** The barcode's credential — see {@link #newVerificationToken()} for the QR's. */
    public String newShortCode() {
        StringBuilder out = new StringBuilder(SHORT_CODE_LENGTH);
        for (int i = 0; i < SHORT_CODE_LENGTH; i++) {
            out.append(SHORT_CODE_ALPHABET[RANDOM.nextInt(SHORT_CODE_ALPHABET.length)]);
        }
        return out.toString();
    }

    /**
     * What a verifying barcode encodes: {@code <number>*<code>}.
     *
     * <p>The number is included even though the short code alone would resolve,
     * because a scan that yields the number lets a human cross-check it against
     * the number printed on the certificate. A barcode carrying only an opaque
     * code proves nothing to someone comparing the two by eye.
     *
     * @return null when there is no short code (legacy certificate); the caller
     *         then falls back to encoding the bare number
     */
    public String buildBarcodePayload(String certificateId, String shortCode) {
        if (!StringUtils.hasText(certificateId) || !StringUtils.hasText(shortCode)) {
            return null;
        }
        return certificateId.trim() + BARCODE_SEPARATOR + shortCode.trim();
    }

    /**
     * The URL a QR should encode, on the institute's own learner portal so a
     * white-labelled school sends its graduates to its own domain rather than
     * ours — e.g. {@code https://student.edustream.ae/verify/EDU2026001?t=…}.
     *
     * @return null when there is no token (legacy certificate) or no portal
     *         configured; the caller then falls back to encoding the number
     */
    public String buildVerificationUrl(Institute institute, String certificateId, String token) {
        if (!StringUtils.hasText(certificateId) || !StringUtils.hasText(token)) {
            return null;
        }
        String host = institute != null ? institute.getLearnerPortalBaseUrl() : null;
        if (!StringUtils.hasText(host)) {
            return null;
        }
        String base = host.trim().replaceFirst("/+$", "");
        if (!base.startsWith("http://") && !base.startsWith("https://")) {
            base = "https://" + base;
        }
        // Percent-encode the number: numbering patterns allow `/`, and an
        // unencoded `EDU/2026/001` would turn one path segment into three and
        // miss the verification route entirely. `+` means a literal plus in a
        // path, not a space, so the encoder's `+` has to become `%20`.
        String encodedId = java.net.URLEncoder
                .encode(certificateId.trim(), java.nio.charset.StandardCharsets.UTF_8)
                .replace("+", "%20");
        return base + "/verify/" + encodedId + "?t=" + token;
    }

    /**
     * Resolve a certificate for public display. The number plus <em>either</em>
     * credential — the QR's long token or the barcode's short code — must match;
     * a wrong or missing credential is indistinguishable from a number that does
     * not exist, so probing reveals nothing.
     *
     * <p>The two are tried in turn rather than being told apart by shape: the
     * caller does not always know which one it was handed (a pasted string from
     * a scanner app could be either), and a length check would be a guess.
     */
    public Optional<CertificateVerificationDto> verify(String certificateId, String credential) {
        if (!StringUtils.hasText(certificateId) || !StringUtils.hasText(credential)) {
            return Optional.empty();
        }
        String number = certificateId.trim();
        String secret = credential.trim();

        return issuedCertificateRepository.findByCertificateIdAndVerificationToken(number, secret)
                .or(() -> issuedCertificateRepository.findByCertificateIdAndShortCode(number, secret))
                .map(this::toDto);
    }

    /**
     * Verification from a raw scanned or pasted string — the entry point behind
     * the public "paste what you scanned" box, and what makes a barcode scan
     * verifiable at all.
     *
     * <p>Accepts, in order:
     * <ul>
     *   <li>a full verification URL ({@code https://…/verify/NUM?t=TOKEN}, or
     *       {@code ?c=CODE}) — what a QR scanner hands over;</li>
     *   <li>{@code NUM*CODE} — what a verifying barcode encodes;</li>
     *   <li>a bare short code — a barcode printed without its number.</li>
     * </ul>
     *
     * <p>A bare certificate number deliberately resolves to empty. It is the
     * enumerable half (see the class javadoc), so accepting it here would
     * reintroduce exactly the harvesting hole the token exists to close.
     */
    public Optional<CertificateVerificationDto> verifyScanned(String raw) {
        if (!StringUtils.hasText(raw)) {
            return Optional.empty();
        }
        String scanned = raw.trim();

        // A URL from a QR scanner. Parsed by hand rather than with URI, because
        // scanner apps hand over strings URI rejects (stray whitespace, missing
        // scheme) and a parse failure here would read to the user as "fake".
        int verifyAt = scanned.lastIndexOf("/verify/");
        if (verifyAt >= 0) {
            // Drop any fragment first. It is never part of the credential, and
            // leaving it attached turns a genuine scan into a failed one — some
            // scanner apps append one.
            String tail = scanned.substring(verifyAt + "/verify/".length()).replaceFirst("#.*$", "");
            String number = tail;
            String credential = null;
            int query = tail.indexOf('?');
            if (query >= 0) {
                number = tail.substring(0, query);
                for (String pair : tail.substring(query + 1).split("&")) {
                    int eq = pair.indexOf('=');
                    if (eq <= 0) continue;
                    String key = pair.substring(0, eq);
                    if ("t".equals(key) || "c".equals(key)) {
                        credential = urlDecode(pair.substring(eq + 1));
                        break;
                    }
                }
            }
            // Only a *trailing* slash is noise. Interior slashes are not:
            // numbering patterns allow `/`, so `EDU/2026/001` is a legitimate
            // certificate number and truncating at the first slash would make
            // every certificate at such an institute unverifiable.
            number = urlDecode(number.replaceFirst("/+$", ""));
            Optional<CertificateVerificationDto> byUrl = verify(number, credential);
            if (byUrl.isPresent()) {
                return byUrl;
            }
            // Fall through: the string looked like a URL but didn't resolve. It
            // could still be a compound code containing a slash, so keep trying.
        }

        int sep = scanned.indexOf(BARCODE_SEPARATOR);
        if (sep > 0 && sep < scanned.length() - 1) {
            return verify(scanned.substring(0, sep), scanned.substring(sep + 1));
        }

        // A bare short code. Shape-guarded so a URL that failed to resolve above
        // isn't handed to the database whole as a "code".
        if (scanned.matches("[A-Za-z0-9]{6,32}")) {
            return issuedCertificateRepository.findByShortCode(scanned).map(this::toDto);
        }
        return Optional.empty();
    }

    private static String urlDecode(String value) {
        try {
            return java.net.URLDecoder.decode(value, java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception e) {
            return value;
        }
    }

    private CertificateVerificationDto toDto(IssuedCertificate certificate) {
        // One lookup for the whole institute rather than one per field: the
        // page needs its branding as well as its name, and two round trips to
        // the same row on a public endpoint is a free way to make a scan slower.
        Institute institute = instituteRepository.findById(certificate.getInstituteId())
                .orElse(null);

        return CertificateVerificationDto.builder()
                .valid(true)
                .certificateId(certificate.getCertificateId())
                .instituteName(institute != null ? institute.getInstituteName() : "")
                // Branding travels with the response so the page renders as the
                // institute's own on whatever domain the scan landed on. See
                // the field docs on CertificateVerificationDto.
                .instituteLogoFileId(institute != null ? institute.getLogoFileId() : null)
                .instituteThemeCode(institute != null ? institute.getInstituteThemeCode() : null)
                .instituteWebsite(institute != null ? institute.getWebsiteUrl() : null)
                .courseName(certificate.getCourseName())
                .issuedAt(certificate.getIssuedAt())
                .completionPercentage(certificate.getCompletionPercentage())
                .learnerName(maskName(resolveLearnerName(certificate.getUserId())))
                .build();
    }

    private String resolveLearnerName(String userId) {
        try {
            List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(List.of(userId));
            if (users != null && !users.isEmpty()) {
                return Optional.ofNullable(users.get(0).getFullName()).orElse("");
            }
        } catch (Exception e) {
            log.warn("Could not resolve learner name for verification of user {}", userId, e);
        }
        return "";
    }

    /**
     * "Alex Sample" → "A··· S·····".
     *
     * <p>Keeps the initials and word shape so the holder can confirm the
     * certificate is theirs, while a scraper collecting these learns almost
     * nothing. Anyone entitled to the full name already has the certificate.
     */
    static String maskName(String fullName) {
        if (!StringUtils.hasText(fullName)) {
            return "";
        }
        String[] parts = fullName.trim().split("\\s+");
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < parts.length; i++) {
            if (i > 0) out.append(' ');
            String part = parts[i];
            out.append(part.charAt(0));
            out.append("·".repeat(Math.max(0, part.length() - 1)));
        }
        return out.toString();
    }
}
