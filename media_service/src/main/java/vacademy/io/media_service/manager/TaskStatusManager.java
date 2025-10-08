package vacademy.io.media_service.manager;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.ai.ExternalAIApiService;
import vacademy.io.media_service.dto.AiGeneratedQuestionPaperJsonDto;
import vacademy.io.media_service.dto.AutoQuestionPaperResponse;
import vacademy.io.media_service.dto.lecture.LectureFeedbackDto;
import vacademy.io.media_service.dto.lecture.LecturePlanDto;
import vacademy.io.media_service.dto.task_status.TaskStatusDto;
import vacademy.io.media_service.entity.TaskStatus;
import vacademy.io.media_service.service.TaskStatusService;
import vacademy.io.media_service.util.JsonUtils;

import java.io.IOException;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class TaskStatusManager {

    @Autowired
    TaskStatusService taskStatusService;

    @Autowired
    ExternalAIApiService deepSeekService;

    public static String removeExtraSlashes(String input) {
        // Regular expression to match <img src="..."> and replace with <img src="...">
        String regex = "<img src=\\\\\"(.*?)\\\\\">";
        String replacement = "<img src=\"$1\">";

        // Compile the pattern and create a matcher
        Pattern pattern = Pattern.compile(regex);
        Matcher matcher = pattern.matcher(input);

        // Replace all occurrences of the pattern with the replacement string
        return matcher.replaceAll(replacement);
    }

    public ResponseEntity<List<TaskStatusDto>> getAllTasks(String instituteId, String taskType) {
        List<TaskStatusDto> allTaskStatus = taskStatusService.getAllTaskStatusDtoForInstituteIdAndTaskType(instituteId, taskType);
        return ResponseEntity.ok(allTaskStatus);
    }

    public ResponseEntity<AutoQuestionPaperResponse> getAllQuestions(String taskId) {
        Optional<TaskStatus> taskStatus = taskStatusService.getTaskStatusById(taskId);
        if (taskStatus.isEmpty()) throw new VacademyException("Task Not Found");

        String resultJson = taskStatus.get().getResultJson();
        if (Objects.isNull(resultJson) || resultJson.isEmpty())
            return ResponseEntity.ok(new AutoQuestionPaperResponse());

        try {
            String validJson = JsonUtils.extractAndSanitizeJson(resultJson);
            String cleanedJson = tryUnwrapQuotedJson(validJson);
            return ResponseEntity.ok(createAutoQuestionPaperResponse(cleanedJson));

        } catch (Exception e) {
            return ResponseEntity.ok(new AutoQuestionPaperResponse());
        }
    }

    public AutoQuestionPaperResponse createAutoQuestionPaperResponse(String htmlResponse) {
        AutoQuestionPaperResponse autoQuestionPaperResponse = new AutoQuestionPaperResponse();
        ObjectMapper objectMapper = new ObjectMapper();

        try {
            AiGeneratedQuestionPaperJsonDto response = objectMapper.readValue(htmlResponse, new TypeReference<AiGeneratedQuestionPaperJsonDto>() {
            });

            autoQuestionPaperResponse.setQuestions(deepSeekService.formatQuestions(response.getQuestions()));
            autoQuestionPaperResponse.setTitle(response.getTitle());
            autoQuestionPaperResponse.setTags(response.getTags());
            autoQuestionPaperResponse.setClasses(response.getClasses());
            autoQuestionPaperResponse.setSubjects(response.getSubjects());
            autoQuestionPaperResponse.setDifficulty(response.getDifficulty());

        } catch (IOException e) {
            throw new VacademyException(e.getMessage());
        }

        return autoQuestionPaperResponse;
    }

    private String tryUnwrapQuotedJson(String json) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode node = mapper.readTree(json);
            if (node.isTextual()) {
                String inner = node.textValue();
                // inner might itself contain extra wrappers or markdown fences
                String trimmed = inner.trim()
                        .replaceFirst("(?is)^```json\\s*", "")
                        .replaceFirst("(?s)```$", "");
                return JsonUtils.extractAndSanitizeJson(trimmed);
            }
            return json;
        } catch (Exception ex) {
            // Fallback manual unescape for cases where the entire JSON is double-escaped
            String s = json.trim()
                    .replaceFirst("(?is)^```json\\s*", "")
                    .replaceFirst("(?s)```$", "");
            if (s.startsWith("\"") && s.endsWith("\"")) {
                s = s.substring(1, s.length() - 1);
            }
            s = s.replace("\\\"", "\"")
                    .replace("\\n", "\n")
                    .replace("\\t", "\t")
                    .replace("\\/", "/");
            try {
                return JsonUtils.extractAndSanitizeJson(s);
            } catch (Exception ignored) {
                return s;
            }
        }
    }

    public ResponseEntity<LecturePlanDto> getLecturePlan(String taskId) {
        Optional<TaskStatus> taskStatus = taskStatusService.getTaskStatusById(taskId);
        if (taskStatus.isEmpty()) throw new VacademyException("Task Not Found");

        String resultJson = taskStatus.get().getResultJson();
        if (Objects.isNull(resultJson) || resultJson.isEmpty()) return ResponseEntity.ok(new LecturePlanDto());

        try {
            String validJson = JsonUtils.extractAndSanitizeJson(resultJson);
            return ResponseEntity.ok(createLecturePlanDtoFromJson(validJson));

        } catch (Exception e) {
            return ResponseEntity.ok(new LecturePlanDto());
        }
    }

    private LecturePlanDto createLecturePlanDtoFromJson(String validJson) throws Exception {
        ObjectMapper objectMapper = new ObjectMapper();
        return objectMapper.readValue(validJson, LecturePlanDto.class);

    }

    public ResponseEntity<LectureFeedbackDto> getLectureFeedback(String taskId) {
        try {
            Optional<TaskStatus> taskStatus = taskStatusService.getTaskStatusById(taskId);
            if (taskStatus.isEmpty()) throw new VacademyException(HttpStatus.NOT_FOUND, "Task Not Found");

            return ResponseEntity.ok(taskStatus.get().getLectureFeedbackDto());
        } catch (Exception e) {
            return ResponseEntity.ok(new LectureFeedbackDto());
        }
    }
}
