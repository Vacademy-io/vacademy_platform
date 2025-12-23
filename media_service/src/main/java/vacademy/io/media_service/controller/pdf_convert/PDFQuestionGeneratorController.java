package vacademy.io.media_service.controller.pdf_convert;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.util.ObjectUtils;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.common.media.dto.FileDetailsDTO;
import vacademy.io.media_service.ai.ExternalAIApiService;
import vacademy.io.media_service.config.AiModelConfig;
import vacademy.io.media_service.dto.*;
import vacademy.io.media_service.entity.TaskStatus;
import vacademy.io.media_service.enums.TaskInputTypeEnum;
import vacademy.io.media_service.enums.TaskStatusTypeEnum;
import vacademy.io.media_service.exception.FileConversionException;
import vacademy.io.media_service.service.*;
import vacademy.io.media_service.util.HtmlParsingUtils;
import vacademy.io.media_service.util.JsonUtils;

import java.io.IOException;
import java.util.Map;

/**
 * Controller for PDF-based question generation.
 * Refactored with cleaner code structure, model selection support, and better
 * error handling.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/media-service/ai/get-question-pdf")
public class PDFQuestionGeneratorController {

    private final HtmlImageConverter htmlImageConverter;
    private final ExternalAIApiService externalAIApiService;
    private final TaskStatusService taskStatusService;
    private final DeepSeekAsyncTaskService deepSeekAsyncTaskService;
    private final ObjectMapper objectMapper;
    private final FileService fileService;
    private final FileConversionStatusService fileConversionStatusService;
    private final NewDocConverterService newDocConverterService;
    private final ResponseConverterService responseConverterService;
    private final AiModelConfig aiModelConfig;

    // ==================== PDF Upload & Processing ====================

    /**
     * Starts PDF processing by uploading file to MathPix.
     */
    @PostMapping("/math-parser/start-process-pdf")
    public ResponseEntity<AutoDocumentSubmitResponse> startProcessPdf(
            @RequestParam("file") MultipartFile file) {

        validateNonHtmlFile(file);

        try {
            FileDetailsDTO fileDetailsDTO = fileService.uploadFileWithDetails(file);
            if (ObjectUtils.isEmpty(fileDetailsDTO) || !StringUtils.hasText(fileDetailsDTO.getUrl())) {
                throw FileConversionException.uploadFailed(file.getOriginalFilename());
            }

            String pdfId = newDocConverterService.startProcessing(fileDetailsDTO.getUrl());
            if (!StringUtils.hasText(pdfId)) {
                throw FileConversionException.conversionFailed(fileDetailsDTO.getId(), "Failed to start processing");
            }

            fileConversionStatusService.startProcessing(pdfId, "mathpix", fileDetailsDTO.getId());

            log.info("Started PDF processing: pdfId={}, fileId={}", pdfId, fileDetailsDTO.getId());
            return ResponseEntity.ok(new AutoDocumentSubmitResponse(pdfId));

        } catch (FileConversionException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to start PDF processing: {}", e.getMessage(), e);
            throw FileConversionException.uploadFailed(file.getOriginalFilename());
        }
    }

    /**
     * Starts PDF processing from existing file ID.
     */
    @PostMapping("/math-parser/start-process-pdf-file-id")
    public ResponseEntity<AutoDocumentSubmitResponse> startProcessPdfFromFileId(
            @RequestBody FileIdSubmitRequest request) {

        try {
            var fileDetailsDTOs = fileService.getMultipleFileDetailsWithExpiryAndId(request.getFileId(), 7);
            if (ObjectUtils.isEmpty(fileDetailsDTOs) || fileDetailsDTOs.isEmpty()) {
                throw FileConversionException.uploadFailed(request.getFileId());
            }

            String pdfId = newDocConverterService.startProcessing(fileDetailsDTOs.get(0).getUrl());
            if (!StringUtils.hasText(pdfId)) {
                throw FileConversionException.conversionFailed(request.getFileId(), "Failed to start processing");
            }

            fileConversionStatusService.startProcessing(pdfId, "mathpix", fileDetailsDTOs.get(0).getId());

            log.info("Started PDF processing from fileId: pdfId={}", pdfId);
            return ResponseEntity.ok(new AutoDocumentSubmitResponse(pdfId));

        } catch (FileConversionException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to start PDF processing from fileId: {}", e.getMessage(), e);
            throw FileConversionException.uploadFailed(request.getFileId());
        }
    }

    // ==================== Question Generation ====================

    /**
     * Generates questions from PDF with optional model selection.
     */
    @GetMapping("/math-parser/pdf-to-questions")
    public ResponseEntity<Map<String, Object>> getPdfToQuestions(
            @RequestParam String pdfId,
            @RequestParam(required = false) String userPrompt,
            @RequestParam(name = "taskId", required = false) String taskId,
            @RequestParam(name = "taskName", required = false) String taskName,
            @RequestParam(name = "instituteId", required = false) String instituteId,
            @RequestParam(name = "preferredModel", required = false) String preferredModel) throws IOException {

        String model = aiModelConfig.getModelToUse(preferredModel);

        TaskStatus taskStatus = taskStatusService.updateTaskStatusOrCreateNewTask(
                taskId,
                TaskStatusTypeEnum.PDF_TO_QUESTIONS.name(),
                pdfId,
                TaskInputTypeEnum.PDF_ID.name(),
                taskName,
                instituteId);

        deepSeekAsyncTaskService.pollAndProcessPdfToQuestions(taskStatus, pdfId, userPrompt, model);

        log.info("Started PDF to questions: taskId={}, pdfId={}, model={}", taskStatus.getId(), pdfId, model);

        return ResponseEntity.ok(Map.of(
                "taskId", taskStatus.getId(),
                "status", "STARTED",
                "model", model,
                "message", "Question generation started"));
    }

    /**
     * Generates questions from image.
     */
    @GetMapping("/math-parser/image-to-questions")
    public ResponseEntity<Map<String, Object>> getImageToQuestions(
            @RequestParam String pdfId,
            @RequestParam(required = false) String userPrompt,
            @RequestParam(name = "taskId", required = false) String taskId,
            @RequestParam(name = "taskName", required = false) String taskName,
            @RequestParam(name = "instituteId", required = false) String instituteId,
            @RequestParam(name = "preferredModel", required = false) String preferredModel) throws IOException {

        String model = aiModelConfig.getModelToUse(preferredModel);

        TaskStatus taskStatus = taskStatusService.updateTaskStatusOrCreateNewTask(
                taskId,
                TaskStatusTypeEnum.IMAGE_TO_QUESTIONS.name(),
                pdfId,
                TaskInputTypeEnum.IMAGE_ID.name(),
                taskName,
                instituteId);

        deepSeekAsyncTaskService.pollAndProcessPdfToQuestions(taskStatus, pdfId, userPrompt, model);

        return ResponseEntity.ok(Map.of(
                "taskId", taskStatus.getId(),
                "status", "STARTED",
                "model", model));
    }

    /**
     * Sorts questions by topic.
     */
    @GetMapping("/math-parser/topic-wise/pdf-to-questions")
    public ResponseEntity<Map<String, Object>> getPdfToQuestionsTopicWise(
            @RequestParam String pdfId,
            @RequestParam(required = false) String userPrompt,
            @RequestParam("instituteId") String instituteId,
            @RequestParam("taskName") String taskName) throws IOException {

        TaskStatus taskStatus = taskStatusService.updateTaskStatusOrCreateNewTask(
                null,
                TaskStatusTypeEnum.SORT_QUESTIONS_TOPIC_WISE.name(),
                pdfId,
                TaskInputTypeEnum.PDF_ID.name(),
                taskName,
                instituteId);

        deepSeekAsyncTaskService.pollAndProcessSortQuestionTopicWise(taskStatus, pdfId);

        return ResponseEntity.ok(Map.of(
                "taskId", taskStatus.getId(),
                "status", "STARTED"));
    }

    /**
     * Generates questions from HTML directly.
     */
    @PostMapping("/math-parser/html-to-questions")
    public ResponseEntity<AutoQuestionPaperResponse> getHtmlToQuestions(
            @RequestBody HtmlResponse html,
            @RequestParam(required = false) String userPrompt) throws IOException {

        String rawOutput = externalAIApiService.getQuestionsWithDeepSeekFromHTML(html.getHtml(), userPrompt);
        String validJson = JsonUtils.extractAndSanitizeJson(rawOutput);

        return ResponseEntity.ok(responseConverterService.convertToQuestionPaperResponse(
                HtmlParsingUtils.removeExtraSlashes(validJson)));
    }

    /**
     * Gets HTML from processed PDF.
     */
    @GetMapping("/math-parser/pdf-to-html")
    public ResponseEntity<HtmlResponse> getPdfToHtml(@RequestParam String pdfId) throws IOException {

        var fileConversionStatus = fileConversionStatusService.findByVendorFileId(pdfId);

        if (fileConversionStatus.isEmpty() || !StringUtils.hasText(fileConversionStatus.get().getHtmlText())) {
            String html = newDocConverterService.getConvertedHtml(pdfId);
            if (html == null) {
                throw FileConversionException.stillProcessing(pdfId);
            }

            String htmlBody = HtmlParsingUtils.extractBody(html);
            String networkHtml = htmlImageConverter.convertBase64ToUrls(htmlBody);
            fileConversionStatusService.updateHtmlText(pdfId, networkHtml);

            return ResponseEntity.ok(new HtmlResponse(networkHtml));
        }

        return ResponseEntity.ok(new HtmlResponse(fileConversionStatus.get().getHtmlText()));
    }

    /**
     * Extracts questions for specific topics.
     */
    @GetMapping("/math-parser/pdf-to-extract-topic-questions")
    public ResponseEntity<Map<String, Object>> getPdfTopicQuestions(
            @RequestParam String pdfId,
            @RequestParam String requiredTopics,
            @RequestParam(name = "taskId", required = false) String taskId,
            @RequestParam(name = "taskName", required = false) String taskName,
            @RequestParam(name = "instituteId", required = false) String instituteId) throws IOException {

        TaskStatus taskStatus = taskStatusService.updateTaskStatusOrCreateNewTask(
                taskId,
                TaskStatusTypeEnum.PDF_TO_QUESTIONS_WITH_TOPIC.name(),
                pdfId,
                TaskInputTypeEnum.PDF_ID.name(),
                taskName,
                instituteId);

        deepSeekAsyncTaskService.pollAndProcessPdfExtractTopicQuestions(taskStatus, pdfId, requiredTopics);

        return ResponseEntity.ok(Map.of(
                "taskId", taskStatus.getId(),
                "status", "STARTED"));
    }

    /**
     * Evaluates manual answer sheets.
     */
    @PostMapping("/math-parser/check-manual-answer")
    public ResponseEntity<AIManualEvaluationQuestionPaperResponse> evaluateManualAnswer(
            @RequestParam String pdfId,
            @RequestBody AIManualEvaluationQuestionPaperRequest request) throws IOException {

        if (request == null) {
            throw new IllegalArgumentException("Request body is required");
        }

        // Set defaults
        if (request.getTotalMarks() == null) {
            request.setTotalMarks(100D);
        }
        if (request.getEvaluationDifficulty() == null) {
            request.setEvaluationDifficulty("hard and medium");
        }

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

        String rawOutput = externalAIApiService.evaluateManualAnswerSheet(
                htmlText,
                request.getHtmlQuestion(),
                request.getTotalMarks(),
                request.getEvaluationDifficulty());

        String validJson = JsonUtils.extractAndSanitizeJson(rawOutput);
        return ResponseEntity
                .ok(createManualEvaluationResponse(request, HtmlParsingUtils.removeExtraSlashes(validJson)));
    }

    /**
     * Generates questions from text with model selection support.
     */
    @PostMapping("/from-text")
    public ResponseEntity<Map<String, Object>> fromText(
            @RequestBody TextDTO textPrompt,
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "taskId", required = false) String taskId) {

        String model = aiModelConfig.getModelToUse(textPrompt.getPreferredModel());

        TaskStatus taskStatus = taskStatusService.updateTaskStatusOrCreateNewTask(
                taskId,
                TaskStatusTypeEnum.TEXT_TO_QUESTIONS.name(),
                deepSeekAsyncTaskService.generateUniqueId(textPrompt.getText()),
                TaskInputTypeEnum.PROMPT_ID.name(),
                textPrompt.getTaskName(),
                instituteId);

        deepSeekAsyncTaskService.pollAndProcessTextToQuestions(taskStatus, textPrompt, model);

        return ResponseEntity.ok(Map.of(
                "taskId", taskStatus.getId(),
                "status", "STARTED",
                "model", model,
                "message", "Question generation started from text"));
    }

    // ==================== Helper Methods ====================

    private void validateNonHtmlFile(MultipartFile file) {
        if (HtmlParsingUtils.isHtmlContentType(file.getContentType())) {
            throw FileConversionException.invalidFormat("PDF, DOCX, or image files");
        }
    }

    private AIManualEvaluationQuestionPaperResponse createManualEvaluationResponse(
            AIManualEvaluationQuestionPaperRequest request,
            String aiJsonResponse) {

        try {
            AIManualEvaluationQuestionPaperResponse response = objectMapper.readValue(
                    aiJsonResponse,
                    new TypeReference<AIManualEvaluationQuestionPaperResponse>() {
                    });
            response.setHtmlQuestion(request.getHtmlQuestion());
            response.setTotalMarks(request.getTotalMarks());
            return response;
        } catch (IOException e) {
            log.error("Failed to parse manual evaluation response: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to process evaluation response", e);
        }
    }
}
