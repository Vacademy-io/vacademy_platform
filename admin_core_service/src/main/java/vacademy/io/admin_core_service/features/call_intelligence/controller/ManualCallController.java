package vacademy.io.admin_core_service.features.call_intelligence.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.admin_core_service.features.call_intelligence.core.ManualCallUploadService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.Map;

/**
 * Counsellor uploads a recording of a call they made off-platform. Creates a
 * MANUAL telephony_call_log row so the call joins the universal call record and
 * (if the institute has Call Intelligence on) gets transcribed + analyzed like
 * any provider call. The acting user becomes the call's counsellor unless one is
 * given explicitly.
 */
@RestController
@RequestMapping("/admin-core-service/call-intelligence/manual-call")
@RequiredArgsConstructor
public class ManualCallController {

    private final ManualCallUploadService manualCallUploadService;

    @PostMapping(value = "/upload", consumes = {"multipart/form-data"})
    public ResponseEntity<Map<String, String>> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam("instituteId") String instituteId,
            @RequestParam("userId") String userId,
            @RequestParam(value = "responseId", required = false) String responseId,
            @RequestParam(value = "counsellorUserId", required = false) String counsellorUserId,
            @RequestParam(value = "direction", required = false) String direction,
            @RequestParam(value = "durationSeconds", required = false) Integer durationSeconds,
            @RequestParam(value = "counterpartyNumber", required = false) String counterpartyNumber,
            @RequestParam(value = "callStartedAtMillis", required = false) Long callStartedAtMillis,
            @RequestAttribute("user") CustomUserDetails user) {

        String actor = user == null ? null : user.getUserId();
        String counsellor = (counsellorUserId != null && !counsellorUserId.isBlank()) ? counsellorUserId : actor;

        String callLogId = manualCallUploadService.upload(file,
                new ManualCallUploadService.ManualCallRequest(
                        instituteId, userId, responseId, counsellor, direction,
                        durationSeconds, counterpartyNumber, callStartedAtMillis));

        return ResponseEntity.ok(Map.of("callLogId", callLogId, "status", "uploaded"));
    }
}
