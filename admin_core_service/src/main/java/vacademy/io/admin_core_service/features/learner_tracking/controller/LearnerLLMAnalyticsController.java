package vacademy.io.admin_core_service.features.learner_tracking.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ProcessedActivityLogItem;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ProcessedActivityLogsResponse;
import vacademy.io.admin_core_service.features.learner_tracking.entity.ActivityLog;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ActivityLogRepository;
import vacademy.io.admin_core_service.features.learner_tracking.service.ActivityLogProcessorService;
import vacademy.io.admin_core_service.features.learner_tracking.service.LLMActivityAnalyticsService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Client APIs: For frontend/testing use
 * Internal APIs: For microservice communication
 */
@Slf4j
@RestController
@RequestMapping("/admin-core-service/llm-analytics")
@RequiredArgsConstructor
@Tag(name = "LLM Analytics", description = "APIs for managing LLM-based student analytics")
public class LearnerLLMAnalyticsController {

        private final ActivityLogProcessorService activityLogProcessorService;
        private final ActivityLogRepository activityLogRepository;
        private final LLMActivityAnalyticsService llmActivityAnalyticsService;

        // ==================== CLIENT/FRONTEND APIs ====================

        @GetMapping("/processed-logs")
        @Operation(summary = "Get processed activity logs for a user by slideId or sourceId", description = "Fetches all processed activity logs for a user. Either slideId or sourceId must be provided.")
        public ResponseEntity<?> getProcessedLogs(
                        @RequestParam("userId") String userId,
                        @RequestParam(value = "slideId", required = false) String slideId,
                        @RequestParam(value = "sourceId", required = false) String sourceId,
                        @RequestAttribute("user") CustomUserDetails userDetails) {

                log.info("[LLM-Analytics-API] Fetching processed logs for user: {}, slideId: {}, sourceId: {}",
                                userId, slideId, sourceId);

                try {
                        // Validate that at least one identifier is provided
                        if ((slideId == null || slideId.isEmpty()) && (sourceId == null || sourceId.isEmpty())) {
                                return ResponseEntity.badRequest().body(Map.of(
                                                "status", "error",
                                                "message", "Either slideId or sourceId must be provided"));
                        }

                        List<ActivityLog> activityLogs;

                        // Fetch by slide_id or source_id
                        if (slideId != null && !slideId.isEmpty()) {
                                activityLogs = activityLogRepository.findByUserIdAndSlideIdAndStatusProcessed(userId,
                                                slideId);
                        } else {
                                activityLogs = activityLogRepository.findByUserIdAndSourceIdAndStatusProcessed(userId,
                                                sourceId);
                        }

                        // Convert to response DTOs
                        List<ProcessedActivityLogItem> items = activityLogs.stream()
                                        .map(log -> ProcessedActivityLogItem.builder()
                                                        .id(log.getId())
                                                        .userId(log.getUserId())
                                                        .slideId(log.getSlideId())
                                                        .sourceId(log.getSourceId())
                                                        .sourceType(log.getSourceType())
                                                        .status(log.getStatus())
                                                        .processedJson(log.getProcessedJson())
                                                        .createdAt(log.getCreatedAt() != null
                                                                        ? log.getCreatedAt().toLocalDateTime()
                                                                        : null)
                                                        .updatedAt(log.getUpdatedAt() != null
                                                                        ? log.getUpdatedAt().toLocalDateTime()
                                                                        : null)
                                                        .build())
                                        .collect(Collectors.toList());

                        ProcessedActivityLogsResponse response = ProcessedActivityLogsResponse.builder()
                                        .activityLogs(items)
                                        .count(items.size())
                                        .build();

                        log.info("[LLM-Analytics-API] Found {} processed logs for user: {}", items.size(), userId);
                        return ResponseEntity.ok(response);

                } catch (Exception e) {
                        log.error("[LLM-Analytics-API] Error fetching processed logs for user: {}", userId, e);
                        return ResponseEntity.internalServerError().body(Map.of(
                                        "status", "error",
                                        "message", "Failed to fetch processed logs: " + e.getMessage()));
                }
        }

