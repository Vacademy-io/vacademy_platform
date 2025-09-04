package vacademy.io.admin_core_service.features.workflow.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class IdempotencyService {

    private static final ConcurrentHashMap<String, ExecutionStatus> idempotencyStore = new ConcurrentHashMap<>();
    private static final long PROCESSING_TIMEOUT_MINUTES = 30; // 30 minutes timeout

    public static class ExecutionStatus {
        private String state;
        private LocalDateTime timestamp;
        private Map<String, Object> result;
        private String error;
        private String message;

        public ExecutionStatus(String state, String message) {
            this.state = state;
            this.message = message;
            this.timestamp = LocalDateTime.now();
        }

        // Getters and setters
        public String getState() {
            return state;
        }

        public void setState(String state) {
            this.state = state;
        }

        public LocalDateTime getTimestamp() {
            return timestamp;
        }

        public void setTimestamp(LocalDateTime timestamp) {
            this.timestamp = timestamp;
        }

        public Map<String, Object> getResult() {
            return result;
        }

        public void setResult(Map<String, Object> result) {
            this.result = result;
        }

        public String getError() {
            return error;
        }

        public void setError(String error) {
            this.error = error;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }
    }

    /**
     * Check if a workflow execution key has already been processed
     */
    public boolean isAlreadyProcessed(String idempotencyKey) {
        ExecutionStatus status = idempotencyStore.get(idempotencyKey);

        if (status == null) {
            return false; // Not processed yet
        }

        // Check if it's marked as completed or failed
        return "COMPLETED".equals(status.getState()) || "FAILED".equals(status.getState());
    }

    /**
     * Mark a workflow execution as currently processing
     */
    public void markAsProcessing(String idempotencyKey) {
        ExecutionStatus status = new ExecutionStatus("PROCESSING", "Workflow execution in progress");
        idempotencyStore.put(idempotencyKey, status);
        log.debug("Marked workflow execution as processing: {}", idempotencyKey);
    }

    /**
     * Mark a workflow execution as completed
     */
    public void markAsCompleted(String idempotencyKey, Map<String, Object> result) {
        ExecutionStatus status = new ExecutionStatus("COMPLETED", "Workflow execution completed successfully");
        status.setResult(result);
        idempotencyStore.put(idempotencyKey, status);
        log.debug("Marked workflow execution as completed: {}", idempotencyKey);
    }

    /**
     * Mark a workflow execution as failed
     */
    public void markAsFailed(String idempotencyKey, String errorMessage) {
        ExecutionStatus status = new ExecutionStatus("FAILED", "Workflow execution failed");
        status.setError(errorMessage);
        idempotencyStore.put(idempotencyKey, status);
        log.debug("Marked workflow execution as failed: {}", idempotencyKey);
    }

    /**
     * Get the current status of a workflow execution
     */
    public ExecutionStatus getExecutionStatus(String idempotencyKey) {
        return idempotencyStore.get(idempotencyKey);
    }

    /**
     * Clear idempotency key (useful for testing or manual cleanup)
     */
    public void clearIdempotencyKey(String idempotencyKey) {
        idempotencyStore.remove(idempotencyKey);
        log.debug("Cleared idempotency key: {}", idempotencyKey);
    }

    /**
     * Clean up expired processing entries
     */
    public void cleanupExpiredEntries() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(PROCESSING_TIMEOUT_MINUTES);

        idempotencyStore.entrySet().removeIf(entry -> {
            ExecutionStatus status = entry.getValue();
            if ("PROCESSING".equals(status.getState()) && status.getTimestamp().isBefore(cutoff)) {
                log.warn("Cleaning up expired processing entry: {}", entry.getKey());
                return true;
            }
            return false;
        });
    }

    /**
     * Get statistics about idempotency store
     */
    public Map<String, Long> getStatistics() {
        return Map.of(
                "total_entries", (long) idempotencyStore.size(),
                "processing_count", idempotencyStore.values().stream()
                        .filter(s -> "PROCESSING".equals(s.getState())).count(),
                "completed_count", idempotencyStore.values().stream()
                        .filter(s -> "COMPLETED".equals(s.getState())).count(),
                "failed_count", idempotencyStore.values().stream()
                        .filter(s -> "FAILED".equals(s.getState())).count());
    }
}