package vacademy.io.media_service.controller.pdf_convert;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.util.ObjectUtils;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.media.dto.FileDetailsDTO;
import vacademy.io.media_service.ai.ExternalAIApiService;
import vacademy.io.media_service.dto.*;
import vacademy.io.media_service.entity.TaskStatus;
import vacademy.io.media_service.enums.TaskInputTypeEnum;
import vacademy.io.media_service.enums.TaskStatusTypeEnum;
import vacademy.io.media_service.service.*;
import vacademy.io.media_service.util.JsonUtils;

import java.io.IOException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;


@Slf4j
@RestController
@RequestMapping("/media-service/ai/get-question-pdf")
public class PDFQuestionGeneratorController {

    @Autowired
    HtmlImageConverter htmlImageConverter;
    @Autowired
    ExternalAIApiService deepSeekService;
    @Autowired
    TaskStatusService taskStatusService;
    @Autowired
    DeepSeekAsyncTaskService deepSeekAsyncTaskService;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private FileService fileService;
    @Autowired
    private FileConversionStatusService fileConversionStatusService;
    @Autowired
    private NewDocConverterService newDocConverterService;

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

    public static String extractBody(String html) {
        if (html == null || html.isEmpty()) {
            return "";
        }

        // Regex to match the content between <body> and </body> tags
        Pattern pattern = Pattern.compile(
                "<body[^>]*>(.*?)</body>",
                Pattern.CASE_INSENSITIVE | Pattern.DOTALL // Handle case and multi-line content
        );

        Matcher matcher = pattern.matcher(html);
        if (matcher.find()) {
            // Extract the content (group 1) between the tags
            return matcher.group(1).trim(); // Trim to remove leading/trailing whitespace
        } else {
            return html;
        }
    }


