package vacademy.io.notification_service.controller;

import io.sentry.Sentry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.common.logging.SentryLogger;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Diagnostic controller to test Sentry configuration
 * TEMPORARY - Remove after verification
 */
@RestController
@RequestMapping("/notification-service/diagnostic")
@Slf4j
public class SentryDiagnosticController {

    @GetMapping("/sentry/test-minimal")
    public ResponseEntity<Map<String, Object>> testSentryMinimal() {
        Map<String, Object> response = new HashMap<>();

        try {
            // Test 1: Direct Sentry SDK call
            log.info("Testing direct Sentry SDK call");
            Sentry.captureMessage("🧪 SENTRY TEST - Direct SDK Call - " + LocalDateTime.now());
            response.put("directSentryCall", "SUCCESS - Check Sentry dashboard");

        } catch (Exception e) {
            log.error("Direct Sentry call failed", e);
            response.put("directSentryCall", "FAILED: " + e.getMessage());
        }

        try {
            // Test 2: SentryLogger utility
            log.info("Testing SentryLogger utility");
            SentryLogger.SentryEventBuilder.error()
                    .withMessage("🧪 SENTRY TEST - SentryLogger Utility - " + LocalDateTime.now())
                    .withTag("test.type", "DIAGNOSTIC")
                    .withTag("test.timestamp", LocalDateTime.now().toString())
                    .send();
            response.put("sentryLoggerUtility", "SUCCESS - Check Sentry dashboard");

        } catch (Exception e) {
            log.error("SentryLogger utility failed", e);
            response.put("sentryLoggerUtility", "FAILED: " + e.getMessage());
        }

        try {
            // Test 3: SentryLogger with exception
            log.info("Testing SentryLogger with exception");
            RuntimeException testException = new RuntimeException("🧪 SENTRY TEST EXCEPTION - " + LocalDateTime.now());
            SentryLogger.SentryEventBuilder.error(testException)
                    .withMessage("🧪 SENTRY TEST - Exception Logging")
                    .withTag("test.type", "EXCEPTION_TEST")
                    .withTag("notification.type", "EMAIL")
                    .send();
            response.put("sentryLoggerException", "SUCCESS - Check Sentry dashboard");

        } catch (Exception e) {
            log.error("SentryLogger exception test failed", e);
            response.put("sentryLoggerException", "FAILED: " + e.getMessage());
        }

        // Check if Sentry is initialized
        boolean isSentryEnabled = Sentry.isEnabled();
        response.put("sentryEnabled", isSentryEnabled);
        response.put("sentryDsn", System.getenv("SENTRY_DSN") != null ? "CONFIGURED" : "MISSING");
        response.put("timestamp", LocalDateTime.now().toString());

        log.info("Sentry diagnostic test completed. Sentry enabled: {}", isSentryEnabled);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/sentry/test-email-error")
    public ResponseEntity<Map<String, Object>> testEmailErrorLogging() {
        Map<String, Object> response = new HashMap<>();

        try {
            log.info("Simulating email authentication error");

            // Simulate the exact type of error we're seeing
            org.springframework.mail.MailAuthenticationException authException = new org.springframework.mail.MailAuthenticationException(
                    "Simulated [EOF] error for testing");

            SentryLogger.SentryEventBuilder.error(authException)
                    .withMessage("🧪 SIMULATED EMAIL ERROR - Testing EOF Error Logging")
                    .withTag("notification.type", "EMAIL")
                    .withTag("email.type", "HTML")
                    .withTag("recipient.email", "test@example.com")
                    .withTag("institute.id", "TEST_INSTITUTE")
                    .withTag("operation", "sendHtmlEmail")
                    .withTag("test.simulated", "true")
                    .send();

            response.put("status", "SUCCESS");
            response.put("message", "Simulated email error sent to Sentry");
            response.put("instruction", "Check Sentry dashboard for: 🧪 SIMULATED EMAIL ERROR");

        } catch (Exception e) {
            log.error("Email error simulation failed", e);
            response.put("status", "FAILED");
            response.put("error", e.getMessage());
        }

        return ResponseEntity.ok(response);
    }

    @GetMapping("/sentry/check-config")
    public ResponseEntity<Map<String, Object>> checkSentryConfig() {
        Map<String, Object> config = new HashMap<>();

        config.put("sentry.enabled", Sentry.isEnabled());
        config.put("sentry.dsn.configured", System.getenv("SENTRY_DSN") != null);
        config.put("sentry.dsn.value",
                System.getenv("SENTRY_DSN") != null
                        ? System.getenv("SENTRY_DSN").substring(0, Math.min(30, System.getenv("SENTRY_DSN").length()))
                                + "..."
                        : "NOT SET");

        // Check application properties
        config.put("timestamp", LocalDateTime.now().toString());

        log.info("Sentry configuration check: {}", config);

        return ResponseEntity.ok(config);
    }
}
