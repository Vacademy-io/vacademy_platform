package vacademy.io.media_service.controller.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.media_service.ai.ExternalAIApiService;
import vacademy.io.media_service.dto.AutoDocumentSubmitResponse;
import vacademy.io.media_service.dto.AutoQuestionPaperResponse;
import vacademy.io.media_service.dto.PdfHtmlResponseStatusResponse;
import vacademy.io.media_service.exception.FileConversionException;
import vacademy.io.media_service.service.*;
import vacademy.io.media_service.util.HtmlParsingUtils;
import vacademy.io.media_service.util.JsonUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Controller for AI-powered question generation.
 * Refactored with cleaner code and better error handling.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/media-service/ai/get-question")
public class QuestionGeneratorController {

    private final HtmlImageConverter htmlImageConverter;
    private final ExternalAIApiService externalAIApiService;
    private final FileService fileService;
    private final DocConverterService docConverterService;
    private final NewDocConverterService newDocConverterService;
    private final ResponseConverterService responseConverterService;

    /**
     * Generates questions from HTML file.
     */
    @PostMapping("/from-html")
    public ResponseEntity<AutoQuestionPaperResponse> fromHtml(
            @RequestParam(required = false) String userPrompt,
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false, defaultValue = "false") Boolean generateImage) {

        validateHtmlFile(file);

        try {
            String html = new String(file.getBytes(), StandardCharsets.UTF_8);
            String htmlBody = HtmlParsingUtils.extractBody(html);
            String networkHtml = htmlImageConverter.convertBase64ToUrls(htmlBody);

            String rawOutput = externalAIApiService.getQuestionsWithDeepSeekFromHTML(networkHtml, userPrompt,
                    generateImage);
            String validJson = JsonUtils.extractAndSanitizeJson(rawOutput);

            return ResponseEntity.ok(responseConverterService.convertToQuestionPaperResponse(
                    HtmlParsingUtils.removeExtraSlashes(validJson)));

        } catch (IOException e) {
            log.error("Failed to process HTML file: {}", e.getMessage(), e);
            throw FileConversionException.conversionFailed(file.getOriginalFilename(), e.getMessage());
        }
    }

    /**
     * Generates questions from non-HTML document (docx, pdf, etc.).
     */
    @PostMapping("/from-not-html")
    public ResponseEntity<AutoQuestionPaperResponse> fromNotHtml(
            @RequestParam(required = false) String userPrompt,
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false, defaultValue = "false") Boolean generateImage) {

        try {
            String html = docConverterService.convertDocument(file);
            String htmlBody = HtmlParsingUtils.extractBody(html);
            String networkHtml = htmlImageConverter.convertBase64ToUrls(htmlBody);

            String rawOutput = externalAIApiService.getQuestionsWithDeepSeekFromHTML(networkHtml, userPrompt,
                    generateImage);
            String validJson = JsonUtils.extractAndSanitizeJson(rawOutput);

            return ResponseEntity.ok(responseConverterService.convertToQuestionPaperResponse(
                    HtmlParsingUtils.removeExtraSlashes(validJson)));

        } catch (IOException e) {
            log.error("Failed to process document: {}", e.getMessage(), e);
            throw FileConversionException.conversionFailed(file.getOriginalFilename(), e.getMessage());
        }
    }

    /**
     * Starts math-aware document processing.
     */
    @PostMapping("/math-parser/from-not-html")
    public ResponseEntity<AutoDocumentSubmitResponse> fromNotHtmlMathParser(
            @RequestParam("file") MultipartFile file) {

        validateNonHtmlFile(file);

        try {
            String publicUrl = fileService.uploadFile(file);
            if (publicUrl == null || publicUrl.isEmpty()) {
                throw FileConversionException.uploadFailed(file.getOriginalFilename());
            }

            String pdfId = newDocConverterService.startProcessing(publicUrl);
            if (pdfId == null || pdfId.isEmpty()) {
                throw FileConversionException.conversionFailed(file.getOriginalFilename(),
                        "Processing failed to start");
            }

            log.info("Started math parser processing: pdfId={}", pdfId);
            return ResponseEntity.ok(new AutoDocumentSubmitResponse(pdfId));

        } catch (FileConversionException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to start math parser: {}", e.getMessage(), e);
            throw FileConversionException.uploadFailed(file.getOriginalFilename());
        }
    }

    /**
     * Gets converted HTML from math parser.
     */
    @GetMapping("/math-parser/pdf-to-html")
    public ResponseEntity<PdfHtmlResponseStatusResponse> getMathParserPdfHtml(
            @RequestParam String pdfId) throws IOException {

        String html = newDocConverterService.getConvertedHtml(pdfId);
        if (html == null) {
            throw FileConversionException.stillProcessing(pdfId);
        }

        String htmlBody = HtmlParsingUtils.extractBody(html);
        String networkHtml = htmlImageConverter.convertBase64ToUrls(htmlBody);

        return ResponseEntity.ok(new PdfHtmlResponseStatusResponse(networkHtml));
    }

    // ==================== Helper Methods ====================

    private void validateHtmlFile(MultipartFile file) {
        if (!HtmlParsingUtils.isHtmlContentType(file.getContentType())) {
            throw FileConversionException.invalidFormat("HTML");
        }
    }

    private void validateNonHtmlFile(MultipartFile file) {
        if (HtmlParsingUtils.isHtmlContentType(file.getContentType())) {
            throw FileConversionException.invalidFormat("non-HTML (PDF, DOCX, images)");
        }
    }
}
