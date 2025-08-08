package vacademy.io.notification_service.features.announcements.controller;

import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import vacademy.io.notification_service.features.announcements.service.AnnouncementEventService;
import vacademy.io.notification_service.features.announcements.service.SSEConnectionManager;

import java.util.Map;

/**
 * REST Controller for Server-Sent Events (SSE) real-time notifications
 */
@Slf4j
@RestController
@RequestMapping("/notification-service/v1/sse")
@RequiredArgsConstructor
@Validated
public class SSEController {
    
    private final SSEConnectionManager connectionManager;
    private final AnnouncementEventService eventService;
    
    /**
     * Create SSE stream for a specific user to receive real-time announcements
     * 
     * @param userId The ID of the user requesting the stream
     * @param instituteId The ID of the institute the user belongs to
     * @return SseEmitter for real-time event streaming
     */
    @GetMapping(value = "/stream/{userId}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamEvents(@PathVariable @NotBlank String userId,
                                 @RequestParam @NotBlank String instituteId) {
        log.info("Creating SSE stream for user: {} in institute: {}", userId, instituteId);
        
        try {
            SseEmitter emitter = connectionManager.createConnection(userId, instituteId);
            
            if (emitter == null) {
                log.error("Failed to create SSE connection for user: {}", userId);
                // Return a completed emitter to indicate failure
                SseEmitter failedEmitter = new SseEmitter(0L);
                failedEmitter.completeWithError(new RuntimeException("Failed to create connection"));
                return failedEmitter;
            }
            
            log.info("SSE stream created successfully for user: {}", userId);
            return emitter;
            
        } catch (Exception e) {
            log.error("Error creating SSE stream for user: {}", userId, e);
            SseEmitter errorEmitter = new SseEmitter(0L);
            errorEmitter.completeWithError(e);
            return errorEmitter;
        }
    }
    
    /**
     * Create SSE stream for specific mode types (TASKS, SYSTEM_ALERT, etc.)
     * 
     * @param userId The ID of the user requesting the stream
     * @param modeType The specific mode type to filter events for
     * @param instituteId The ID of the institute the user belongs to
     * @return SseEmitter for mode-specific event streaming
     */
    @GetMapping(value = "/stream/{userId}/mode/{modeType}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamModeEvents(@PathVariable @NotBlank String userId,
                                     @PathVariable @NotBlank String modeType,
                                     @RequestParam @NotBlank String instituteId) {
        log.info("Creating mode-specific SSE stream for user: {} in institute: {} for mode: {}", 
                userId, instituteId, modeType);
        
        try {
            // Validate mode type
            if (!isValidModeType(modeType)) {
                log.error("Invalid mode type: {}", modeType);
                SseEmitter errorEmitter = new SseEmitter(0L);
                errorEmitter.completeWithError(new IllegalArgumentException("Invalid mode type: " + modeType));
                return errorEmitter;
            }
            
            // Create connection and register subscription filter for this mode
            SseEmitter emitter = connectionManager.createConnection(userId, instituteId);
            
            if (emitter == null) {
                log.error("Failed to create mode-specific SSE connection for user: {}", userId);
                SseEmitter failedEmitter = new SseEmitter(0L);
                failedEmitter.completeWithError(new RuntimeException("Failed to create connection"));
                return failedEmitter;
            }
            // Subscribe this connection to the requested mode
            connectionManager.subscribeEmitterToMode(emitter, modeType);
            
            log.info("Mode-specific SSE stream created successfully for user: {} and mode: {}", userId, modeType);
            return emitter;
            
        } catch (Exception e) {
            log.error("Error creating mode-specific SSE stream for user: {} and mode: {}", userId, modeType, e);
            SseEmitter errorEmitter = new SseEmitter(0L);
            errorEmitter.completeWithError(e);
            return errorEmitter;
        }
    }
    
    /**
     * Get SSE connection statistics (for monitoring and debugging)
     * 
     * @return Connection statistics including total connections, users, and institutes
     */
    @GetMapping("/stats")
    public ResponseEntity<SSEConnectionManager.ConnectionStats> getConnectionStats() {
        log.debug("Retrieving SSE connection statistics");
        
        try {
            SSEConnectionManager.ConnectionStats stats = eventService.getConnectionStats();
            return ResponseEntity.ok(stats);
            
        } catch (Exception e) {
            log.error("Error retrieving SSE connection statistics", e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Health check endpoint for SSE service
     * 
     * @return Health status and basic metrics
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        log.debug("SSE health check requested");
        
        try {
            SSEConnectionManager.ConnectionStats stats = eventService.getConnectionStats();
            
            Map<String, Object> health = Map.of(
                "status", "UP",
                "service", "SSE Event Streaming",
                "connections", stats.getTotalConnections(),
                "users", stats.getTotalUsers(),
                "institutes", stats.getTotalInstitutes(),
                "timestamp", System.currentTimeMillis()
            );
            
            return ResponseEntity.ok(health);
            
        } catch (Exception e) {
            log.error("SSE health check failed", e);
            
            Map<String, Object> health = Map.of(
                "status", "DOWN",
                "service", "SSE Event Streaming",
                "error", e.getMessage(),
                "timestamp", System.currentTimeMillis()
            );
            
            return ResponseEntity.status(503).body(health);
        }
    }
    
    /**
     * Test endpoint to send a test event to a specific user (for debugging)
     * This endpoint should be removed or secured in production
     */
    @PostMapping("/test/{userId}")
    public ResponseEntity<String> sendTestEvent(@PathVariable @NotBlank String userId,
                                              @RequestBody Map<String, Object> testData) {
        log.info("Sending test event to user: {}", userId);
        
        try {
            // Create a test event
            // AnnouncementEvent testEvent = AnnouncementEvent.builder()
            //         .type(EventType.SYSTEM_ALERT)
            //         .data(testData)
            //         .priority("LOW")
            //         .persistent(false)
            //         .build();
            
            // eventService.sendToUser(userId, testEvent);
            
            return ResponseEntity.ok("Test event sent to user: " + userId);
            
        } catch (Exception e) {
            log.error("Error sending test event to user: {}", userId, e);
            return ResponseEntity.internalServerError().body("Failed to send test event: " + e.getMessage());
        }
    }
    
    /**
     * Validate if the provided mode type is valid
     */
    private boolean isValidModeType(String modeType) {
        try {
            // Check against valid mode types
            return modeType.matches("^(SYSTEM_ALERT|DASHBOARD_PIN|DM|STREAM|RESOURCES|COMMUNITY|TASKS)$");
        } catch (Exception e) {
            return false;
        }
    }
}
