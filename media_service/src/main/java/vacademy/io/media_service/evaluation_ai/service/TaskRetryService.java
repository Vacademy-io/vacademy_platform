package vacademy.io.media_service.evaluation_ai.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.ai.ExternalAIApiServiceImpl;
import vacademy.io.media_service.ai.ExternalAIApiService;
import vacademy.io.media_service.dto.DeepSeekResponse;
import vacademy.io.media_service.entity.TaskStatus;
import vacademy.io.media_service.enums.TaskStatusEnum;
import vacademy.io.media_service.enums.TaskStatusTypeEnum;
import vacademy.io.media_service.service.TaskStatusService;
import vacademy.io.media_service.util.JsonUtils;

import java.util.Map;

import static vacademy.io.media_service.ai.ExternalAIApiService.getCommaSeparatedQuestionNumbers;
import static vacademy.io.media_service.ai.ExternalAIApiService.getIsProcessCompleted;
import static vacademy.io.media_service.constant.ConstantAiTemplate.getTemplateBasedOnType;

/**
 * Service for handling task retries in case of failures or incomplete processing.
 * Manages asynchronous retry logic with exponential backoff (up to 5 retries).
 */
@Service
public class TaskRetryService {

    private static final int MAX_RETRY_ATTEMPTS = 5;

    @Autowired
    private TaskStatusService taskStatusService;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ExternalAIApiServiceImpl deepSeekApiService;

    /**
     * Initiates an asynchronous retry of a failed task.
     *
     * @param newTask       The new task status to be processed
     * @param oldDynamicMap The dynamic map containing previous task parameters
     */
    public void asyncRetryTask(TaskStatus newTask, String oldDynamicMap) {
        new Thread(() -> {
            try {
                handleRetryInBackground(newTask, oldDynamicMap, 0);
            } catch (Exception e) {
                throw new VacademyException("Failed to retry task: " + e.getMessage());
            }
        }).start();
    }

    /**
     * Handles the retry logic in background thread with recursive retry mechanism.
     *
     * @param newTask       The task to be retried
     * @param oldDynamicMap The dynamic map containing task parameters
     * @param retryCount    Current retry attempt count
     * @throws Exception If processing fails
     */
    private void handleRetryInBackground(TaskStatus newTask, String oldDynamicMap, int retryCount) throws Exception {
        // Base case: stop retrying after max attempts
        if (retryCount >= MAX_RETRY_ATTEMPTS) {
            if (newTask.getResultJson().isEmpty()) {
                taskStatusService.updateTaskStatus(newTask, TaskStatusEnum.FAILED.name(), null, "MAX_RETRY_ATTEMPTS : No Response Generate");
            }
            return;
        }

        // Get appropriate template based on task type
        String template = getTemplateBasedOnType(TaskStatusTypeEnum.valueOf(newTask.getType()));
        Map<String, Object> dynamicMap = objectMapper.readValue(oldDynamicMap, Map.class);

        // Create prompt and store initial task data
        Prompt prompt = new PromptTemplate(template).create(dynamicMap);
        taskStatusService.convertMapToJsonAndStore(dynamicMap, newTask);

        // Call DeepSeek API for processing
        DeepSeekResponse response = deepSeekApiService.getChatCompletion(
                "google/gemini-2.5-flash",
                prompt.getContents().trim(),
                30000
        );

        // Handle empty response case with retry
        if (response == null || response.getChoices() == null || response.getChoices().isEmpty()) {
            handleRetryInBackground(newTask, oldDynamicMap, retryCount + 1);
            return;
        }

        // Process API response
        String resultJson = response.getChoices().get(0).getMessage().getContent();
        String sanitizedJson = JsonUtils.extractAndSanitizeJson(resultJson);
        String mergedJson = mergeWithPreviousResults(newTask.getType(), newTask.getResultJson(), sanitizedJson);

        // Update task status with intermediate results
        taskStatusService.updateTaskStatus(newTask, TaskStatusEnum.PROGRESS.name(), mergedJson, "Questions Generating");

        // Check if task is complete
        if (isTaskComplete(newTask, mergedJson, newTask.getType())) {
            return;
        }

        // Prepare for next retry if needed
        String updatedDynamicMap = prepareNextRetryData(newTask.getType(), oldDynamicMap, sanitizedJson);
        handleRetryInBackground(newTask, updatedDynamicMap, retryCount + 1);
    }

    /**
     * Prepares dynamic map for next retry attempt by updating question numbers.
     *
     * @param taskType         Type of the task being processed
     * @param dynamicMapString Current dynamic map as JSON string
     * @param newResultJson    New results from current attempt
     * @return Updated dynamic map as JSON string
     * @throws JsonProcessingException If JSON processing fails
     */
    private String prepareNextRetryData(String taskType, String dynamicMapString, String newResultJson)
            throws JsonProcessingException {

        if (isQuestionProcessingTask(taskType)) {
            Map<String, Object> dynamicMap = objectMapper.readValue(dynamicMapString, Map.class);
            String questionNumbers = getCommaSeparatedQuestionNumbers(newResultJson);
            dynamicMap.put("questionNumbers", questionNumbers);
            return objectMapper.writeValueAsString(dynamicMap);
        }
        return dynamicMapString;
    }

    /**
     * Checks if task processing is complete based on current results.
     *
     * @param task              The task being processed
     * @param currentResultJson Current processing results
     * @param taskType          Type of the task
     * @return true if task is complete, false otherwise
     */
    private boolean isTaskComplete(TaskStatus task, String currentResultJson, String taskType) {
        if (isQuestionProcessingTask(taskType)) {
            if (getIsProcessCompleted(currentResultJson)) {
                taskStatusService.updateTaskStatus(task, TaskStatusEnum.COMPLETED.name(), currentResultJson, "Questions Generated");
                return true;
            }
        } else {
            if (currentResultJson != null && !currentResultJson.isEmpty()) {
                taskStatusService.updateTaskStatus(task, TaskStatusEnum.COMPLETED.name(), currentResultJson, "Questions Generated");
                return true;
            }
        }
        return false;
    }

    /**
     * Merges new results with previous results based on task type.
     *
     * @param taskType     Type of the task
     * @param previousJson Previous results JSON
     * @param newJson      New results JSON
     * @return Merged JSON string
     */
    private String mergeWithPreviousResults(String taskType, String previousJson, String newJson) {
        if (isQuestionProcessingTask(taskType)) {
            return ExternalAIApiService.mergeQuestionsJson(previousJson, newJson);
        }
        return (previousJson == null || previousJson.isEmpty()) ? newJson : previousJson;
    }

    /**
     * Helper method to check if task is a question processing type.
     *
     * @param taskType Task type to check
     * @return true if task involves question processing
     */
    private boolean isQuestionProcessingTask(String taskType) {
        return taskType.equals(TaskStatusTypeEnum.TEXT_TO_QUESTIONS.name()) ||
                taskType.equals(TaskStatusTypeEnum.PDF_TO_QUESTIONS.name()) ||
                taskType.equals(TaskStatusTypeEnum.AUDIO_TO_QUESTIONS.name()) ||
                taskType.equals(TaskStatusTypeEnum.HTML_TO_QUESTIONS.name()) ||
                taskType.equals(TaskStatusTypeEnum.IMAGE_TO_QUESTIONS.name()) ||
                taskType.equals(TaskStatusTypeEnum.SORT_QUESTIONS_TOPIC_WISE.name());
    }
}