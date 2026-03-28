package vacademy.io.notification_service.features.send.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.notification_service.features.send.dto.UnifiedSendRequest;
import vacademy.io.notification_service.features.send.dto.UnifiedSendResponse;
import vacademy.io.notification_service.features.send.service.UnifiedSendService;

/**
 * Internal (HMAC-authenticated) endpoint for service-to-service calls.
 * Used by admin-core-service to send notifications without JWT.
 * Path whitelisted in WebSecurityConfig: /notification-service/internal/**
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("notification-service/internal/v1/send")
public class InternalSendController {

    private final UnifiedSendService unifiedSendService;

    @PostMapping
    public ResponseEntity<UnifiedSendResponse> send(@RequestBody UnifiedSendRequest request) {
        log.info("Internal unified send: channel={}, template={}, recipients={}, institute={}",
                request.getChannel(), request.getTemplateName(),
                request.getRecipients() != null ? request.getRecipients().size() : 0,
                request.getInstituteId());

        UnifiedSendResponse response = unifiedSendService.send(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{batchId}/status")
    public ResponseEntity<UnifiedSendResponse> getBatchStatus(@PathVariable String batchId) {
        return ResponseEntity.ok(unifiedSendService.getBatchStatus(batchId));
    }
}
