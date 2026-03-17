package vacademy.io.media_service.ai;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.constant.ConstantAiTemplate;
import vacademy.io.media_service.dto.DeepSeekResponse;
import vacademy.io.media_service.entity.TaskStatus;
import vacademy.io.media_service.entity.TaskStatusEnum;
import vacademy.io.media_service.enums.TaskStatusTypeEnum;
import vacademy.io.media_service.service.TaskStatusService;
import vacademy.io.media_service.util.JsonUtils;

import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Slf4j
@Service
public class DeepSeekLectureService {

    @Autowired
    TaskStatusService taskStatusService;
    @Autowired
    private ExternalAIApiServiceImpl deepSeekApiService;

    public String generateLecturePlannerFromPrompt(String userPrompt, String lectureDuration, String language,
            String methodOfTeaching, TaskStatus taskStatus, String level, Integer attempt) {
        if (attempt >= 3) {
            throw new VacademyException("No response from DeepSeek");
        }
        try {
            String template = ConstantAiTemplate.getTemplateBasedOnType(TaskStatusTypeEnum.LECTURE_PLANNER);

            Map<String, Object> promptMap = Map.of("userPrompt", userPrompt,
                    "language", (language == null || language.isEmpty()) ? "en" : language,
                    "lectureDuration", lectureDuration,
                    "methodOfTeaching",
                    (methodOfTeaching == null || methodOfTeaching.isEmpty()) ? "Concept First" : methodOfTeaching,
                    "level", level);
            Prompt prompt = new PromptTemplate(template)
                    .create(promptMap);

            taskStatusService.convertMapToJsonAndStore(promptMap, taskStatus);

            DeepSeekResponse response = deepSeekApiService.getChatCompletion("google/gemini-2.5-flash-preview-09-2025",
                    prompt.getContents().trim(), 30000,
                    "lecture", getInstituteUUID(taskStatus), null);
            if (Objects.isNull(response) || Objects.isNull(response.getChoices()) || response.getChoices().isEmpty()) {
                return generateLecturePlannerFromPrompt(userPrompt, lectureDuration, language, methodOfTeaching,
                        taskStatus, level, attempt + 1);
            }
            String resultJson = response.getChoices().get(0).getMessage().getContent();
            String validJson = JsonUtils.extractAndSanitizeJson(resultJson);

            taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.COMPLETED.name(), validJson,
                    "Lecture Planner Generated");

            return validJson;
        } catch (Exception e) {
            taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FAILED.name(), e.getMessage(),
                    e.getMessage());
            throw new VacademyException("Failed to generate: " + e.getMessage());
        }
    }

    public String generateLectureFeedback(String text, String convertedAudioResponseString, TaskStatus taskStatus,
            int attempt, String audioPace) {

        if (attempt >= 3) {
            throw new VacademyException("No response from DeepSeek");
        }
        try {
            String template = ConstantAiTemplate.getTemplateBasedOnType(TaskStatusTypeEnum.LECTURE_FEEDBACK);

            Map<String, Object> promptMap = Map.of("text", text,
                    "convertedAudioResponseString", convertedAudioResponseString,
                    "audioPace", audioPace);

            Prompt prompt = new PromptTemplate(template)
                    .create(promptMap);

            taskStatusService.convertMapToJsonAndStore(promptMap, taskStatus);

            DeepSeekResponse response = deepSeekApiService.getChatCompletion("google/gemini-2.5-flash-preview-09-2025",
                    prompt.getContents().trim(), 30000,
                    "lecture", getInstituteUUID(taskStatus), null);

            if (Objects.isNull(response) || Objects.isNull(response.getChoices()) || response.getChoices().isEmpty()
                    || response.getChoices().get(0).getMessage().getContent().isEmpty()) {
                return generateLectureFeedback(text, convertedAudioResponseString, taskStatus, attempt + 1, audioPace);
            }
            String resultJson = response.getChoices().get(0).getMessage().getContent();
            String validJson = JsonUtils.extractAndSanitizeJson(resultJson);

            taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.COMPLETED.name(), validJson,
                    "Lecture Feedback Generated");

            return validJson;
        } catch (Exception e) {
            taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FAILED.name(), e.getMessage(),
                    e.getMessage());
            throw new VacademyException("Failed to generate: " + e.getMessage());
        }
    }

    /**
     * Helper method to extract institute UUID from TaskStatus.
     */
    private UUID getInstituteUUID(TaskStatus taskStatus) {
        if (taskStatus == null || taskStatus.getInstituteId() == null) {
            return null;
        }
        try {
            return UUID.fromString(taskStatus.getInstituteId());
        } catch (IllegalArgumentException e) {
            log.warn("Invalid institute ID format: {}", taskStatus.getInstituteId());
            return null;
        }
    }
}
