package vacademy.io.notification_service.controller;

import io.sentry.Sentry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * DSN verification controller
 */
@RestController
@RequestMapping("/notification-service/diagnostic")
@Slf4j
public class SentryDsnVerificationController {

    @Value("${sentry.dsn:NOT_SET}")
    private String sentryDsn;

    @GetMapping("/sentry/verify-dsn")
    public ResponseEntity<Map<String, Object>> verifyDsn() {
        Map<String, Object> response = new HashMap<>();

        try {
            // Get the full DSN (careful not to expose in logs)
            String fullDsn = System.getenv("SENTRY_DSN");

            if (fullDsn == null || fullDsn.isEmpty()) {
                response.put("status", "ERROR");
                response.put("message", "SENTRY_DSN environment variable is not set");
                response.put("sentry.enabled", Sentry.isEnabled());
                return ResponseEntity.ok(response);
            }

            // Parse the DSN to extract project ID
            // Format: https://{key}@{org}.ingest.sentry.io/{projectId}
            String projectId = extractProjectId(fullDsn);
            String orgDomain = extractOrgDomain(fullDsn);

            response.put("status", "SUCCESS");
            response.put("sentry.enabled", Sentry.isEnabled());
            response.put("dsn.configured", true);
            response.put("dsn.projectId", projectId);
            response.put("dsn.orgDomain", orgDomain);
            response.put("dsn.full", maskDsn(fullDsn));
            response.put("expectedProjectId", "4510261003943936");
            response.put("projectIdMatch", "4510261003943936".equals(projectId));
            response.put("timestamp", LocalDateTime.now().toString());

            // Log for debugging (masked)
            log.info("Sentry DSN verification - ProjectId: {}, OrgDomain: {}, Match: {}",
                    projectId, orgDomain, "4510261003943936".equals(projectId));

            // Send a test event to verify it goes to the right project
            log.info("Sending test event to Sentry project: {}", projectId);
            Sentry.captureMessage("🔍 DSN VERIFICATION TEST - Project: " + projectId + " - " + LocalDateTime.now());

            response.put("testEventSent", true);
            response.put("instruction", "Check Sentry project " + projectId + " for event: 🔍 DSN VERIFICATION TEST");

        } catch (Exception e) {
            log.error("Failed to verify Sentry DSN", e);
            response.put("status", "ERROR");
            response.put("error", e.getMessage());
        }

        return ResponseEntity.ok(response);
    }

    private String extractProjectId(String dsn) {
        try {
            // Format: https://{key}@{org}.ingest.sentry.io/{projectId}
            int lastSlash = dsn.lastIndexOf('/');
            if (lastSlash > 0) {
                return dsn.substring(lastSlash + 1);
            }
        } catch (Exception e) {
            log.error("Failed to extract project ID from DSN", e);
        }
        return "UNKNOWN";
    }

    private String extractOrgDomain(String dsn) {
        try {
            // Format: https://{key}@{org}.ingest.sentry.io/{projectId}
            int atIndex = dsn.indexOf('@');
            int slashIndex = dsn.indexOf('/', atIndex);
            if (atIndex > 0 && slashIndex > atIndex) {
                return dsn.substring(atIndex + 1, slashIndex);
            }
        } catch (Exception e) {
            log.error("Failed to extract org domain from DSN", e);
        }
        return "UNKNOWN";
    }

    private String maskDsn(String dsn) {
        try {
            // Mask the key part but show project ID
            // Input: https://key123456@o123.ingest.sentry.io/456
            // Output: https://***MASKED***@o123.ingest.sentry.io/456
            int atIndex = dsn.indexOf('@');
            int protocolEnd = dsn.indexOf("//") + 2;

            if (atIndex > protocolEnd) {
                return dsn.substring(0, protocolEnd) + "***MASKED***" + dsn.substring(atIndex);
            }
        } catch (Exception e) {
            log.error("Failed to mask DSN", e);
        }
        return "https://***MASKED***@***.***/***";
    }

    @GetMapping("/sentry/test-specific-project")
    public ResponseEntity<Map<String, Object>> testSpecificProject() {
        Map<String, Object> response = new HashMap<>();

        try {
            String fullDsn = System.getenv("SENTRY_DSN");
            String projectId = extractProjectId(fullDsn);

            log.info("Sending test events to verify Sentry project {}", projectId);

            // Send multiple test events
            for (int i = 1; i <= 3; i++) {
                String message = String.format("🎯 TEST EVENT #%d - Project: %s - Time: %s",
                        i, projectId, LocalDateTime.now());
                Sentry.captureMessage(message);

                log.info("Sent test event #{} to Sentry", i);
                Thread.sleep(500); // Small delay between events
            }

            response.put("status", "SUCCESS");
            response.put("eventsSent", 3);
            response.put("projectId", projectId);
            response.put("expectedProjectId", "4510261003943936");
            response.put("match", "4510261003943936".equals(projectId));
            response.put("message", "Check Sentry project " + projectId + " for 3 events marked with 🎯");
            response.put("sentryDashboardUrl", "https://sentry.io/organizations/YOUR_ORG/issues/?project=" + projectId);

        } catch (Exception e) {
            log.error("Failed to send test events", e);
            response.put("status", "ERROR");
            response.put("error", e.getMessage());
        }

        return ResponseEntity.ok(response);
    }
}
