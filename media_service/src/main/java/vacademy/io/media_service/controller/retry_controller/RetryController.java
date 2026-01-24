package vacademy.io.media_service.controller.retry_controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import vacademy.io.media_service.config.AiModelConfig;

import vacademy.io.media_service.entity.TaskStatus;
import vacademy.io.media_service.evaluation_ai.service.TaskRetryService;
import vacademy.io.media_service.exception.TaskProcessingException;
import vacademy.io.media_service.service.TaskStatusService;

import java.util.Map;
import java.util.Optional;

/**
 * Controller for retrying failed tasks.
 * Supports model selection from frontend.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/media-service/ai/retry")
public class RetryController {

    private final TaskStatusService taskStatusService;
    private final TaskRetryService taskRetryService;
    private final AiModelConfig aiModelConfig;

    /**
     * Retries a failed task with optional model override.
     *
     * @param taskId      The ID of the task to retry
     * @param requestBody Optional request body containing retry options
     * @return The new task ID
     */
    @PostMapping("/task")
    public ResponseEntity<Map<String, Object>> retryTask(
            @RequestParam("taskId") String taskId,
            @RequestBody(required = false) RetryRequest requestBody) {

        log.info("Retry request for task: {}", taskId);

        // Validate task exists
        Optional<TaskStatus> oldTaskStatus = taskStatusService.getTaskStatusById(taskId);

        if (oldTaskStatus.isEmpty()) {
            throw TaskProcessingException.taskNotFound(taskId);
        }

        TaskStatus oldTask = oldTaskStatus.get();

        if (!StringUtils.hasText(oldTask.getDynamicValuesMap())) {
            throw new TaskProcessingException(
                    taskId,
                    "retry",
                    "Task does not have saved parameters for retry. Please create a new request.");
        }

        // Get preferred model from request
        String preferredModel = null;
        if (requestBody != null && StringUtils.hasText(requestBody.getPreferredModel())) {
            preferredModel = aiModelConfig.getModelToUse(requestBody.getPreferredModel());
            log.info("Using model {} for retry (requested: {})", preferredModel, requestBody.getPreferredModel());
        }

        // Create new task for retry
        TaskStatus newTask = taskStatusService.updateTaskStatusOrCreateNewTask(
                null,
                oldTask.getType(),
                oldTask.getInputId(),
                oldTask.getInputType(),
                oldTask.getTaskName() + "_retry",
                oldTask.getInstituteId());

        // Start async retry
        taskRetryService.asyncRetryTask(newTask, oldTask.getDynamicValuesMap(), preferredModel);

        log.info("Created retry task: {} from original: {}", newTask.getId(), taskId);

        return ResponseEntity.ok(Map.of(
                "taskId", newTask.getId(),
                "originalTaskId", taskId,
                "status", "STARTED",
                "message", "Retry initiated successfully"));
    }

    /**
     * Gets available models for retry.
     *
     * @return List of available models
     */
    @GetMapping("/available-models")
    public ResponseEntity<Map<String, Object>> getAvailableModels() {
        return ResponseEntity.ok(Map.of(
                "defaultModel", aiModelConfig.getDefaultModel(),
                "availableModels", aiModelConfig.getAllowedModels(),
                "fallbackModels", aiModelConfig.getFallbackModels()));
    }

    /**
     * Request body for retry operation.
     */
    @lombok.Data
    public static class RetryRequest {
        /**
         * Preferred AI model to use for retry.
         * If not specified or not allowed, default model will be used.
         */
        private String preferredModel;

        /**
         * Optional maximum retry attempts override.
         */
        private Integer maxRetries;

        /**
         * Whether to use fallback models on failure.
         */
        private Boolean enableFallback;
    }
}
