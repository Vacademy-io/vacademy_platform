package vacademy.io.media_service.manager;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import vacademy.io.media_service.ai.DeepSeekConversationService;
import vacademy.io.media_service.ai.DeepSeekService;
import vacademy.io.media_service.dto.chat_with_pdf.ChatWithPdfResponse;
import vacademy.io.media_service.enums.TaskStatus;
import vacademy.io.media_service.enums.TaskStatusTypeEnum;
import vacademy.io.media_service.service.TaskStatusService;

import java.util.List;

@Component
public class ChatAiManager {

    @Autowired
    DeepSeekService deepSeekService;

    @Autowired
    TaskStatusService taskStatusService;

    @Autowired
    DeepSeekConversationService deepSeekConversationService;


    public List<ChatWithPdfResponse> generateResponseForPdfChat(String pdfId, String userPrompt, String htmlText, String taskName, String instituteId) {

        String last5Conversations = taskStatusService.getLast5ConversationFromInputIdAndInputType(instituteId,TaskStatusTypeEnum.CHAT_WITH_PDF.name(), pdfId,"PDF_ID");
        String rawOutput = deepSeekConversationService.getResponseForUserPrompt(userPrompt,htmlText,last5Conversations);

        taskStatusService.createNewTaskForResult(instituteId, TaskStatusTypeEnum.CHAT_WITH_PDF.name(),pdfId,"PDF_ID",instituteId,rawOutput,taskName);
        return taskStatusService.getChatResponseForTypeAndInputId(TaskStatusTypeEnum.CHAT_WITH_PDF.name(), "PDF_ID",pdfId,instituteId);
    }
}
