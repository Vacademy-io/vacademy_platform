package vacademy.io.media_service.manager;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.ai.DeepSeekConversationService;
import vacademy.io.media_service.ai.ExternalAIApiService;
import vacademy.io.media_service.dto.chat_with_pdf.ChatWithPdfResponse;
import vacademy.io.media_service.dto.task_status.TaskStatusDto;
import vacademy.io.media_service.entity.TaskStatus;
import vacademy.io.media_service.enums.TaskInputTypeEnum;
import vacademy.io.media_service.enums.TaskStatusTypeEnum;
import vacademy.io.media_service.service.TaskStatusService;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
public class ChatAiManager {

    @Autowired
    ExternalAIApiService deepSeekService;

    @Autowired
    TaskStatusService taskStatusService;

    @Autowired
    DeepSeekConversationService deepSeekConversationService;


    public List<ChatWithPdfResponse> generateResponseForPdfChat(String pdfId, String userPrompt, String htmlText, String taskName, String instituteId, String parentId) {

        String last5Conversations = taskStatusService.getLast5ConversationFromInputIdAndInputType(instituteId, TaskStatusTypeEnum.CHAT_WITH_PDF.name(), pdfId, "PDF_ID");
        String rawOutput = deepSeekConversationService.getResponseForUserPrompt(userPrompt, htmlText, last5Conversations);

        taskStatusService.createNewTaskForResult(instituteId, TaskStatusTypeEnum.CHAT_WITH_PDF.name(), pdfId, TaskInputTypeEnum.PDF_ID.name(), rawOutput, taskName, parentId);
        return taskStatusService.getChatResponseForTypeAndInputId(TaskStatusTypeEnum.CHAT_WITH_PDF.name(), TaskInputTypeEnum.PDF_ID.name(), pdfId, instituteId);
    }

    public ResponseEntity<List<ChatWithPdfResponse>> getAllChats(String parentId) {
        try {
            List<ChatWithPdfResponse> responses = new ArrayList<>();
            List<TaskStatus> allTasks = taskStatusService.getAllTaskFromParentIdAndWithParentId(parentId);
            allTasks.forEach(task -> {
                try {
                    responses.add(task.getPdfChatResponse());
                } catch (Exception e) {
                    log.error("Error Creating Chat: " + e.getMessage());
                }

            });

            return ResponseEntity.ok(responses);
        } catch (Exception e) {
            throw new VacademyException("Failed to get Chats: " + e.getMessage());
        }
    }

    public ResponseEntity<List<TaskStatusDto>> getAllChatsList(String instituteId) {
        List<TaskStatusDto> responses = new ArrayList<>();
        List<TaskStatus> allTasks = taskStatusService.getTaskStatusesByInstituteIdAndNoParentId(instituteId);
        allTasks.forEach(task -> {
            responses.add(task.getTaskDto(null));
        });
        return ResponseEntity.ok(responses);
    }
}
