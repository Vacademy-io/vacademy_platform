package vacademy.io.admin_core_service.features.health.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Health Diagnostics Controller for Admin Core Service
 * 
 * Provides lightweight endpoints for:
 * - Client-side latency measurement (ping)
 * - Database latency measurement
 * - Inter-service connectivity (to auth-service, media-service, etc.)
 */
@RestController
@RequestMapping("/admin-core-service/health")
public class HealthDiagnosticsController {

    @Autowired
    private DataSource dataSource;

    @Value("${auth.server.baseurl:http://auth-service:8071}")
    private String authServiceUrl;

    @Value("${media.server.baseurl:http://media-service:8075}")
    private String mediaServiceUrl;

    @Value("${assessment.server.baseurl:http://assessment-service:8074}")
    private String assessmentServiceUrl;

    @Value("${notification.server.baseurl:http://notification-service:8076}")
    private String notificationServiceUrl;

    private final RestTemplate restTemplate;

    public HealthDiagnosticsController() {
        this.restTemplate = new RestTemplate();
    }

    /**
     * Ultra-lightweight ping endpoint for client-side latency measurement
     * Returns minimal response for accurate timing
     */
    @GetMapping("/ping")
    public ResponseEntity<Map<String, Object>> ping() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "OK");
        response.put("service", "admin-core-service");
        response.put("timestamp", Instant.now().toEpochMilli());
        return ResponseEntity.ok(response);
    }

    /**
     * Database latency measurement
     * Returns connection acquisition time and validation time
     */
    @GetMapping("/db")
    public ResponseEntity<Map<String, Object>> getDatabaseLatency() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("service", "admin-core-service");
        response.put("timestamp", Instant.now());

        long connectionStart = System.currentTimeMillis();
        try (Connection conn = dataSource.getConnection()) {
            long connectionTime = System.currentTimeMillis() - connectionStart;

            long validationStart = System.currentTimeMillis();
            boolean valid = conn.isValid(5);
            long validationTime = System.currentTimeMillis() - validationStart;

            response.put("status", valid ? "UP" : "DOWN");
            response.put("connected", valid);
            response.put("connection_time_ms", connectionTime);
            response.put("validation_time_ms", validationTime);
            response.put("total_latency_ms", connectionTime + validationTime);
            response.put("database", conn.getCatalog());

            // Get pool stats if available
            try {
                response.put("pool_name", conn.getMetaData().getDriverName());
            } catch (Exception ignored) {
            }

        } catch (SQLException e) {
            long connectionTime = System.currentTimeMillis() - connectionStart;
            response.put("status", "DOWN");
            response.put("connected", false);
            response.put("connection_time_ms", connectionTime);
            response.put("error", e.getMessage());
        }

        return ResponseEntity.ok(response);
    }

    /**
     * Inter-service connectivity check to auth-service
     */
    @GetMapping("/connectivity/auth")
    public ResponseEntity<Map<String, Object>> checkAuthConnectivity() {
        return checkServiceConnectivity("auth-service", authServiceUrl + "/auth-service/health/ping");
    }

    /**
     * Inter-service connectivity check to media-service
     */
    @GetMapping("/connectivity/media")
    public ResponseEntity<Map<String, Object>> checkMediaConnectivity() {
        return checkServiceConnectivity("media-service", mediaServiceUrl + "/media-service/health/ping");
    }

    /**
     * Inter-service connectivity check to assessment-service
     */
    @GetMapping("/connectivity/assessment")
    public ResponseEntity<Map<String, Object>> checkAssessmentConnectivity() {
        return checkServiceConnectivity("assessment-service", assessmentServiceUrl + "/assessment-service/health/ping");
    }

    /**
     * Inter-service connectivity check to notification-service
     */
    @GetMapping("/connectivity/notification")
    public ResponseEntity<Map<String, Object>> checkNotificationConnectivity() {
        return checkServiceConnectivity("notification-service",
                notificationServiceUrl + "/notification-service/health/ping");
    }

    /**
     * All inter-service connectivity checks
     */
    @GetMapping("/connectivity/all")
    public ResponseEntity<Map<String, Object>> checkAllConnectivity() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("source", "admin-core-service");
        response.put("timestamp", Instant.now());

        response.put("auth_service",
                checkServiceConnectivityInternal("auth-service", authServiceUrl + "/auth-service/health/ping"));
        response.put("media_service",
                checkServiceConnectivityInternal("media-service", mediaServiceUrl + "/media-service/health/ping"));
        response.put("assessment_service", checkServiceConnectivityInternal("assessment-service",
                assessmentServiceUrl + "/assessment-service/health/ping"));
        response.put("notification_service", checkServiceConnectivityInternal("notification-service",
                notificationServiceUrl + "/notification-service/health/ping"));

        return ResponseEntity.ok(response);
    }

    private ResponseEntity<Map<String, Object>> checkServiceConnectivity(String targetService, String url) {
        return ResponseEntity.ok(checkServiceConnectivityInternal(targetService, url));
    }

    private Map<String, Object> checkServiceConnectivityInternal(String targetService, String url) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("source", "admin-core-service");
        response.put("target", targetService);
        response.put("timestamp", Instant.now());

        long start = System.currentTimeMillis();
        try {
            ResponseEntity<String> result = restTemplate.getForEntity(url, String.class);
            long latency = System.currentTimeMillis() - start;

            response.put("status", result.getStatusCode().is2xxSuccessful() ? "OK" : "FAILED");
            response.put("latency_ms", latency);
            response.put("http_status", result.getStatusCode().value());
        } catch (Exception e) {
            long latency = System.currentTimeMillis() - start;
            response.put("status", "FAILED");
            response.put("latency_ms", latency);
            response.put("error", e.getMessage());
        }

        return response;
    }

    /**
     * Complete health summary
     */
    @GetMapping("/complete")
    public ResponseEntity<Map<String, Object>> getCompleteHealth() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("service", "admin-core-service");
        response.put("timestamp", Instant.now());

        // Database health
        Map<String, Object> dbResponse = getDatabaseLatency().getBody();
        response.put("database", dbResponse);

        // Connectivity
        Map<String, Object> connectivityResponse = checkAllConnectivity().getBody();
        response.put("connectivity", connectivityResponse);

        // Overall status
        boolean dbUp = "UP".equals(dbResponse.get("status"));
        response.put("overall_status", dbUp ? "HEALTHY" : "UNHEALTHY");

        return ResponseEntity.ok(response);
    }
}
