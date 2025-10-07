package vacademy.io.auth_service.feature.server_time.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.server_time.dto.ServerTimeResponseDTO;
import vacademy.io.auth_service.feature.server_time.service.ServerTimeService;

import java.util.Set;

/**
 * Optimized REST Controller for server time operations
 * Provides high-performance endpoints for time synchronization
 */
@RestController
@RequestMapping("/auth-service/v1/server-time")
@CrossOrigin(origins = "*")
public class ServerTimeController {

    @Autowired
    private ServerTimeService serverTimeService;

    /**
     * Get current server time in UTC (fastest endpoint)
     * Optimized for high-frequency polling
     * 
     * @return ServerTimeResponseDTO with UTC time information
     */
    @GetMapping("/utc")
    public ResponseEntity<ServerTimeResponseDTO> getCurrentTimeUTC() {
        ServerTimeResponseDTO response = serverTimeService.getCurrentTimeUTC();
        return ResponseEntity.ok()
                .header("Cache-Control", "no-cache, no-store, must-revalidate")
                .header("Pragma", "no-cache")
                .header("Expires", "0")
                .body(response);
    }

    /**
     * Get current server time in specified timezone
     * Supports all standard timezone identifiers
     * 
     * @param timezone Target timezone (e.g., "America/New_York", "Asia/Kolkata")
     * @return ServerTimeResponseDTO with timezone-specific time information
     */
    @GetMapping
    public ResponseEntity<ServerTimeResponseDTO> getCurrentTime(
            @RequestParam(value = "timezone", required = false, defaultValue = "UTC") String timezone) {
        ServerTimeResponseDTO response = serverTimeService.getCurrentTime(timezone);
        return ResponseEntity.ok()
                .header("Cache-Control", "no-cache, no-store, must-revalidate")
                .header("Pragma", "no-cache")
                .header("Expires", "0")
                .body(response);
    }

    /**
     * Get current server time in system default timezone
     * 
     * @return ServerTimeResponseDTO with system timezone information
     */
    @GetMapping("/system")
    public ResponseEntity<ServerTimeResponseDTO> getCurrentTimeSystemDefault() {
        ServerTimeResponseDTO response = serverTimeService.getCurrentTimeSystemDefault();
        return ResponseEntity.ok()
                .header("Cache-Control", "no-cache, no-store, must-revalidate")
                .header("Pragma", "no-cache")
                .header("Expires", "0")
                .body(response);
    }

    /**
     * Validate if a timezone identifier is supported
     * 
     * @param timezone Timezone identifier to validate
     * @return Boolean indicating if timezone is valid
     */
    @GetMapping("/validate-timezone")
    public ResponseEntity<Boolean> validateTimezone(
            @RequestParam("timezone") String timezone) {
        boolean isValid = serverTimeService.isValidTimezone(timezone);
        return ResponseEntity.ok(isValid);
    }

    /**
     * Get all available timezone identifiers
     * Useful for timezone selection dropdowns
     * 
     * @return Set of all available timezone IDs
     */
    @GetMapping("/timezones")
    public ResponseEntity<Set<String>> getAvailableTimezones() {
        Set<String> timezones = serverTimeService.getAvailableTimezones();
        return ResponseEntity.ok()
                .header("Cache-Control", "public, max-age=86400") // Cache for 24 hours
                .body(timezones);
    }

    /**
     * Health check endpoint for server time service
     * 
     * @return Simple health status
     */
    @GetMapping("/health")
    public ResponseEntity<String> healthCheck() {
        return ResponseEntity.ok("Server Time Service is running");
    }
}
