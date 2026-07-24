package vacademy.io.admin_core_service.features.telephony.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.telephony.core.AiCallService;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallRequestDTO;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallResponseDTO;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * Manual "Click to AI call" — a counsellor/admin triggers an Aavtaar AI call for
 * a lead. Authenticated (not in the webhook allow-list); the actor becomes the
 * call's counsellor_user_id. Workflow-driven AI calls bypass this controller and
 * call {@link AiCallService#placeCall} directly with counsellorUserId = null.
 */
@RestController
@RequestMapping("/admin-core-service/v1/telephony/ai-call")
@RequiredArgsConstructor
public class AiCallController {

    private final AiCallService aiCallService;
    private final InstituteAccessValidator instituteAccessValidator;

    @PostMapping("/connect")
    public ResponseEntity<AiCallResponseDTO> connect(
            @RequestBody AiCallRequestDTO req,
            @RequestAttribute("user") CustomUserDetails user) {
        // Guard: this places a PAID AI call charged to req.instituteId — verify the caller
        // belongs to that institute (else a member of one tenant could spend another's
        // credits / dial another's lead by passing a foreign instituteId).
        instituteAccessValidator.validateUserAccess(user, req.getInstituteId());
        String actorUserId = user == null ? null : user.getUserId();
        return ResponseEntity.ok(aiCallService.placeCall(req, actorUserId));
    }
}