    @PostMapping("/math-parser/start-process-pdf")
    public ResponseEntity<AutoDocumentSubmitResponse> startProcessPdf(
            @RequestParam("file") MultipartFile file) {

        if (isHtmlFile(file)) {
            throw new VacademyException("Invalid file format. Please do not upload an HTML file.");
        }

        try {
            FileDetailsDTO fileDetailsDTO = fileService.uploadFileWithDetails(file);
            if (ObjectUtils.isEmpty(fileDetailsDTO) || !StringUtils.hasText(fileDetailsDTO.getUrl())) {
                throw new VacademyException("Error uploading file");
            }
            String pdfId = newDocConverterService.startProcessing(fileDetailsDTO.getUrl());
            if (!StringUtils.hasText(pdfId)) {
                throw new VacademyException("Error processing file");
            }
            fileConversionStatusService.startProcessing(pdfId, "mathpix", fileDetailsDTO.getId());

            return ResponseEntity.ok(new AutoDocumentSubmitResponse(pdfId));

        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }


    @PostMapping("/math-parser/start-process-pdf-file-id")
    public ResponseEntity<AutoDocumentSubmitResponse> startProcessPdf(
            @RequestBody FileIdSubmitRequest file) {

        try {
            var fileDetailsDTOs = fileService.getMultipleFileDetailsWithExpiryAndId(file.getFileId(), 7);
            if (ObjectUtils.isEmpty(fileDetailsDTOs) || fileDetailsDTOs.isEmpty()) {
                throw new VacademyException("Error uploading file");
            }
            String pdfId = newDocConverterService.startProcessing(fileDetailsDTOs.get(0).getUrl());
            if (!StringUtils.hasText(pdfId)) {
                throw new VacademyException("Error processing file");
            }
            fileConversionStatusService.startProcessing(pdfId, "mathpix", fileDetailsDTOs.get(0).getId());

            return ResponseEntity.ok(new AutoDocumentSubmitResponse(pdfId));

        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }


    @GetMapping("/math-parser/pdf-to-questions")
    public ResponseEntity<String> getMathParserPdfHtml(@RequestParam String pdfId,
                                                       @RequestParam(required = false) String userPrompt,
                                                       @RequestParam(name = "taskId", required = false) String taskId,
                                                       @RequestParam(name = "taskName", required = false) String taskName,
                                                       @RequestParam(name = "instituteId", required = false) String instituteId) throws IOException {

        TaskStatus taskStatus = taskStatusService.updateTaskStatusOrCreateNewTask(taskId, TaskStatusTypeEnum.PDF_TO_QUESTIONS.name(), pdfId, TaskInputTypeEnum.PDF_ID.name(), taskName, instituteId);

        // Background async processing
        deepSeekAsyncTaskService.pollAndProcessPdfToQuestions(taskStatus, pdfId, userPrompt);

        return ResponseEntity.ok(taskStatus.getId());
    }

    @GetMapping("/math-parser/image-to-questions")
    public ResponseEntity<String> getMathParserPdfHtmlFromImage(@RequestParam String pdfId,
                                                                @RequestParam(required = false) String userPrompt,
                                                                @RequestParam(name = "taskId", required = false) String taskId,
                                                                @RequestParam(name = "taskName", required = false) String taskName,
                                                                @RequestParam(name = "instituteId", required = false) String instituteId) throws IOException {

        TaskStatus taskStatus = taskStatusService.updateTaskStatusOrCreateNewTask(taskId, TaskStatusTypeEnum.IMAGE_TO_QUESTIONS.name(), pdfId, TaskInputTypeEnum.IMAGE_ID.name(), taskName, instituteId);

        // Background async processing
        deepSeekAsyncTaskService.pollAndProcessPdfToQuestions(taskStatus, pdfId, userPrompt);

        return ResponseEntity.ok(taskStatus.getId());
    }

    @GetMapping("/math-parser/topic-wise/pdf-to-questions")
    public ResponseEntity<String> getMathParserPdfWithTopicHtml(@RequestParam String pdfId, @RequestParam(required = false) String userPrompt,
                                                                @RequestParam("instituteId") String instituteId,
                                                                @RequestParam("taskName") String taskName) throws IOException {

        TaskStatus taskStatus = taskStatusService.updateTaskStatusOrCreateNewTask(null, TaskStatusTypeEnum.SORT_QUESTIONS_TOPIC_WISE.name(), pdfId, TaskInputTypeEnum.PDF_ID.name(), taskName, instituteId);

        // Background async processing
        deepSeekAsyncTaskService.pollAndProcessSortQuestionTopicWise(taskStatus, pdfId);
        return ResponseEntity.ok(taskStatus.getId());
    }

    @PostMapping("/math-parser/html-to-questions")
    public ResponseEntity<AutoQuestionPaperResponse> getMathParserHtmlToQuestions(@RequestBody HtmlResponse html, @RequestParam(required = false) String userPrompt) throws IOException {


        String rawOutput = (deepSeekService.getQuestionsWithDeepSeekFromHTML(html.getHtml(), userPrompt));

        String validJson = JsonUtils.extractAndSanitizeJson(rawOutput);
        return ResponseEntity.ok(createAutoQuestionPaperResponse(removeExtraSlashes(validJson)));
    }


    @GetMapping("/math-parser/pdf-to-html")
    public ResponseEntity<HtmlResponse> getMathParserPdfToHtml(@RequestParam String pdfId) throws IOException {

        var fileConversionStatus = fileConversionStatusService.findByVendorFileId(pdfId);

        if (fileConversionStatus.isEmpty() || !StringUtils.hasText(fileConversionStatus.get().getHtmlText())) {
            String html = newDocConverterService.getConvertedHtml(pdfId);
            if (html == null) {
                throw new VacademyException("File Still Processing");
            }
            String htmlBody = extractBody(html);
            String networkHtml = htmlImageConverter.convertBase64ToUrls(htmlBody);

            fileConversionStatusService.updateHtmlText(pdfId, networkHtml);

            return ResponseEntity.ok(new HtmlResponse(networkHtml));
        }

        return ResponseEntity.ok(new HtmlResponse(fileConversionStatus.get().getHtmlText()));
    }

    @GetMapping("/math-parser/pdf-to-extract-topic-questions")
    public ResponseEntity<String> getMathParserPdfTopicQuestions(@RequestParam String pdfId, @RequestParam String requiredTopics,
                                                                 @RequestParam(name = "taskId", required = false) String taskId,
                                                                 @RequestParam(name = "taskName", required = false) String taskName,
                                                                 @RequestParam(name = "instituteId", required = false) String instituteId) throws IOException {


        TaskStatus taskStatus = taskStatusService.updateTaskStatusOrCreateNewTask(taskId, TaskStatusTypeEnum.PDF_TO_QUESTIONS_WITH_TOPIC.name(), pdfId, TaskInputTypeEnum.PDF_ID.name(), taskName, instituteId);

        deepSeekAsyncTaskService.pollAndProcessPdfExtractTopicQuestions(taskStatus, pdfId, requiredTopics);

        return ResponseEntity.ok(taskStatus.getId());

    }


    @PostMapping("/math-parser/check-manual-answer")
    public ResponseEntity<AIManualEvaluationQuestionPaperResponse> getEvaluationForQuestions(@RequestParam String pdfId, @RequestBody AIManualEvaluationQuestionPaperRequest aiManualEvaluationQuestionPaperRequest) throws IOException {

        if (aiManualEvaluationQuestionPaperRequest == null) {
            throw new VacademyException("Please provide request body");
        }

        if (aiManualEvaluationQuestionPaperRequest.getTotalMarks() == null) {
            aiManualEvaluationQuestionPaperRequest.setTotalMarks(100D);
        }

        if (aiManualEvaluationQuestionPaperRequest.getEvaluationDifficulty() == null) {
            aiManualEvaluationQuestionPaperRequest.setEvaluationDifficulty("hard and medium");
        }

        var fileConversionStatus = fileConversionStatusService.findByVendorFileId(pdfId);

        if (fileConversionStatus.isEmpty() || !StringUtils.hasText(fileConversionStatus.get().getHtmlText())) {
            String html = newDocConverterService.getConvertedHtml(pdfId);
            if (html == null) {
                throw new VacademyException("File Still Processing");
            }
            String htmlBody = extractBody(html);
            String networkHtml = htmlImageConverter.convertBase64ToUrls(htmlBody);

            fileConversionStatusService.updateHtmlText(pdfId, networkHtml);
            String rawOutput = (deepSeekService.evaluateManualAnswerSheet(networkHtml, aiManualEvaluationQuestionPaperRequest.getHtmlQuestion(), aiManualEvaluationQuestionPaperRequest.getTotalMarks(), aiManualEvaluationQuestionPaperRequest.getEvaluationDifficulty()));

            // Process the raw output to get valid JSON
            String validJson = JsonUtils.extractAndSanitizeJson(rawOutput);

            return ResponseEntity.ok(createManualEvaluationPaperResponse(aiManualEvaluationQuestionPaperRequest, removeExtraSlashes(validJson)));
        }

        String rawOutput = (deepSeekService.evaluateManualAnswerSheet(fileConversionStatus.get().getHtmlText(), aiManualEvaluationQuestionPaperRequest.getHtmlQuestion(), aiManualEvaluationQuestionPaperRequest.getTotalMarks(), aiManualEvaluationQuestionPaperRequest.getEvaluationDifficulty()));

        // Process the raw output to get valid JSON
        String validJson = JsonUtils.extractAndSanitizeJson(rawOutput);
        return ResponseEntity.ok(createManualEvaluationPaperResponse(aiManualEvaluationQuestionPaperRequest, removeExtraSlashes(validJson)));
    }


    @PostMapping("/from-text")
    public ResponseEntity<String> fromHtml(
            @RequestBody TextDTO textPrompt,
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "taskId", required = false) String taskId) {
        TaskStatus taskStatus = taskStatusService.updateTaskStatusOrCreateNewTask(taskId, TaskStatusTypeEnum.TEXT_TO_QUESTIONS.name(), deepSeekAsyncTaskService.generateUniqueId(textPrompt.getText()), TaskInputTypeEnum.PROMPT_ID.name(), textPrompt.getTaskName(), instituteId);

        deepSeekAsyncTaskService.pollAndProcessTextToQuestions(taskStatus, textPrompt);
        return ResponseEntity.ok(taskStatus.getId());
    }

    private boolean isHtmlFile(MultipartFile file) {
        return "text/html".equals(file.getContentType());
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

    public AIManualEvaluationQuestionPaperResponse createManualEvaluationPaperResponse(AIManualEvaluationQuestionPaperRequest manualEvaluationQuestionPaperRequest, String aiJsonResponse) {
        AutoQuestionPaperResponse autoQuestionPaperResponse = new AutoQuestionPaperResponse();
        ObjectMapper objectMapper = new ObjectMapper();

        try {
            AIManualEvaluationQuestionPaperResponse response = objectMapper.readValue(aiJsonResponse, new TypeReference<AIManualEvaluationQuestionPaperResponse>() {
            });
            response.setHtmlQuestion(manualEvaluationQuestionPaperRequest.getHtmlQuestion());
            response.setTotalMarks(manualEvaluationQuestionPaperRequest.getTotalMarks());
            return response;
        } catch (IOException e) {
            throw new VacademyException(e.getMessage());
        }


    }


}
