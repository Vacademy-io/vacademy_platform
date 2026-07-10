package vacademy.io.notification_service.features.email_verification.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.notification_service.features.email_verification.dto.SenderVerificationRequest;
import vacademy.io.notification_service.features.email_verification.dto.SenderVerificationResponse;
import vacademy.io.notification_service.features.email_verification.service.EmailSenderVerificationService;

import java.util.Map;

/**
 * Self-serve SES sender-identity verification for white-label institutes.
 * Sits alongside the existing email-configuration CRUD ({@code AnnouncementController})
 * and lets an admin confirm ownership of a custom "from" address without backend/DB access.
 */
@Slf4j
@RestController
@RequestMapping("/notification-service/v1/email-verification")
@RequiredArgsConstructor
public class EmailSenderVerificationController {

    private final EmailSenderVerificationService verificationService;

    /** Whether SES self-serve verification is provisioned on this deployment (drives the UI gate). */
    @GetMapping("/enabled")
    public ResponseEntity<Map<String, Boolean>> isEnabled() {
        return ResponseEntity.ok(Map.of("enabled", verificationService.isEnabled()));
    }

    /** Initiate (or re-send) verification for an institute's sender address. */
    @PostMapping("/{instituteId}/verify")
    public ResponseEntity<?> verifySender(
            @PathVariable String instituteId,
            @RequestBody SenderVerificationRequest request,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        try {
            SenderVerificationResponse response =
                    verificationService.verifySender(instituteId, request, bearer(authHeader));
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error verifying sender for institute {}: {}", instituteId, e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage() != null ? e.getMessage()
                    : "Failed to start verification"));
        }
    }

    /** Re-check the current SES status for an institute's sender (by EMAIL_SETTING type key). */
    @GetMapping("/{instituteId}/status/{emailType}")
    public ResponseEntity<?> getStatus(
            @PathVariable String instituteId,
            @PathVariable String emailType,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        try {
            SenderVerificationResponse response =
                    verificationService.getStatus(instituteId, emailType, bearer(authHeader));
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error fetching verification status for institute {} type {}: {}",
                    instituteId, emailType, e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage() != null ? e.getMessage()
                    : "Failed to fetch status"));
        }
    }

    private String bearer(String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        return null;
    }
}
