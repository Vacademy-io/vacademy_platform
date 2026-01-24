package vacademy.io.media_service.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Health Diagnostics Controller for Media Service
 * 
 * Provides lightweight endpoints for:
 * - Client-side latency measurement (ping)
 * - Database latency measurement
 */
@RestController
@RequestMapping("/media-service/health")
public class HealthDiagnosticsController {

    @Autowired
    private DataSource dataSource;

    /**
     * Ultra-lightweight ping endpoint for client-side latency measurement
     * Returns minimal response for accurate timing
     */
    @GetMapping("/ping")
    public ResponseEntity<Map<String, Object>> ping() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "OK");
        response.put("service", "media-service");
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
        response.put("service", "media-service");
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
     * Complete health summary
     */
    @GetMapping("/complete")
    public ResponseEntity<Map<String, Object>> getCompleteHealth() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("service", "media-service");
        response.put("timestamp", Instant.now());

        // Database health
        Map<String, Object> dbResponse = getDatabaseLatency().getBody();
        response.put("database", dbResponse);

        // Overall status
        boolean dbUp = "UP".equals(dbResponse.get("status"));
        response.put("overall_status", dbUp ? "HEALTHY" : "UNHEALTHY");

        return ResponseEntity.ok(response);
    }
}
