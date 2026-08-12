package vacademy.io.admin_core_service.features.certificate.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.certificate.dto.CertificateVerificationDto;
import vacademy.io.admin_core_service.features.certificate.service.CertificateVerificationService;

/**
 * Unauthenticated certificate verification — what a scanned QR resolves to.
 *
 * <p>Lives under {@code /admin-core-service/open/**}, the established permitAll
 * prefix (see {@code PublicBookingController}). <b>Adding a path here without
 * adding it to the permitAll list in ApplicationSecurityConfig means it stays
 * behind JWT and every scan hits a login wall.</b>
 *
 * <p>Security posture, since this is reachable by anyone:
 * <ul>
 *   <li>The token, not the number, is the credential. Certificate numbers are
 *       sequential, so number-only lookup would be enumerable.</li>
 *   <li>A bad token and a non-existent number both return the same 404, so
 *       probing cannot distinguish "wrong token" from "no such certificate".</li>
 *   <li>The response carries no file id, no learner id, and only a masked name.</li>
 * </ul>
 */
@RestController
@RequestMapping("/admin-core-service/open/v1/certificate")
@RequiredArgsConstructor
public class PublicCertificateVerificationController {

    private final CertificateVerificationService verificationService;

    /**
     * @param certificateId the human-readable number from the certificate
     * @param t             the unguessable token; both must match
     */
    @GetMapping("/verify/{certificateId}")
    public ResponseEntity<CertificateVerificationDto> verify(
            @PathVariable String certificateId,
            @RequestParam(name = "t", required = false) String t) {

        return verificationService.verify(certificateId, t)
                .map(ResponseEntity::ok)
                // Same response for a wrong token and an unknown number — an
                // attacker must not be able to confirm a number exists.
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(CertificateVerificationDto.builder().valid(false).build()));
    }
}
