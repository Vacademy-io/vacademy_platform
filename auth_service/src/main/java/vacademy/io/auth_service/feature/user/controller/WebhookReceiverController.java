package vacademy.io.auth_service.feature.user.controller;

import lombok.extern.slf4j.Slf4j; // For logging
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j // Lombok annotation to create a logger instance
@RestController
@RequestMapping("/auth-service/wordpress-webhook") // Base path for webhook endpoints
public class WebhookReceiverController {

    // !! IMPORTANT: Store your actual secret securely (e.g., in application properties or environment variables)
    // Avoid hardcoding it directly in the controller like this in production.
    private static final String EXPECTED_SECRET_TOKEN = "YOUR_VERY_SECRET_TOKEN_HERE";

    /**
     * Endpoint to receive the webhook from WordPress user login.
     *
     * @param webhookSecret The secret token sent in the X-Webhook-Secret header.
     * @param headers       All request headers.
     * @param body          The request body (as a String to catch any format).
     * @return ResponseEntity indicating success or failure.
     */
    @PostMapping("/user-login") // Your specific endpoint, e.g., /webhook/user-login
    public ResponseEntity<String> handleUserLoginWebhook(
        @RequestHeader(value = "X-Webhook-Secret", required = false) String webhookSecret,
        @RequestHeader HttpHeaders headers, // Get all headers
        @RequestBody(required = false) String body) { // Receive body as raw string

        log.info("Received webhook request for user login.");

        // Log Headers
        log.info("--- Headers ---");
        headers.forEach((key, value) -> {
            // Be careful about logging sensitive headers like Authorization in production
            if (!key.equalsIgnoreCase(HttpHeaders.AUTHORIZATION)) {
                log.info("{}: {}", key, value);
            } else {
                log.info("{}: [REDACTED]", key); // Avoid logging potentially sensitive auth headers
            }
        });
        log.info("--- End Headers ---");


        // 1. Validate the Secret Token
        if (!StringUtils.hasText(webhookSecret)) {
            log.warn("Webhook request is missing the X-Webhook-Secret header.");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Missing secret token header.");
        }

        if (!EXPECTED_SECRET_TOKEN.equals(webhookSecret)) {
            log.warn("Webhook request received with an invalid secret token.");
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Invalid secret token.");
        }

        log.info("Secret token validation successful.");

        // 2. Log the Request Body
        if (StringUtils.hasText(body)) {
            log.info("Webhook Body:\n{}", body);
            // You can add further processing here if needed, like parsing JSON:
            // try {
            //     ObjectMapper objectMapper = new ObjectMapper();
            //     JsonNode jsonNode = objectMapper.readTree(body);
            //     String userId = jsonNode.path("user_id").asText();
            //     log.info("Parsed User ID: {}", userId);
            // } catch (Exception e) {
            //     log.error("Failed to parse webhook body as JSON", e);
            // }
        } else {
            log.info("Webhook request received with an empty body.");
        }

        // 3. Send a Success Response
        log.info("Webhook processed successfully.");
        return ResponseEntity.ok("Webhook received successfully.");
    }
}
