package vacademy.io.admin_core_service.features.certificate.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.certificate.dto.IssuedCertificateDTO;
import vacademy.io.admin_core_service.features.certificate.service.CertificateReadService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

/**
 * Learner-facing certificate listing. Mirrors {@code LearnerBadgeController}'s
 * {@code /learner/v1/my-badges} shape — userId is JWT-derived, so a learner can
 * only ever list their own certificates. The parent portal reuses
 * {@link CertificateReadService} in-process behind the guardian guard.
 */
@Slf4j
@RestController
@RequestMapping("/admin-core-service/certificate/learner/v1")
@RequiredArgsConstructor
public class LearnerCertificateController {

    private final CertificateReadService certificateReadService;

    /** Learner: the authenticated learner's own certificates in an institute. */
    @GetMapping("/my-certificates")
    public ResponseEntity<List<IssuedCertificateDTO>> getMyCertificates(
            @RequestParam String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(certificateReadService.listForUser(user.getUserId(), instituteId));
    }
}
