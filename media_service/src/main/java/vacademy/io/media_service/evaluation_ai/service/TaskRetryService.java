package vacademy.io.media_service.evaluation_ai.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import vacademy.io.media_service.ai.ExternalAIApiServiceImpl;
import vacademy.io.media_service.ai.ExternalAIApiService;
import vacademy.io.media_service.config.AiModelConfig;
import vacademy.io.media_service.dto.DeepSeekResponse;
import vacademy.io.media_service.entity.TaskStatus;
import vacademy.io.media_service.enums.TaskStatusEnum;
import vacademy.io.media_service.enums.TaskStatusTypeEnum;
import vacademy.io.media_service.service.TaskStatusService;
import vacademy.io.media_service.util.JsonUtils;

import jakarta.annotation.PreDestroy;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.*;

import static vacademy.io.media_service.ai.ExternalAIApiService.getCommaSeparatedQuestionNumbers;
import static vacademy.io.media_service.ai.ExternalAIApiService.getIsProcessCompleted;
import static vacademy.io.media_service.constant.ConstantAiTemplate.getTemplateBasedOnType;

/**
 * Service for handling task retries in case of failures or incomplete
 * processing.
 * Uses ScheduledExecutorService for exponential backoff instead of
 * Thread.sleep.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TaskRetryService {

    private static final Set<String> QUESTION_PROCESSING_TASKS = Set.of(
            TaskStatusTypeEnum.TEXT_TO_QUESTIONS.name(),
            TaskStatusTypeEnum.PDF_TO_QUESTIONS.name(),
            TaskStatusTypeEnum.AUDIO_TO_QUESTIONS.name(),
            TaskStatusTypeEnum.HTML_TO_QUESTIONS.name(),
            TaskStatusTypeEnum.IMAGE_TO_QUESTIONS.name(),
            TaskStatusTypeEnum.SORT_QUESTIONS_TOPIC_WISE.name());

    private final TaskStatusService taskStatusService;
    private final ObjectMapper objectMapper;
    private final ExternalAIApiServiceImpl deepSeekApiService;
    private final AiModelConfig aiModelConfig;

    // Scheduler for retry backoff delays
    private final ScheduledExecutorService retryScheduler = Executors.newScheduledThreadPool(3, r -> {
        Thread t = new Thread(r, "Retry-Scheduler");
        t.setDaemon(true);
        return t;
    });

    @PreDestroy
    public void shutdown() {
        retryScheduler.shutdown();
        try {
            if (!retryScheduler.awaitTermination(30, TimeUnit.SECONDS)) {
                retryScheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            retryScheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }

    /**
     * Initiates an asynchronous retry of a failed task.
     * Uses ScheduledExecutorService for exponential backoff.
     *
     * @param newTask       The new task status to be processed
     * @param oldDynamicMap The dynamic map containing previous task parameters
     * @param modelOverride Optional model override from frontend
     * @return CompletableFuture for tracking completion
     */
    @Async("retryExecutor")
    public CompletableFuture<Void> asyncRetryTask(TaskStatus newTask, String oldDynamicMap, String modelOverride) {
        CompletableFuture<Void> resultFuture = new CompletableFuture<>();

        log.info("Starting retry for task: {} with type: {}", newTask.getId(), newTask.getType());

        // Start the retry chain
        scheduleRetryAttempt(newTask, oldDynamicMap, modelOverride, 0, resultFuture);

        return resultFuture.exceptionally(ex -> {
            log.error("Failed to retry task {}: {}", newTask.getId(), ex.getMessage(), ex);
            taskStatusService.updateTaskStatusAndStatusMessage(
                    newTask,
                    TaskStatusEnum.FAILED.name(),
                    newTask.getResultJson(),
                    "Retry failed: " + getRootCauseMessage(ex));
            return null;
        });
    }

    /**
     * Overload for backward compatibility
     */
    @Async("retryExecutor")
    public CompletableFuture<Void> asyncRetryTask(TaskStatus newTask, String oldDynamicMap) {
        return asyncRetryTask(newTask, oldDynamicMap, null);
    }

    /**
     * Schedules a retry attempt with exponential backoff using
     * ScheduledExecutorService.
     */
    private void scheduleRetryAttempt(
            TaskStatus task,
            String dynamicMapStr,
            String modelOverride,
            int attempt,
            CompletableFuture<Void> resultFuture) {

        if (resultFuture.isDone()) {
            return;
        }

        int maxAttempts = aiModelConfig.getMaxRetryAttempts();

        if (attempt >= maxAttempts) {
            handleMaxRetriesExceeded(task);
            resultFuture.complete(null);
            return;
        }

        // Calculate exponential backoff delay: 0s, 1s, 2s, 4s, 8s, 16s...
        long delayMs = attempt == 0 ? 0 : (long) Math.pow(2, attempt - 1) * 1000;

        if (attempt > 0) {
            log.info("Retry attempt {} for task {} - scheduling with {}ms delay", attempt + 1, task.getId(), delayMs);
        }

        retryScheduler.schedule(() -> {
            try {
                boolean completed = processRetryAttempt(task, dynamicMapStr, modelOverride, attempt);

                if (completed) {
                    resultFuture.complete(null);
                } else {
                    // Prepare for next attempt with updated data
                    String updatedDynamicMap = prepareNextRetryData(task.getType(), dynamicMapStr,
                            task.getResultJson());
                    scheduleRetryAttempt(task, updatedDynamicMap, modelOverride, attempt + 1, resultFuture);
                }
            } catch (Exception e) {
                log.warn("Retry attempt {} failed for task {}: {}", attempt + 1, task.getId(), e.getMessage());

                // Try with fallback model on failure
                if (attempt < maxAttempts - 1) {
                    String fallbackModel = getFallbackModel(attempt);
                    log.info("Trying fallback model: {} for task {}", fallbackModel, task.getId());
                    scheduleRetryAttempt(task, dynamicMapStr, fallbackModel, attempt + 1, resultFuture);
                } else {
                    resultFuture.completeExceptionally(e);
                }
            }
        }, delayMs, TimeUnit.MILLISECONDS);
    }

    /**
     * Processes a single retry attempt.
     *
     * @return true if task is complete, false if more attempts needed
     */
    private boolean processRetryAttempt(TaskStatus task, String dynamicMapStr, String modelOverride, int attempt)
            throws Exception {

        // Update status to show progress
        taskStatusService.updateTaskStatus(
                task,
                TaskStatusEnum.PROGRESS.name(),
                task.getResultJson(),
                String.format("Retry attempt %d in progress...", attempt + 1));

        // Get template and create prompt
        String template = getTemplateBasedOnType(TaskStatusTypeEnum.valueOf(task.getType()));
        Map<String, Object> dynamicMap = objectMapper.readValue(dynamicMapStr, Map.class);
        Prompt prompt = new PromptTemplate(template).create(dynamicMap);

        // Store the prompt data
        taskStatusService.convertMapToJsonAndStore(dynamicMap, task);

        // Determine which model to use
        String model = aiModelConfig.getModelToUse(modelOverride);

        // Call AI API
        DeepSeekResponse response = deepSeekApiService.getChatCompletion(
                model,
                prompt.getContents().trim(),
                aiModelConfig.getDefaultTimeoutMs());

        // Handle empty response
        if (response == null || response.getChoices() == null || response.getChoices().isEmpty()) {
            log.warn("Empty response from model {} for task {}", model, task.getId());
            return false; // Will trigger retry
        }

        // Process response
        String resultJson = response.getChoices().get(0).getMessage().getContent();
        String sanitizedJson = JsonUtils.extractAndSanitizeJson(resultJson);
        String mergedJson = mergeWithPreviousResults(task.getType(), task.getResultJson(), sanitizedJson);

        // Update with intermediate results
        taskStatusService.updateTaskStatus(
                task,
                TaskStatusEnum.PROGRESS.name(),
                mergedJson,
                "Processing response...");

        // Check if complete
        if (isTaskComplete(task, mergedJson)) {
            log.info("Task {} completed successfully after {} attempts", task.getId(), attempt + 1);
            taskStatusService.updateTaskStatus(
                    task,
                    TaskStatusEnum.COMPLETED.name(),
                    mergedJson,
                    "Task completed successfully");
            return true;
        }

        return false;
    }

    /**
     * Handles the case when max retries are exceeded.
     */
    private void handleMaxRetriesExceeded(TaskStatus task) {
        String resultJson = task.getResultJson();

        if (resultJson != null && !resultJson.isEmpty()) {
            // We have partial results - mark as completed with what we have
            log.info("Task {} reached max retries but has partial results", task.getId());
            taskStatusService.updateTaskStatus(
                    task,
                    TaskStatusEnum.COMPLETED.name(),
                    resultJson,
                    "Completed with partial results after max retries");
        } else {
            // No results at all - mark as failed
            log.warn("Task {} failed after max retries with no results", task.getId());
            taskStatusService.updateTaskStatusAndStatusMessage(
                    task,
                    TaskStatusEnum.FAILED.name(),
                    null,
                    "Task failed after maximum retry attempts. Please try again with different input.");
        }
    }

    /**
     * Gets a fallback model based on attempt number.
     */
    private String getFallbackModel(int attempt) {
        var fallbackModels = aiModelConfig.getFallbackModels();
        if (fallbackModels.isEmpty()) {
            return aiModelConfig.getDefaultModel();
        }
        int index = Math.min(attempt, fallbackModels.size() - 1);
        return fallbackModels.get(index);
    }

    /**
     * Prepares dynamic map for next retry attempt.
     */
    private String prepareNextRetryData(String taskType, String dynamicMapStr, String newResultJson)
            throws JsonProcessingException {

        if (isQuestionProcessingTask(taskType) && newResultJson != null) {
            Map<String, Object> dynamicMap = objectMapper.readValue(dynamicMapStr, Map.class);
            String questionNumbers = getCommaSeparatedQuestionNumbers(newResultJson);
            dynamicMap.put("allQuestionNumbers", questionNumbers);
            return objectMapper.writeValueAsString(dynamicMap);
        }
        return dynamicMapStr;
    }

    /**
     * Checks if task processing is complete.
     */
    private boolean isTaskComplete(TaskStatus task, String currentResultJson) {
        if (isQuestionProcessingTask(task.getType())) {
            return getIsProcessCompleted(currentResultJson);
        }
        return currentResultJson != null && !currentResultJson.isEmpty();
    }

    /**
     * Merges new results with previous results.
     */
    private String mergeWithPreviousResults(String taskType, String previousJson, String newJson) {
        if (isQuestionProcessingTask(taskType)) {
            return ExternalAIApiService.mergeQuestionsJson(previousJson, newJson);
        }
        return (previousJson == null || previousJson.isEmpty()) ? newJson : previousJson;
    }

    /**
     * Checks if task is a question processing type.
     */
    private boolean isQuestionProcessingTask(String taskType) {
        return QUESTION_PROCESSING_TASKS.contains(taskType);
    }

    /**
     * Gets the root cause message from a throwable chain.
     */
    private String getRootCauseMessage(Throwable throwable) {
        Throwable cause = throwable;
        while (cause.getCause() != null) {
            cause = cause.getCause();
        }
        return cause.getMessage() != null ? cause.getMessage() : throwable.getMessage();
    }
}