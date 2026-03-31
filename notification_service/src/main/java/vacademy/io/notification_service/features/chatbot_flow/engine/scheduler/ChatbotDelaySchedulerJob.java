package vacademy.io.notification_service.features.chatbot_flow.engine.scheduler;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotDelayTask;
import vacademy.io.notification_service.features.chatbot_flow.repository.ChatbotDelayTaskRepository;

import java.sql.Timestamp;
import java.util.List;

/**
 * Polls chatbot_delay_task table for pending delayed tasks and resumes flow execution.
 * Each task is processed in its own transaction to prevent cascading rollbacks.
 */
@Component
@Slf4j
public class ChatbotDelaySchedulerJob {

    private static final int MAX_RETRIES = 3;

    private final ChatbotDelayTaskRepository delayTaskRepository;
    private final ChatbotDelayTaskProcessor taskProcessor;

    public ChatbotDelaySchedulerJob(ChatbotDelayTaskRepository delayTaskRepository,
                                     ChatbotDelayTaskProcessor taskProcessor) {
        this.delayTaskRepository = delayTaskRepository;
        this.taskProcessor = taskProcessor;
    }

    @Scheduled(fixedDelay = 30000) // Poll every 30 seconds
    public void processPendingDelayTasks() {
        Timestamp now = new Timestamp(System.currentTimeMillis());

        // Fetch eligible tasks directly — each task is claimed individually in its own transaction
        List<ChatbotDelayTask> pendingTasks = delayTaskRepository
                .findByStatusAndFireAtBefore("PENDING", now);

        if (pendingTasks.isEmpty()) return;

        log.info("Found {} pending chatbot delay tasks", pendingTasks.size());

        for (ChatbotDelayTask task : pendingTasks) {
            if (task.getRetryCount() >= MAX_RETRIES) {
                continue; // Skip permanently failed tasks
            }
            try {
                // Each task processed in its own transaction via the proxy bean
                taskProcessor.claimAndProcess(task);
            } catch (Exception e) {
                // Already handled inside claimAndProcess, but catch just in case
                log.error("Unexpected error processing delay task {}: {}", task.getId(), e.getMessage());
            }
        }
    }
}
