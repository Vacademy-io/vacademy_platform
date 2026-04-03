package vacademy.io.community_service.feature.bbb;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.InetAddress;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@Slf4j
public class BbbHealthCheckService {

    private final RestTemplate restTemplate;

    private static final String META_API = "https://graph.facebook.com/v21.0";
    private static final String TEMPLATE_NAME = "vacademy_server_health_check_utility";
    private static final DateTimeFormatter IST_FORMATTER =
            DateTimeFormatter.ofPattern("dd MMM yyyy hh:mm a z");

    @Value("${WHATSAPP_ACCESS_TOKEN_VIDYAYATAN:}")
    private String waAccessToken;

    @Value("${WHATSAPP_PHONE_NUMBER_ID_VIDYAYATAN:}")
    private String waPhoneNumberId;

    @Value("${bbb.healthcheck.notify-phones:}")
    private String notifyPhones;

    @Value("${bbb.healthcheck.url:https://meet.vacademy.io/bigbluebutton/api}")
    private String bbbApiUrl;

    @Value("${bbb.healthcheck.hostname:meet.vacademy.io}")
    private String bbbHostname;

    @Value("${GH_ACTION_TOKEN:}")
    private String githubToken;

    @Value("${bbb.github.repo:Vacademy-io/vacademy_platform}")
    private String githubRepo;

    public BbbHealthCheckService() {
        this.restTemplate = new RestTemplate();
    }

    /**
     * Scheduled start — Mon-Sat at 3:20 PM IST.
     * Triggers GitHub Actions workflow to create BBB server from snapshot.
     */
    @Scheduled(cron = "0 20 15 * * MON-SAT", zone = "Asia/Kolkata")
    public void scheduledStart() {
        log.info("[BBB] Scheduled START triggered");
        triggerGitHubAction("start");
    }

    /**
     * Scheduled health check — Mon-Sat at 3:45 PM IST.
     * Runs 25 min after start to give server time to boot.
     */
    @Scheduled(cron = "0 45 15 * * MON-SAT", zone = "Asia/Kolkata")
    public void scheduledHealthCheck() {
        log.info("[BBB HealthCheck] Scheduled check triggered");
        runHealthCheck();
    }

    /**
     * Scheduled stop — Mon-Sat at 10:15 PM IST.
     * Triggers GitHub Actions workflow to snapshot + delete BBB server.
     */
    @Scheduled(cron = "0 15 22 * * MON-SAT", zone = "Asia/Kolkata")
    public void scheduledStop() {
        log.info("[BBB] Scheduled STOP triggered");
        triggerGitHubAction("stop");
    }

    public Map<String, Object> runHealthCheck() {
        Map<String, Object> result = new LinkedHashMap<>();
        String timestamp = ZonedDateTime.now(ZoneId.of("Asia/Kolkata")).format(IST_FORMATTER);
        result.put("timestamp", timestamp);
        result.put("hostname", bbbHostname);

        String status;
        String serverIp = "N/A";
        String details;

        try {
            // Resolve IP
            try {
                InetAddress addr = InetAddress.getByName(bbbHostname);
                serverIp = addr.getHostAddress();
            } catch (Exception e) {
                serverIp = "DNS resolve failed";
            }
            result.put("ip", serverIp);

            // Check BBB API endpoint
            ResponseEntity<String> response = restTemplate.getForEntity(bbbApiUrl, String.class);
            String body = response.getBody();

            if (response.getStatusCode().is2xxSuccessful() && body != null && body.contains("SUCCESS")) {
                status = "HEALTHY";
                details = "API OK, server responding";
            } else if (response.getStatusCode().is2xxSuccessful()) {
                status = "HEALTHY";
                details = "API reachable (HTTP " + response.getStatusCode().value() + ")";
            } else {
                status = "DEGRADED";
                details = "API returned HTTP " + response.getStatusCode().value();
            }
        } catch (Exception e) {
            status = "DOWN";
            details = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            if (details.length() > 200) details = details.substring(0, 200);
            log.error("[BBB HealthCheck] Failed: {}", details);
        }

        result.put("status", status);
        result.put("details", details);

        try {
            sendWhatsApp(status, serverIp, details, timestamp);
        } catch (Exception e) {
            log.error("[BBB HealthCheck] WhatsApp failed: {}", e.getMessage());
            result.put("notificationError", e.getMessage());
        }

        return result;
    }

    /**
     * Trigger GitHub Actions workflow (start or stop BBB server).
     */
    public Map<String, Object> triggerGitHubAction(String action) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("action", action);

        if (githubToken == null || githubToken.isBlank()) {
            log.error("[BBB] GH_ACTION_TOKEN not configured — cannot trigger workflow");
            result.put("error", "GH_ACTION_TOKEN not configured");
            return result;
        }

        if (!List.of("start", "stop", "status").contains(action)) {
            result.put("error", "Invalid action. Use: start, stop, status");
            return result;
        }

        try {
            String url = "https://api.github.com/repos/" + githubRepo
                    + "/actions/workflows/bbb-server-schedule.yml/dispatches";

            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + githubToken);
            headers.set("Accept", "application/vnd.github.v3+json");
            headers.setContentType(MediaType.APPLICATION_JSON);

            String body = String.format("{\"ref\":\"main\",\"inputs\":{\"action\":\"%s\"}}", action);

            restTemplate.exchange(url, HttpMethod.POST, new HttpEntity<>(body, headers), String.class);

            result.put("status", "triggered");
            result.put("message", "GitHub Actions workflow dispatched: " + action);
            log.info("[BBB] GitHub Action triggered: {}", action);
        } catch (Exception e) {
            result.put("error", e.getMessage());
            log.error("[BBB] GitHub Action trigger failed: {}", e.getMessage());
        }

        return result;
    }

    private void sendWhatsApp(String status, String serverIp, String details, String timestamp) {
        if (waAccessToken == null || waAccessToken.isBlank()
                || waPhoneNumberId == null || waPhoneNumberId.isBlank()
                || notifyPhones == null || notifyPhones.isBlank()) {
            log.info("[BBB HealthCheck] WhatsApp skipped — credentials not configured");
            return;
        }

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + waAccessToken);
        headers.setContentType(MediaType.APPLICATION_JSON);

        String[] phones = notifyPhones.split(",");

        for (String phone : phones) {
            phone = phone.trim();
            if (phone.isEmpty()) continue;

            String payload = String.format("""
                {
                    "messaging_product": "whatsapp",
                    "to": "%s",
                    "type": "template",
                    "template": {
                        "name": "%s",
                        "language": { "code": "en" },
                        "components": [
                            {
                                "type": "body",
                                "parameters": [
                                    { "type": "text", "text": "%s" },
                                    { "type": "text", "text": "%s" },
                                    { "type": "text", "text": "%s" },
                                    { "type": "text", "text": "%s" },
                                    { "type": "text", "text": "%s" }
                                ]
                            }
                        ]
                    }
                }""",
                    phone, TEMPLATE_NAME,
                    escapeJson(status),
                    escapeJson(bbbHostname),
                    escapeJson(serverIp),
                    escapeJson(details),
                    escapeJson(timestamp));

            try {
                String url = META_API + "/" + waPhoneNumberId + "/messages";
                ResponseEntity<String> response = restTemplate.exchange(
                        url, HttpMethod.POST, new HttpEntity<>(payload, headers), String.class);
                log.info("[BBB HealthCheck] WhatsApp sent to {}: {}", phone, response.getBody());
            } catch (Exception e) {
                log.error("[BBB HealthCheck] WhatsApp to {} failed: {}", phone, e.getMessage());
            }
        }
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");
    }
}
