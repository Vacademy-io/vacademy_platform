package vacademy.io.auth_service.feature.user.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.user.dto.WordpressWebhookDTO;
import vacademy.io.auth_service.feature.user.service.WordPressWebhookService;

@Slf4j
@RestController
@RequestMapping("/auth-service/wordpress-webhook")
public class WordpressWebhookReceiverController {

    private final WordPressWebhookService wordPressWebhookService;

    public WordpressWebhookReceiverController(WordPressWebhookService wordPressWebhookService) {
        this.wordPressWebhookService = wordPressWebhookService;
    }

    @PostMapping("/user-login")
    public ResponseEntity<String> handleUserLoginWebhook(
        @RequestHeader(value = "X-Webhook-Secret") String webhookSecret,
        @RequestHeader(value = "X-Institute-Id",required = false) String instituteId,
        @RequestBody(required = false) WordpressWebhookDTO body) {

        log.info("Received webhook request for user login.");

        if (body == null) {
            log.warn("Webhook request received with an empty body.");
            return ResponseEntity.badRequest().body("Empty request body.");
        }

        try {
            wordPressWebhookService.processUserLoginWebhook(body, instituteId, webhookSecret);
            log.info("Webhook processed successfully for user: {}", body.getEmail());
            return ResponseEntity.ok("Webhook processed successfully.");
        } catch (Exception e) {
            log.error("Error processing webhook: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Failed to process webhook.");
        }
    }
}
