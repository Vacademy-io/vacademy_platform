package vacademy.io.media_service.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import vacademy.io.media_service.ai.DeepSeekLectureService;
import vacademy.io.media_service.ai.DeepSeekService;
import vacademy.io.media_service.enums.TaskInputTypeEnum;
import vacademy.io.media_service.entity.TaskStatus;
import vacademy.io.media_service.enums.TaskStatusTypeEnum;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.Base64;
import java.util.Date;
import java.util.concurrent.CompletableFuture;

@Slf4j
@Service
public class DeepSeekAsyncTaskService {

    @Autowired
    TaskStatusService taskStatusService;

    @Autowired
    DeepSeekService deepSeekService;

    @Autowired
    DeepSeekLectureService deepSeekLectureService;

    public void processDeepSeekTaskInBackground(String taskId, String pdfId, String userPrompt, String networkHtml, String taskName, String instituteId) {
        try {
            String restoreJson = (taskId == null || taskId.isBlank()) ? "" : taskStatusService.getResultJsonFromTaskId(taskId);

            TaskStatus taskStatus = taskStatusService.updateTaskStatusOrCreateNewTask(taskId, "PDF_TO_QUESTIONS", pdfId, "PDF_ID", taskName,instituteId);

            String rawOutput = deepSeekService.getQuestionsWithDeepSeekFromHTMLRecursive(
                    networkHtml, userPrompt, restoreJson, 0, taskStatus
            );

            taskStatusService.updateTaskStatus(taskStatus, "COMPLETED", rawOutput);
        } catch (Exception e) {
            log.error("Failed To Generate: "+e.getMessage());
        }
    }

    @Async
    public CompletableFuture<Void> processDeepSeekTaskInBackgroundWrapperForPdfToQuestions(String taskId, String pdfId, String userPrompt, String networkHtml,String taskName, String instituteId) {
        return CompletableFuture.runAsync(() -> processDeepSeekTaskInBackground(taskId,pdfId,userPrompt,networkHtml,taskName, instituteId));
    }

    @Async
    public CompletableFuture<Void> processDeepSeekTaskInBackgroundWrapperForPdfToQuestionsOfTopics(String taskId, String pdfId, String networkHtml,String topics,String taskName, String instituteId) {
        return CompletableFuture.runAsync(() -> processDeepSeekTaskInBackgroundForPdftoQuestionOfTopic(taskId,pdfId,topics,networkHtml,taskName, instituteId));
    }

    private void processDeepSeekTaskInBackgroundForPdftoQuestionOfTopic(String taskId, String pdfId, String topics, String networkHtml, String taskName, String instituteId) {
        try {
            String restoreJson = (taskId == null || taskId.isBlank()) ? "" : taskStatusService.getResultJsonFromTaskId(taskId);

            TaskStatus taskStatus = taskStatusService.updateTaskStatusOrCreateNewTask(taskId, "PDF_TO_QUESTIONS_WITH_TOPIC", pdfId, "PDF_ID",taskName,instituteId);

            String rawOutput = deepSeekService.getQuestionsWithDeepSeekFromHTMLOfTopics(
                    networkHtml, topics, restoreJson, 0, taskStatus
            );

            taskStatusService.updateTaskStatus(taskStatus, "COMPLETED", rawOutput);
        } catch (Exception e) {
            log.error("Failed To Generate: "+e.getMessage());
        }
    }

    @Async
    public CompletableFuture<Void> processDeepSeekTaskInBackgroundWrapperForAudioToQuestions(String taskId, String convertedText, String numQuestions, String prompt, String difficulty, String language, String taskName, String instituteId, String audioId) {
        return CompletableFuture.runAsync(() -> processDeepSeekTaskInBackgroundForAudioToQuestionOfTopic(taskId,convertedText,numQuestions,prompt,taskName, instituteId, audioId, difficulty, language));
    }

    private void processDeepSeekTaskInBackgroundForAudioToQuestionOfTopic(String taskId, String convertedText, String numQuestions, String prompt, String taskName, String instituteId, String audioId, String difficulty, String language) {
        try {
            String restoreJson = (taskId == null || taskId.isBlank()) ? "" : taskStatusService.getResultJsonFromTaskId(taskId);

            TaskStatus taskStatus = taskStatusService.updateTaskStatusOrCreateNewTask(taskId, "AUDIO_TO_QUESTIONS", audioId, TaskInputTypeEnum.AUDIO_ID.name(), taskName,instituteId);

            String rawOutput = (deepSeekService.getQuestionsWithDeepSeekFromAudio(convertedText, difficulty, numQuestions, prompt, restoreJson,0,taskStatus));

            taskStatusService.updateTaskStatus(taskStatus, "COMPLETED", rawOutput);
        } catch (Exception e) {
            log.error("Failed To Generate: "+e.getMessage());
        }
    }

    @Async
    public CompletableFuture<Void> processDeepSeekTaskInBackgroundWrapperForLecturePlanner(String userPrompt, String lectureDuration, String language, String methodOfTeaching, String taskName, String instituteId,String level) {
        return CompletableFuture.runAsync(()-> processDeepSeekTaskInBackgroundForLecturePlanner(userPrompt,lectureDuration,language,methodOfTeaching,taskName,instituteId,level));
    }

    private void processDeepSeekTaskInBackgroundForLecturePlanner(String userPrompt, String lectureDuration, String language, String methodOfTeaching,String taskName,String instituteId,String level) {
        try {

            TaskStatus taskStatus = taskStatusService.updateTaskStatusOrCreateNewTask(null, TaskStatusTypeEnum.LECTURE_PLANNER.name(), generateUniqueId(userPrompt), TaskInputTypeEnum.PROMPT_ID.name(), taskName,instituteId);

            String rawOutput = (deepSeekLectureService.generateLecturePlannerFromPrompt(userPrompt, lectureDuration, language, methodOfTeaching,taskStatus,level,0));

            taskStatusService.updateTaskStatus(taskStatus, "COMPLETED", rawOutput);
        } catch (Exception e) {
            log.error("Failed To Generate: "+e.getMessage());
        }
    }

    public static String generateUniqueId(String input) {
        try {
            String timestamp = new SimpleDateFormat("yyyyMMddHHmmssSSS").format(new Date());
            String combined = input + "-" + timestamp;

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(combined.getBytes(StandardCharsets.UTF_8));
            String base64Encoded = Base64.getUrlEncoder().withoutPadding().encodeToString(hash);

            // Return first 20 characters for uniqueness + brevity
            return base64Encoded.substring(0, 20);
        } catch (Exception e) {
            throw new RuntimeException("Error generating unique ID", e);
        }
    }
}
