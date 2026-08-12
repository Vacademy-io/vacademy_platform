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

    public String newVerificationToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
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
        return base + "/verify/" + certificateId + "?t=" + token;
    }

    /**
     * Resolve a certificate for public display. Both the number and the token
     * must match; a wrong or missing token is indistinguishable from a number
     * that does not exist, so probing reveals nothing.
     */
    public Optional<CertificateVerificationDto> verify(String certificateId, String token) {
        if (!StringUtils.hasText(certificateId) || !StringUtils.hasText(token)) {
            return Optional.empty();
        }

        Optional<IssuedCertificate> found =
                issuedCertificateRepository.findByCertificateIdAndVerificationToken(certificateId.trim(), token.trim());
        if (found.isEmpty()) {
            return Optional.empty();
        }
        IssuedCertificate certificate = found.get();

        String instituteName = instituteRepository.findById(certificate.getInstituteId())
                .map(Institute::getInstituteName)
                .orElse("");

        return Optional.of(CertificateVerificationDto.builder()
                .valid(true)
                .certificateId(certificate.getCertificateId())
                .instituteName(instituteName)
                .courseName(certificate.getCourseName())
                .issuedAt(certificate.getIssuedAt())
                .completionPercentage(certificate.getCompletionPercentage())
                .learnerName(maskName(resolveLearnerName(certificate.getUserId())))
                .build());
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
