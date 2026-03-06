package vacademy.io.admin_core_service.features.white_label.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.white_label.dto.*;
import vacademy.io.admin_core_service.features.white_label.service.WhiteLabelService;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * White-Label Setup Controller.
 *
 * All endpoints require the caller to be an authenticated institute member
 * (enforced by the gateway + the service-layer assertInstituteAccess check).
 *
 * Intentionally NOT under /admin/* so the institute admin dashboard can call it
 * without needing an elevated super-admin role — but the service still verifies
 * that the caller belongs to the exact instituteId they are setting up.
 */
@RestController
@RequestMapping("/admin-core-service/institute/white-label/v1")
@RequiredArgsConstructor
public class WhiteLabelController {

    private final WhiteLabelService whiteLabelService;

    /**
     * Fully automates the white-label setup for an institute:
     * 1. Creates / updates Cloudflare DNS CNAME records
     * 2. Upserts domain routing rows (LEARNER, ADMIN, TEACHER)
     * 3. Updates learner_portal_base_url, admin_portal_base_url,
     * teacher_portal_base_url
     * on the institutes table
     *
     * Security: the authenticated user MUST belong to the instituteId being
     * configured.
     */
    @PostMapping("/setup")
    public ResponseEntity<WhiteLabelSetupResponse> setup(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam("instituteId") String instituteId,
            @RequestBody WhiteLabelSetupRequest request) {

        WhiteLabelSetupResponse response = whiteLabelService.setup(user, instituteId, request);
        return ResponseEntity.ok(response);
    }

    /**
     * Returns current white-label configuration for the institute.
     * Safe read-only endpoint — still enforces institute membership.
     */
    @GetMapping("/status")
    public ResponseEntity<WhiteLabelStatusResponse> getStatus(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam("instituteId") String instituteId) {

        WhiteLabelStatusResponse response = whiteLabelService.getStatus(user, instituteId);
        return ResponseEntity.ok(response);
    }
}
