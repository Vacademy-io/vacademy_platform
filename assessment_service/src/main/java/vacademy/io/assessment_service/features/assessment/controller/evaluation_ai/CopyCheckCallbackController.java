package vacademy.io.assessment_service.features.assessment.controller.evaluation_ai;

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
 * Callbacks from ai_service. Gated by X-Internal-Service-Token (shared
 * secret matched against assessment.copy-check.internal-token). Mounted at
 * /internal/copy-check/** — this matches the URL ai_service POSTs to in
 * callbacks.py and is whitelisted in ApplicationSecurityConfig so the JWT
 * filter doesn't reject these calls.
 */
@RestController
@RequestMapping("/assessment-service/internal/copy-check")
@RequiredArgsConstructor
@Slf4j
public class CopyCheckCallbackController {

    private final CopyCheckCallbackService callbackService;

    @Value("${assessment.copy-check.internal-token:}")
    private String expectedToken;

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
            log.warn("[copy-check] internal token not configured — rejecting callback");
            return false;
        }
        if (token == null) return false;
        return java.security.MessageDigest.isEqual(token.getBytes(), expectedToken.getBytes());
    }
}
