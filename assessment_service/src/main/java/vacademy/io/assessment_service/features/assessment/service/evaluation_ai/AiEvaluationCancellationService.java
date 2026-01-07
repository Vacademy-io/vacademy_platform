package vacademy.io.assessment_service.features.assessment.service.evaluation_ai;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;

/**
 * Service to manage in-memory cancellation flags for AI evaluation processes.
 * Provides instant cancellation detection without database latency.
 */
@Service
@Slf4j
public class AiEvaluationCancellationService {

        private final ConcurrentHashMap<String, Boolean> cancellationFlags = new ConcurrentHashMap<>();

        /**
         * Set cancellation flag for a process (called by stop endpoint)
         */
        public void cancelProcess(String processId) {
                cancellationFlags.put(processId, true);
                log.info("🚫 Cancellation flag SET for process: {}", processId);
        }

        /**
         * Check if a process has been cancelled
         */
        public boolean isCancelled(String processId) {
                return cancellationFlags.getOrDefault(processId, false);
        }

        /**
         * Clear cancellation flag (called when process completes/fails or is restarted)
         */
        public void clearFlag(String processId) {
                cancellationFlags.remove(processId);
                log.debug("Cleared cancellation flag for process: {}", processId);
        }

        /**
         * Get count of active cancellation flags (for monitoring)
         */
        public int getActiveFlagsCount() {
                return cancellationFlags.size();
        }
}
