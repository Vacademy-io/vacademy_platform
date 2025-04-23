package vacademy.io.media_service.controller.pdf_convert;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.dto.chat_with_pdf.ChatWithPdfResponse;
import vacademy.io.media_service.enums.TaskStatus;
import vacademy.io.media_service.manager.ChatAiManager;
import vacademy.io.media_service.service.*;
import vacademy.io.media_service.service.pdf_covert.PdfHtmlConvertService;

import java.util.List;

@RestController
@RequestMapping("/media-service/ai/chat-with-pdf")
public class ChatWithPdfController {

    @Autowired
    FileConversionStatusService fileConversionStatusService;

    @Autowired
    NewDocConverterService newDocConverterService;

    @Autowired
    PdfHtmlConvertService pdfHtmlConvertService;

    @Autowired
    HtmlImageConverter htmlImageConverter;

    @Autowired
    DeepSeekAsyncTaskService deepSeekAsyncTaskService;

    @Autowired
    TaskStatusService taskStatusService;

    @Autowired
    ChatAiManager chatAiManager;


    @GetMapping("/get-response")
    public ResponseEntity<List<ChatWithPdfResponse>> getChat(@RequestParam("pdfId") String pdfId,
                                                             @RequestParam("userPrompt") String userPrompt,
                                                             @RequestParam(value = "taskName", required = false) String taskName,
                                                             @RequestParam(value = "instituteId", required = false) String instituteId) throws Exception{

        var fileConversionStatus = fileConversionStatusService.findByVendorFileId(pdfId);

        if (fileConversionStatus.isEmpty() || !StringUtils.hasText(fileConversionStatus.get().getHtmlText())) {
            String html = newDocConverterService.getConvertedHtml(pdfId);
            if (html == null) {
                throw new VacademyException("File Still Processing");
            }
            String htmlBody = pdfHtmlConvertService.extractBody(html);
            String networkHtml = htmlImageConverter.convertBase64ToUrls(htmlBody);

            fileConversionStatusService.updateHtmlText(pdfId, networkHtml);

            List<ChatWithPdfResponse> response = chatAiManager.generateResponseForPdfChat(pdfId,userPrompt,networkHtml,taskName,instituteId);


            return ResponseEntity.ok(response);
        }

        List<ChatWithPdfResponse> response = chatAiManager.generateResponseForPdfChat(pdfId,userPrompt,fileConversionStatus.get().getHtmlText(),taskName,instituteId);

        return ResponseEntity.ok(response);
    }
}
