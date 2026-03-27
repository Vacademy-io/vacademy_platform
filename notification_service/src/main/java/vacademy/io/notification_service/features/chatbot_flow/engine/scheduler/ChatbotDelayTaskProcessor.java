package vacademy.io.notification_service.features.chatbot_flow.engine.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.notification_service.features.chatbot_flow.engine.ChatbotFlowEngine;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotDelayTask;
import vacademy.io.notification_service.features.chatbot_flow.repository.ChatbotDelayTaskRepository;

/**
 * Processes a single delay task in its own transaction.
 * Separate bean from the scheduler so Spring proxy handles @Transactional correctly.
 * Uses optimistic claim: set PENDING→FIRING only if still PENDING (prevents double-fire).
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ChatbotDelayTaskProcessor {

    private static final int MAX_RETRIES = 3;

    private final ChatbotDelayTaskRepository delayTaskRepository;
    private final ChatbotFlowEngine flowEngine;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void claimAndProcess(ChatbotDelayTask task) {
        // Re-fetch with pessimistic lock (SELECT FOR UPDATE) to prevent double-fire
        ChatbotDelayTask freshTask = delayTaskRepository.findByIdForUpdate(task.getId()).orElse(null);
        if (freshTask == null || !"PENDING".equals(freshTask.getStatus())) {
            // Already claimed by another instance or cancelled
            return;
        }

        // Claim: PENDING → FIRING
        freshTask.setStatus("FIRING");
        delayTaskRepository.save(freshTask);
        // Flush to DB so other instances see FIRING immediately
        delayTaskRepository.flush();

        try {
            flowEngine.resumeAfterDelay(freshTask);

            freshTask.setStatus("FIRED");
            delayTaskRepository.save(freshTask);
            log.info("Delay task fired: taskId={}, sessionId={}", freshTask.getId(), freshTask.getSessionId());

        } catch (Exception e) {
            log.error("Failed to process delay task {}: {}", freshTask.getId(), e.getMessage(), e);
            freshTask.setRetryCount(freshTask.getRetryCount() + 1);
            if (freshTask.getRetryCount() >= MAX_RETRIES) {
                freshTask.setStatus("FAILED");
                log.error("Delay task {} permanently failed after {} retries", freshTask.getId(), MAX_RETRIES);
            } else {
                freshTask.setStatus("PENDING"); // Retry on next poll
            }
            delayTaskRepository.save(freshTask);
        }
    }
}
