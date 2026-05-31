package vacademy.io.assessment_service.features.assessment.controller.evaluation_ai;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.assessment_service.features.assessment.dto.evaluation_ai.CopyCheckCallbackDto;
import vacademy.io.assessment_service.features.assessment.service.evaluation_ai.CopyCheckCallbackService;

/**
 * Callbacks from ai_service. Gated by X-Internal-Service-Token (shared cluster
 * secret INTERNAL_SERVICE_TOKEN). Mounted at /copy-check/callback/** — NOT
 * under /internal/** because the cluster-wide InternalAuthFilter (in
 * common_service) intercepts any URI containing "internal" and demands HMAC
 * (clientName + Signature) headers that ai_service doesn't send. Keeping the
 * path out of that filter's reach lets our controller-level token check run.
 * Whitelisted in ApplicationSecurityConfig so the JWT filter doesn't reject.
 */
@RestController
@RequestMapping("/assessment-service/copy-check/callback")
@RequiredArgsConstructor
@Slf4j
public class CopyCheckCallbackController {

    private final CopyCheckCallbackService callbackService;

    // Match the same shared cluster secret ai_service signs callbacks with.
    @Value("${internal.service.token:${assessment.copy-check.internal-token:}}")
    private String expectedToken;

    @PostConstruct
    void logTokenConfig() {
        // One-time log line at startup so we can confirm Spring resolved
        // the env var into expectedToken. Logs only the length, never the value.
        if (expectedToken == null || expectedToken.isEmpty()) {
            log.error("[copy-check] callback expectedToken is EMPTY at startup — callbacks will all 401. Set INTERNAL_SERVICE_TOKEN on assessment-service.");
        } else {
            log.info("[copy-check] callback expectedToken loaded OK (length={})", expectedToken.length());
        }
    }

    @PostMapping("/progress")
    public ResponseEntity<String> progress(
            @RequestHeader(value = "X-Internal-Service-Token", required = false) String token,
            @RequestBody CopyCheckCallbackDto.Progress payload) {
        if (!verify(token)) return ResponseEntity.status(401).body("invalid token");
        callbackService.onProgress(payload);
        return ResponseEntity.ok("ok");
    }

    @PostMapping("/question")
    public ResponseEntity<String> question(
            @RequestHeader(value = "X-Internal-Service-Token", required = false) String token,
            @RequestBody CopyCheckCallbackDto.QuestionDone payload) {
        if (!verify(token)) return ResponseEntity.status(401).body("invalid token");
        callbackService.onQuestionDone(payload);
        return ResponseEntity.ok("ok");
    }

    @PostMapping("/complete")
    public ResponseEntity<String> complete(
            @RequestHeader(value = "X-Internal-Service-Token", required = false) String token,
            @RequestBody CopyCheckCallbackDto.Complete payload) {
        if (!verify(token)) return ResponseEntity.status(401).body("invalid token");
        callbackService.onComplete(payload);
        return ResponseEntity.ok("ok");
    }

    @PostMapping("/failed")
    public ResponseEntity<String> failed(
            @RequestHeader(value = "X-Internal-Service-Token", required = false) String token,
            @RequestBody CopyCheckCallbackDto.Failed payload) {
        if (!verify(token)) return ResponseEntity.status(401).body("invalid token");
        callbackService.onFailed(payload);
        return ResponseEntity.ok("ok");
    }

    private boolean verify(String token) {
        if (expectedToken == null || expectedToken.isEmpty()) {
            log.warn("[copy-check] callback rejected: expectedToken not configured");
            return false;
        }
        if (token == null) {
            log.warn("[copy-check] callback rejected: missing X-Internal-Service-Token header");
            return false;
        }
        boolean match = java.security.MessageDigest.isEqual(token.getBytes(), expectedToken.getBytes());
        if (!match) {
            // Log lengths only (never the value). If lengths match but the
            // tokens don't, the two deployments are using different secrets.
            log.warn(
                "[copy-check] callback rejected: token mismatch (incoming length={}, expected length={})",
                token.length(), expectedToken.length()
            );
        }
        return match;
    }
}