        // ==================== BACKEND/TESTING APIs ====================

        @PostMapping("/process-all")
        @Operation(summary = "Manually trigger processing of all raw activity logs")
        public ResponseEntity<Map<String, String>> processAllRawLogs() {
                log.info("[LLM-Analytics-API] Manual processing triggered");

                try {
                        activityLogProcessorService.processAllRawLogsManually();
                        return ResponseEntity.ok(Map.of(
                                        "status", "success",
                                        "message", "Processing started for all raw activity logs"));
                } catch (Exception e) {
                        log.error("[LLM-Analytics-API] Error in manual processing", e);
                        return ResponseEntity.internalServerError().body(Map.of(
                                        "status", "error",
                                        "message", "Failed to process logs: " + e.getMessage()));
                }
        }

        @PostMapping("/reprocess/{activityLogId}")
        @Operation(summary = "Manually reprocess a specific activity log by ID")
        public ResponseEntity<Map<String, String>> reprocessActivityLog(@PathVariable String activityLogId) {
                log.info("[LLM-Analytics-API] Manual reprocess triggered for activity log ID: {}", activityLogId);

                try {
                        activityLogProcessorService.reprocessActivityLog(activityLogId);
                        return ResponseEntity.ok(Map.of(
                                        "status", "success",
                                        "message", "Activity log reprocessing started",
                                        "activityLogId", activityLogId.toString()));
                } catch (Exception e) {
                        log.error("[LLM-Analytics-API] Error reprocessing activity log {}", activityLogId, e);
                        return ResponseEntity.internalServerError().body(Map.of(
                                        "status", "error",
                                        "message", "Failed to reprocess log: " + e.getMessage()));
                }
        }

        @GetMapping("/health")
        @Operation(summary = "Health check for LLM analytics service")
        public ResponseEntity<Map<String, String>> health() {
                return ResponseEntity.ok(Map.of(
                                "status", "healthy",
                                "message", "LLM Analytics service is running"));
        }

        @GetMapping("/scheduler/status")
        @Operation(summary = "Check scheduler status and get last run info")
        public ResponseEntity<Map<String, Object>> getSchedulerStatus() {
                return ResponseEntity.ok(activityLogProcessorService.getSchedulerStatus());
        }

        @PostMapping("/scheduler/trigger")
        @Operation(summary = "Manually trigger the scheduler job (for testing)")
        public ResponseEntity<Map<String, String>> triggerScheduler() {
                log.info("[LLM-Analytics-API] Manually triggering scheduler job");
                try {
                        activityLogProcessorService.processRawActivityLogs();
                        return ResponseEntity.ok(Map.of(
                                        "status", "success",
                                        "message", "Scheduler job triggered successfully"));
                } catch (Exception e) {
                        log.error("[LLM-Analytics-API] Error triggering scheduler", e);
                        return ResponseEntity.internalServerError().body(Map.of(
                                        "status", "error",
                                        "message", "Failed to trigger scheduler: " + e.getMessage()));
                }
        }

        // ==================== INTERNAL/MICROSERVICE APIs ====================

        /**
         * Receive assessment submission data from assessment_service
         * This is called when a student submits an assessment
         * 
         * @param assessmentData The assessment attempt data with all answers and
         *                       results
         * @return Success response
         */
        @PostMapping("/assessment")
        @Operation(summary = "Internal API: Save assessment data from assessment_service", description = "HMAC authenticated endpoint for microservice communication")
        public ResponseEntity<Map<String, Object>> saveAssessmentData(@RequestBody Map<String, Object> assessmentData) {
                try {
                        llmActivityAnalyticsService.saveAssessmentRawDataFromExternal(assessmentData);

                        return ResponseEntity.ok(Map.of(
                                        "success", true,
                                        "message", "Assessment data saved for LLM analysis"));

                } catch (Exception e) {
                        log.error("Error processing assessment data", e);
                        return ResponseEntity.status(500).body(Map.of(
                                        "success", false,
                                        "message", "Error saving assessment data: " + e.getMessage()));
                }
        }
}
