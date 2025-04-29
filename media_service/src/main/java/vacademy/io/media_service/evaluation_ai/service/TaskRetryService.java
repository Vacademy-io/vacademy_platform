package vacademy.io.media_service.evaluation_ai.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.ai.DeepSeekApiService;
import vacademy.io.media_service.ai.DeepSeekService;
import vacademy.io.media_service.dto.DeepSeekResponse;
import vacademy.io.media_service.entity.TaskStatus;
import vacademy.io.media_service.enums.TaskStatusEnum;
import vacademy.io.media_service.enums.TaskStatusTypeEnum;
import vacademy.io.media_service.evaluation_ai.dto.EvaluationUserResponse;
import vacademy.io.media_service.evaluation_ai.entity.EvaluationUser;
import vacademy.io.media_service.evaluation_ai.enums.EvaluationUserSourceEnum;
import vacademy.io.media_service.evaluation_ai.repository.UserEvaluationRepository;
import vacademy.io.media_service.service.TaskStatusService;
import vacademy.io.media_service.util.JsonUtils;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import static vacademy.io.media_service.ai.DeepSeekService.*;
import static vacademy.io.media_service.constant.ConstantAiTemplate.getTemplateBasedOnType;

@Service
public class TaskRetryService {

    @Autowired
    TaskStatusService taskStatusService;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    DeepSeekApiService deepSeekApiService;

    public void asyncRetryTask(TaskStatus newTask, String oldDynamicMap) {
        String initialResultJson = "";
        Integer retryCount = 0;
        new Thread(() -> {
            try {
                handleRetryInBackground(newTask, oldDynamicMap, retryCount);
            } catch (Exception e) {
                throw new VacademyException(e.getMessage());
            }
        }).start();

    }

    private void handleRetryInBackground(TaskStatus newTask, String oldDynamicMap, Integer retryCount) throws Exception {

        if (retryCount == 5) {
            if (newTask.getResultJson().isEmpty()) {
                taskStatusService.updateTaskStatus(newTask, TaskStatusEnum.FAILED.name(), null);
            }
            return;
        }

        String template = getTemplateBasedOnType(TaskStatusTypeEnum.valueOf(newTask.getType()));

        Map dynamicMap = objectMapper.readValue(oldDynamicMap, Map.class);

        Prompt prompt = new PromptTemplate(template).create(dynamicMap);

        taskStatusService.convertMapToJsonAndStore(dynamicMap, newTask);

        DeepSeekResponse response = deepSeekApiService.getChatCompletion("deepseek/deepseek-chat-v3-0324:free", prompt.getContents().trim(), 30000);

        if (Objects.isNull(response) || Objects.isNull(response.getChoices()) || response.getChoices().isEmpty()) {
            handleRetryInBackground(newTask, oldDynamicMap, retryCount + 1);
            return;
        }

        String resultJson = response.getChoices().get(0).getMessage().getContent();
        String newResultJson = JsonUtils.extractAndSanitizeJson(resultJson);
        String newFinalJson = handleOldAndNewJson(newTask.getType(), newTask.getResultJson(), newResultJson);
        taskStatusService.updateTaskStatus(newTask, TaskStatusEnum.PROGRESS.name(), newFinalJson);
        Boolean isCompleted = checkIfTaskIsCompleted(newTask, newFinalJson, newTask.getType());
        if (isCompleted) return;

        String newDynamicMap = handleNewDynamicMap(newTask.getType(), oldDynamicMap, newResultJson);
        handleRetryInBackground(newTask, newDynamicMap, retryCount + 1);
    }

    private String handleNewDynamicMap(String taskType, String dynamicMapString, String newResultJson) throws JsonProcessingException {

        if (taskType.equals(TaskStatusTypeEnum.TEXT_TO_QUESTIONS.name()) || taskType.equals(TaskStatusTypeEnum.PDF_TO_QUESTIONS.name()) || taskType.equals(TaskStatusTypeEnum.AUDIO_TO_QUESTIONS.name()) || taskType.equals(TaskStatusTypeEnum.HTML_TO_QUESTIONS.name()) || taskType.equals(TaskStatusTypeEnum.IMAGE_TO_QUESTIONS.name()) || taskType.equals(TaskStatusTypeEnum.SORT_QUESTIONS_TOPIC_WISE.name())) {
            Map<String, Object> dynamicMap = objectMapper.readValue(dynamicMapString, Map.class);
            String allQuestionNumbers = getCommaSeparatedQuestionNumbers(newResultJson);
            dynamicMap.put("questionNumbers", allQuestionNumbers);
            return objectMapper.writeValueAsString(dynamicMap);
        }
        return dynamicMapString;
    }

    private Boolean checkIfTaskIsCompleted(TaskStatus newTask, String newFinalJson, String taskType) {
        if (taskType.equals(TaskStatusTypeEnum.TEXT_TO_QUESTIONS.name()) || taskType.equals(TaskStatusTypeEnum.PDF_TO_QUESTIONS.name()) || taskType.equals(TaskStatusTypeEnum.AUDIO_TO_QUESTIONS.name()) || taskType.equals(TaskStatusTypeEnum.HTML_TO_QUESTIONS.name()) || taskType.equals(TaskStatusTypeEnum.IMAGE_TO_QUESTIONS.name()) || taskType.equals(TaskStatusTypeEnum.SORT_QUESTIONS_TOPIC_WISE.name())) {

            if (getIsProcessCompleted(newFinalJson)) {
                taskStatusService.updateTaskStatus(newTask, "COMPLETED", newFinalJson);
                return true;
            }

        } else {
            if (newFinalJson != null && !newFinalJson.isEmpty()) {
                taskStatusService.updateTaskStatus(newTask, "COMPLETED", newFinalJson);
                return true;
            } else {
                return false;
            }
        }
        return false;
    }

    String handleOldAndNewJson(String taskType, String oldJson, String newJson) {
        if (taskType.equals(TaskStatusTypeEnum.TEXT_TO_QUESTIONS.name()) || taskType.equals(TaskStatusTypeEnum.PDF_TO_QUESTIONS.name()) || taskType.equals(TaskStatusTypeEnum.AUDIO_TO_QUESTIONS.name()) || taskType.equals(TaskStatusTypeEnum.HTML_TO_QUESTIONS.name()) || taskType.equals(TaskStatusTypeEnum.IMAGE_TO_QUESTIONS.name()) || taskType.equals(TaskStatusTypeEnum.SORT_QUESTIONS_TOPIC_WISE.name())) {
            return DeepSeekService.mergeQuestionsJson(oldJson, newJson);
        } else {
            if (oldJson == null || oldJson.isEmpty()) {
                return newJson;
            } else {
                return oldJson;
            }
        }
    }

}
