package vacademy.io.admin_core_service.features.learner_tracking.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.learner_tracking.entity.ActivityLog;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ActivityLogRepository;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Service to process raw activity logs with LLM and generate insights
 * Runs on scheduled basis to process entries with status='raw' and 'failed'
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ActivityLogProcessorService {

        private final ActivityLogRepository activityLogRepository;
        private final StudentAnalyticsLLMService studentAnalyticsLLMService;
        private final ObjectMapper objectMapper;

        private static final int BATCH_SIZE = 10;
        private static final int ENTRIES_PER_RUN = 20;
        private static final String STATUS_RAW = "raw";
        private static final String STATUS_PROCESSED = "processed";
        private static final String STATUS_FAILED = "failed";

        // Scheduler tracking
        private final AtomicReference<LocalDateTime> lastRunTime = new AtomicReference<>();
        private final AtomicReference<LocalDateTime> nextRunTime = new AtomicReference<>();
        private final AtomicInteger totalProcessedCount = new AtomicInteger(0);
        private final AtomicInteger totalFailedCount = new AtomicInteger(0);

        /**
         * Scheduled job that runs every hour to process raw activity logs
         * Cron: 0 0 * * * * = every hour at minute 0
         */
        @Scheduled(cron = "0 0 * * * *")
        public void processRawActivityLogs() {
                LocalDateTime startTime = LocalDateTime.now();
                lastRunTime.set(startTime);
                nextRunTime.set(startTime.plusHours(1));

                log.info("[LLM-Analytics-Scheduler] ===== SCHEDULER RUN STARTED at {} =====", startTime);

                try {
                        List<ActivityLog> rawLogs = activityLogRepository.findByStatusInOrderByCreatedAtAsc(
                                        Arrays.asList(STATUS_RAW, STATUS_FAILED));

                        // Limit to 20 entries per scheduler run to avoid overwhelming the system
                        if (rawLogs.size() > ENTRIES_PER_RUN) {
                                rawLogs = rawLogs.subList(0, ENTRIES_PER_RUN);
                        }

                        if (rawLogs.isEmpty()) {
                                log.info("[LLM-Analytics-Scheduler] No raw activity logs to process");
                                return;
                        }

                        log.info("[LLM-Analytics-Scheduler] Found {} raw activity logs to process", rawLogs.size());

                        int processedInRun = 0;
                        int failedInRun = 0;

                        // Process in batches to avoid overwhelming the system
                        for (int i = 0; i < rawLogs.size(); i += BATCH_SIZE) {
                                int end = Math.min(i + BATCH_SIZE, rawLogs.size());
                                List<ActivityLog> batch = rawLogs.subList(i, end);

                                log.info("[LLM-Analytics-Scheduler] Processing batch {}/{}", (i / BATCH_SIZE) + 1,
                                                (rawLogs.size() + BATCH_SIZE - 1) / BATCH_SIZE);

                                int[] results = processBatch(batch);
                                processedInRun += results[0];
                                failedInRun += results[1];
                        }

                        totalProcessedCount.addAndGet(processedInRun);
                        totalFailedCount.addAndGet(failedInRun);

                        log.info("[LLM-Analytics-Scheduler] ===== SCHEDULER RUN COMPLETED ===== " +
                                        "Processed: {}, Failed: {}, Duration: {}s",
                                        processedInRun, failedInRun,
                                        java.time.Duration.between(startTime, LocalDateTime.now()).getSeconds());

                } catch (Exception e) {
                        log.error("[LLM-Analytics-Scheduler] Error in scheduled processing", e);
                }
        }

        private int[] processBatch(List<ActivityLog> batch) {
                int processed = 0;
                int failed = 0;
                for (ActivityLog activityLog : batch) {
                        try {
                                processActivityLog(activityLog);
                                processed++;
                        } catch (Exception e) {
                                log.error("[LLM-Analytics-Scheduler] Error processing activity log ID: {}",
                                                activityLog.getId(), e);
                                markAsFailed(activityLog, e.getMessage());
                                failed++;
                        }
                }
                return new int[] { processed, failed };
        }

        /**
         * Process a single activity log asynchronously
         */
        @Async
        @Transactional
        public void processActivityLog(ActivityLog activityLog) {
                log.info("[LLM-Analytics-Processing] Processing activity log ID: {}, Type: {}",
                                activityLog.getId(), activityLog.getSourceType());

                if (activityLog.getRawJson() == null || activityLog.getRawJson().isEmpty()) {
                        log.warn("[LLM-Analytics-Processing] Activity log {} has no raw JSON, skipping",
                                        activityLog.getId());
                        return;
                }

                try {
                        // Call LLM to generate insights
                        JsonNode insights = studentAnalyticsLLMService
                                        .generateStudentInsights(activityLog.getRawJson(), activityLog.getSourceType())
                                        .block(); // Block since we're already async

                        if (insights == null) {
                                throw new RuntimeException("LLM returned null insights");
                        }

                        // Validate the insights structure
                        validateInsights(insights);

                        // Convert to JSON string and save
                        String processedJson = objectMapper.writeValueAsString(insights);
                        activityLog.setProcessedJson(processedJson);
                        activityLog.setStatus(STATUS_PROCESSED);

                        activityLogRepository.save(activityLog);

                        log.info("[LLM-Analytics-Processing] Successfully processed activity log ID: {}",
                                        activityLog.getId());

                } catch (Exception e) {
                        log.error("[LLM-Analytics-Processing] Failed to process activity log ID: {}",
                                        activityLog.getId(), e);
                        markAsFailed(activityLog, e.getMessage());
                        throw new RuntimeException("Failed to process activity log", e);
                }
        }

        private void validateInsights(JsonNode insights) {
                // Validate required fields
                if (!insights.has("performance_analysis")) {
                        throw new RuntimeException("Missing performance_analysis in LLM response");
                }
                if (!insights.has("weaknesses")) {
                        throw new RuntimeException("Missing weaknesses in LLM response");
                }
                if (!insights.has("strengths")) {
                        throw new RuntimeException("Missing strengths in LLM response");
                }
                if (!insights.has("areas_of_improvement")) {
                        throw new RuntimeException("Missing areas_of_improvement in LLM response");
                }
                if (!insights.has("improvement_path")) {
                        throw new RuntimeException("Missing improvement_path in LLM response");
                }
                if (!insights.has("flashcards") || !insights.get("flashcards").isArray()) {
                        throw new RuntimeException("Missing or invalid flashcards in LLM response");
                }
        }

        @Transactional
        protected void markAsFailed(ActivityLog activityLog, String errorMessage) {
                try {
                        activityLog.setStatus(STATUS_FAILED);
                        // Store error info in processed_json for debugging
                        String errorJson = String.format("{\"error\": \"%s\", \"timestamp\": \"%s\"}",
                                        errorMessage.replace("\"", "\\\""),
                                        java.time.Instant.now().toString());
                        activityLog.setProcessedJson(errorJson);
                        activityLogRepository.save(activityLog);

                        log.info("[LLM-Analytics-Processing] Marked activity log {} as failed", activityLog.getId());
                } catch (Exception e) {
                        log.error("[LLM-Analytics-Processing] Failed to mark activity log {} as failed",
                                        activityLog.getId(), e);
                }
        }

        /**
         * Manual trigger to process all raw logs (for testing or manual processing)
         */
        public void processAllRawLogsManually() {
                log.info("[LLM-Analytics-Manual] Manual processing triggered");
                processRawActivityLogs();
        }

        /**
         * Process a specific activity log by ID (for manual retry)
         */
        @Transactional
        public void reprocessActivityLog(String activityLogId) {
                log.info("[LLM-Analytics-Manual] Manual reprocess triggered for activity log ID: {}", activityLogId);

                ActivityLog activityLog = activityLogRepository.findById(activityLogId)
                                .orElseThrow(() -> new RuntimeException("Activity log not found: " + activityLogId));

                // Reset status to raw to allow reprocessing
                activityLog.setStatus(STATUS_RAW);
                activityLogRepository.save(activityLog);

                processActivityLog(activityLog);
        }

        /**
         * Get scheduler status and metrics
         */
        public Map<String, Object> getSchedulerStatus() {
                Map<String, Object> status = new HashMap<>();
                status.put("schedulerEnabled", true);
                status.put("cronExpression", "0 0 * * * * (Every hour at minute 0)");
                status.put("lastRunTime", lastRunTime.get() != null ? lastRunTime.get().toString() : "Never run");
                status.put("nextRunTime", nextRunTime.get() != null ? nextRunTime.get().toString() : "In next hour");
                status.put("totalProcessedCount", totalProcessedCount.get());
                status.put("totalFailedCount", totalFailedCount.get());

                // Get current queue size
                long rawCount = activityLogRepository.countByStatus(STATUS_RAW);
                long processedCount = activityLogRepository.countByStatus(STATUS_PROCESSED);
                long failedCount = activityLogRepository.countByStatus(STATUS_FAILED);

                status.put("currentQueueSize", rawCount);
                status.put("processedInDB", processedCount);
                status.put("failedInDB", failedCount);

                return status;
        }
}
