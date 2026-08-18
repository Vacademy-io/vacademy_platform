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
 *   <li>The credential, not the number, is what proves anything. Certificate
 *       numbers are sequential, so number-only lookup would be enumerable.
 *       Either credential is accepted: the QR's long token ({@code ?t=}) or the
 *       barcode's short code ({@code ?c=}).</li>
 *   <li>A bad credential and a non-existent number both return the same 404, so
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
     * @param t             the QR's long token
     * @param c             the barcode's short code; supply either, not both
     */
    @GetMapping("/verify/{certificateId}")
    public ResponseEntity<CertificateVerificationDto> verify(
            @PathVariable String certificateId,
            @RequestParam(name = "t", required = false) String t,
            @RequestParam(name = "c", required = false) String c) {

        // Whichever arrived. verify() tries the value as both credentials, so a
        // scanner app that drops it in the "wrong" parameter still resolves.
        String credential = t != null && !t.isBlank() ? t : c;

        return verificationService.verify(certificateId, credential)
                .map(ResponseEntity::ok)
                // Same response for a wrong token and an unknown number — an
                // attacker must not be able to confirm a number exists.
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(CertificateVerificationDto.builder().valid(false).build()));
    }

    /**
     * Verify from a raw scanned or pasted string, so a barcode scan — which
     * yields text, not a URL a phone can open — has somewhere to go. Also backs
     * the manual-entry box for someone reading a printed certificate.
     *
     * @param q whatever the scanner produced: a verification URL, {@code NUM*CODE},
     *          or a bare short code. A bare certificate number is deliberately
     *          not enough and returns the same 404 as an unknown one.
     */
    @GetMapping("/verify")
    public ResponseEntity<CertificateVerificationDto> verifyScanned(
            @RequestParam(name = "q", required = false) String q) {

        return verificationService.verifyScanned(q)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(CertificateVerificationDto.builder().valid(false).build()));
    }
}
