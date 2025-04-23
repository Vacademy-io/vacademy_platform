package vacademy.io.media_service.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import vacademy.io.media_service.ai.DeepSeekService;
import vacademy.io.media_service.enums.TaskStatus;

import java.util.concurrent.CompletableFuture;

@Slf4j
@Service
public class DeepSeekAsyncTaskService {

    @Autowired
    TaskStatusService taskStatusService;

    @Autowired
    DeepSeekService deepSeekService;

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

            TaskStatus taskStatus = taskStatusService.updateTaskStatusOrCreateNewTask(taskId, "PDF_TO_QUESTIONS", pdfId, "PDF_ID",taskName,instituteId);

            String rawOutput = deepSeekService.getQuestionsWithDeepSeekFromHTMLOfTopics(
                    networkHtml, topics, restoreJson, 0, taskStatus
            );

            taskStatusService.updateTaskStatus(taskStatus, "COMPLETED", rawOutput);
        } catch (Exception e) {
            log.error("Failed To Generate: "+e.getMessage());
        }
    }
}
