package vacademy.io.admin_core_service.features.telephony.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.telephony.controller.dto.AiVoiceCarrierDTO;
import vacademy.io.admin_core_service.features.telephony.controller.dto.AiVoiceCarrierViewDTO;
import vacademy.io.admin_core_service.features.telephony.core.AiVoiceCarrierService;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * "Which line do our AI calls go out on?" — read + set, for the AI calling line card.
 *
 * <p>Separate from {@code TelephonyConfigController} on purpose: that endpoint owns the
 * provider the institute's humans dial on, and the two must never be able to overwrite
 * each other. An institute on Airtel links a Plivo line here and keeps every counsellor
 * call exactly where it was.
 *
 * <p>JWT-protected (default auth) + institute-membership validated — the instituteId
 * comes from the path and the body carries carrier credentials, so without the check any
 * authenticated user could read or replace another institute's calling account.
 */
@RestController
@RequestMapping("/admin-core-service/v1/telephony/ai-carrier")
@RequiredArgsConstructor
public class AiVoiceCarrierController {

    private final AiVoiceCarrierService service;
    private final InstituteAccessValidator instituteAccessValidator;

    @GetMapping("/{instituteId}")
    public ResponseEntity<AiVoiceCarrierViewDTO> get(
            @PathVariable("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(service.view(instituteId));
    }

    /** {@code mode=PRIMARY} shares the team's line; {@code mode=DEDICATED} links a Plivo line. */
    @PutMapping("/{instituteId}")
    public ResponseEntity<AiVoiceCarrierViewDTO> save(
            @PathVariable("instituteId") String instituteId,
            @RequestBody AiVoiceCarrierDTO body,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(service.save(instituteId, body));
    }

    /** Remove the dedicated line — AI calls fall back to the primary provider. */
    @DeleteMapping("/{instituteId}")
    public ResponseEntity<AiVoiceCarrierViewDTO> unlink(
            @PathVariable("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(service.unlink(instituteId));
    }
}
