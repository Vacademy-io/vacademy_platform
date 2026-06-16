package vacademy.io.admin_core_service.features.telephony.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.telephony.core.CallOrchestrator;
import vacademy.io.admin_core_service.features.telephony.core.dto.CallLogDTO;
import vacademy.io.admin_core_service.features.telephony.core.dto.CallOptionsResponseDTO;
import vacademy.io.admin_core_service.features.telephony.core.dto.ConnectCallRequestDTO;
import vacademy.io.admin_core_service.features.telephony.core.dto.ConnectCallResponseDTO;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyCallLogRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

/**
 * Provider-agnostic REST surface for placing calls and listing call history.
 * The webhook + SSE live on their own controllers (the webhook is public so
 * it can't share auth config with this one).
 */
@RestController
@RequestMapping("/admin-core-service/v1/telephony/calls")
public class TelephonyCallController {

    @Autowired
    private CallOrchestrator orchestrator;

    @Autowired
    private TelephonyCallLogRepository callLogRepo;

    @PostMapping("/connect")
    public ResponseEntity<ConnectCallResponseDTO> connect(
            @RequestBody ConnectCallRequestDTO req,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(orchestrator.connect(req, user));
    }

    /**
     * Picker data for the Call button — every enabled ExoPhone plus the one
     * the configured strategy would auto-select for this lead today.
     * Lightweight: cache read + at most one indexed call-log query.
     */
    @GetMapping("/options")
    public ResponseEntity<CallOptionsResponseDTO> options(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "userId", required = false) String leadUserId) {
        if (instituteId == null || instituteId.isBlank()) {
            throw new VacademyException("instituteId is required");
        }
        return ResponseEntity.ok(orchestrator.computeOptions(instituteId, leadUserId));
    }

    /**
     * Call history — feeds the lead side-view "Calls" panel (by {@code userId})
     * and the counsellor workbench drawer's "Calls" coaching tab (by
     * {@code counsellorUserId}). Exactly one of the two filters is used; when
     * both are supplied the counsellor filter wins. {@code instituteId} is
     * required so a counsellor with the permission can't fetch call history
     * for a user in a different institute simply by knowing their UUID.
     */
    @GetMapping
    public ResponseEntity<Page<CallLogDTO>> list(
            @RequestParam(value = "userId", required = false) String userId,
            @RequestParam(value = "counsellorUserId", required = false) String counsellorUserId,
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            @RequestAttribute("user") CustomUserDetails user) {
        if (instituteId == null || instituteId.isBlank()) {
            throw new VacademyException("instituteId is required");
        }
        PageRequest pageable = PageRequest.of(page, Math.min(size, 100));
        Page<CallLogDTO> result;
        if (counsellorUserId != null && !counsellorUserId.isBlank()) {
            result = callLogRepo
                    .findByCounsellorUserIdAndInstituteIdOrderByCreatedAtDesc(
                            counsellorUserId, instituteId, pageable)
                    .map(CallLogDTO::from);
        } else if (userId != null && !userId.isBlank()) {
            result = callLogRepo
                    .findByUserIdAndInstituteIdOrderByCreatedAtDesc(
                            userId, instituteId, pageable)
                    .map(CallLogDTO::from);
        } else {
            throw new VacademyException("userId or counsellorUserId is required");
        }
        return ResponseEntity.ok(result);
    }
}
