package vacademy.io.auth_service.feature.health.controller;

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
 * Health Diagnostics Controller for Auth Service
 * 
 * Provides lightweight endpoints for:
 * - Client-side latency measurement (ping)
 * - Database latency measurement
 * - Inter-service connectivity (to admin-core-service)
 */
@RestController
@RequestMapping("/auth-service/health")
public class HealthDiagnosticsController {

    @Autowired
    private DataSource dataSource;

    @Value("${admin.core.service.base_url:http://admin-core-service:8072}")
    private String adminCoreServiceUrl;

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
        response.put("service", "auth-service");
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
        response.put("service", "auth-service");
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
     * Inter-service connectivity check to admin-core-service
     * Measures round-trip latency
     */
    @GetMapping("/connectivity/admin")
    public ResponseEntity<Map<String, Object>> checkAdminConnectivity() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("source", "auth-service");
        response.put("target", "admin-core-service");
        response.put("timestamp", Instant.now());

        long start = System.currentTimeMillis();
        try {
            String url = adminCoreServiceUrl + "/admin-core-service/health/ping";
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

        return ResponseEntity.ok(response);
    }

    /**
     * Complete health summary
     */
    @GetMapping("/complete")
    public ResponseEntity<Map<String, Object>> getCompleteHealth() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("service", "auth-service");
        response.put("timestamp", Instant.now());

        // Database health
        Map<String, Object> dbResponse = getDatabaseLatency().getBody();
        response.put("database", dbResponse);

        // Admin connectivity
        Map<String, Object> adminResponse = checkAdminConnectivity().getBody();
        response.put("admin_connectivity", adminResponse);

        // Overall status
        boolean dbUp = "UP".equals(dbResponse.get("status"));
        boolean adminUp = "OK".equals(adminResponse.get("status"));
        response.put("overall_status", dbUp && adminUp ? "HEALTHY" : (dbUp ? "DEGRADED" : "UNHEALTHY"));

        return ResponseEntity.ok(response);
    }
}
