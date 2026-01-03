package vacademy.io.media_service.controller.pdf_convert;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.media_service.dto.chat_with_pdf.ChatWithPdfResponse;
import vacademy.io.media_service.dto.task_status.TaskStatusDto;
import vacademy.io.media_service.exception.FileConversionException;
import vacademy.io.media_service.manager.ChatAiManager;
import vacademy.io.media_service.service.FileConversionStatusService;
import vacademy.io.media_service.service.HtmlImageConverter;
import vacademy.io.media_service.service.NewDocConverterService;
import vacademy.io.media_service.util.HtmlParsingUtils;

import java.util.List;

/**
 * Controller for chat with PDF functionality.
 * Enables conversational interactions with PDF documents.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/media-service/ai/chat-with-pdf")
public class ChatWithPdfController {

    private final FileConversionStatusService fileConversionStatusService;
    private final NewDocConverterService newDocConverterService;
    private final HtmlImageConverter htmlImageConverter;
    private final ChatAiManager chatAiManager;

    /**
     * Gets AI response for a chat query on a PDF.
     */
    @GetMapping("/get-response")
    public ResponseEntity<List<ChatWithPdfResponse>> getChat(
            @RequestParam("pdfId") String pdfId,
            @RequestParam("userPrompt") String userPrompt,
            @RequestParam(value = "taskName", required = false) String taskName,
            @RequestParam(value = "instituteId", required = false) String instituteId,
            @RequestParam(value = "parentId", required = false) String parentId) throws Exception {

        var fileConversionStatus = fileConversionStatusService.findByVendorFileId(pdfId);

        String htmlText;
        if (fileConversionStatus.isEmpty() || !StringUtils.hasText(fileConversionStatus.get().getHtmlText())) {
            String html = newDocConverterService.getConvertedHtml(pdfId);
            if (html == null) {
                throw FileConversionException.stillProcessing(pdfId);
            }

            String htmlBody = HtmlParsingUtils.extractBody(html);
            htmlText = htmlImageConverter.convertBase64ToUrls(htmlBody);
            fileConversionStatusService.updateHtmlText(pdfId, htmlText);
        } else {
            htmlText = fileConversionStatus.get().getHtmlText();
        }

        List<ChatWithPdfResponse> response = chatAiManager.generateResponseForPdfChat(
                pdfId, userPrompt, htmlText, taskName, instituteId, parentId);

        return ResponseEntity.ok(response);
    }

    /**
     * Gets previous chat history.
     */
    @GetMapping("/get-chat")
    public ResponseEntity<List<ChatWithPdfResponse>> getPreviousChat(
            @RequestParam("parentId") String parentId) {
        return chatAiManager.getAllChats(parentId);
    }

    /**
     * Gets list of all chat sessions.
     */
    @GetMapping("/get/chat-list")
    public ResponseEntity<List<TaskStatusDto>> getAllChats(
            @RequestParam("instituteId") String instituteId) {
        return chatAiManager.getAllChatsList(instituteId);
    }
}
