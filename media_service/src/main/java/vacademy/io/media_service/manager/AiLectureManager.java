package vacademy.io.media_service.manager;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.entity.TaskStatus;
import vacademy.io.media_service.enums.TaskInputTypeEnum;
import vacademy.io.media_service.enums.TaskStatusTypeEnum;
import vacademy.io.media_service.service.DeepSeekAsyncTaskService;
import vacademy.io.media_service.service.FileConversionStatusService;
import vacademy.io.media_service.service.NewAudioConverterService;
import vacademy.io.media_service.service.TaskStatusService;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.Base64;
import java.util.Date;

@Component
public class AiLectureManager {

    @Autowired
    DeepSeekAsyncTaskService deepSeekAsyncTaskService;

    @Autowired
    FileConversionStatusService fileConversionStatusService;

    @Autowired
    NewAudioConverterService newAudioConverterService;

    @Autowired
    TaskStatusService taskStatusService;

    public ResponseEntity<String> generateLecturePlanner(String userPrompt, String lectureDuration, String language, String methodOfTeaching, String taskName, String instituteId, String level) {
        TaskStatus taskStatus = taskStatusService.updateTaskStatusOrCreateNewTask(null, TaskStatusTypeEnum.LECTURE_PLANNER.name(), generateUniqueId(userPrompt), TaskInputTypeEnum.PROMPT_ID.name(), taskName, instituteId);
        deepSeekAsyncTaskService.processDeepSeekTaskInBackgroundWrapperForLecturePlanner(taskStatus, userPrompt, lectureDuration, language, methodOfTeaching, level);
        return ResponseEntity.ok(taskStatus.getId());
    }

    public ResponseEntity<String> generateLectureFeedback(String audioId, String instituteId, String taskName) {

        TaskStatus taskStatus = taskStatusService.updateTaskStatusOrCreateNewTask(null, TaskStatusTypeEnum.LECTURE_FEEDBACK.name(), audioId, TaskInputTypeEnum.AUDIO_ID.name(), taskName, instituteId);
        deepSeekAsyncTaskService.pollAndProcessAudioFeedback(taskStatus, audioId);
        return ResponseEntity.ok(taskStatus.getId());
    }

    public String generateUniqueId(String input) {
        try {
            String timestamp = new SimpleDateFormat("yyyyMMddHHmmssSSS").format(new Date());
            String combined = input + "-" + timestamp;

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(combined.getBytes(StandardCharsets.UTF_8));
            String base64Encoded = Base64.getUrlEncoder().withoutPadding().encodeToString(hash);

            // Return first 20 characters for uniqueness + brevity
            return base64Encoded.substring(0, 20);
        } catch (Exception e) {
            throw new VacademyException("Error generating unique ID" + e.getMessage());
        }
    }
}
