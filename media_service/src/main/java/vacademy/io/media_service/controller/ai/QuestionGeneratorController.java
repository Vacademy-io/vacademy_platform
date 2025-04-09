package vacademy.io.media_service.controller.ai;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.ai.DeepSeekService;
import vacademy.io.media_service.dto.*;
import vacademy.io.media_service.service.*;
import vacademy.io.media_service.util.JsonUtils;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.zwobble.mammoth.internal.util.Base64Encoding.streamToBase64;


@RestController
@RequestMapping("/media-service/ai/get-question")
public class QuestionGeneratorController {

    @Autowired
    HtmlImageConverter htmlImageConverter;
    @Autowired
    DeepSeekService deepSeekService;
    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private FileService fileService;

    @Autowired
    private DocConverterService docConverterService;

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

    @PostMapping("/from-html")
    public ResponseEntity<AutoQuestionPaperResponse> fromHtml(
            @RequestParam("file") MultipartFile file) {

        // Check if the uploaded file is HTML
        if (!isHtmlFile(file)) {
            throw new VacademyException("Invalid file format. Please upload an HTML file.");
        }

        try {
            String html = new String(file.getBytes(), StandardCharsets.UTF_8);
            String htmlBody = extractBody(html);
            String networkHtml = htmlImageConverter.convertBase64ToUrls(htmlBody);
            String rawOutput = (deepSeekService.getQuestionsWithDeepSeekFromHTML(networkHtml));

            // Process the raw output to get valid JSON
            String validJson = JsonUtils.extractAndSanitizeJson(rawOutput);

            return ResponseEntity.ok(createAutoQuestionPaperResponse(removeExtraSlashes(validJson)));

        } catch (IOException e) {
            throw new VacademyException(e.getMessage());
        }
    }

    @PostMapping("/from-not-html")
    public ResponseEntity<AutoQuestionPaperResponse> fromNotHtml(
            @RequestParam("file") MultipartFile file) {

        // Check if the uploaded file is HTML
        if (isHtmlFile(file)) {
            return fromHtml(file);
        }

        try {
            String html = docConverterService.convertDocument(file);
            String htmlBody = extractBody(html);
            String networkHtml = htmlImageConverter.convertBase64ToUrls(htmlBody);
            String rawOutput = (deepSeekService.getQuestionsWithDeepSeekFromHTML(networkHtml));

            // Process the raw output to get valid JSON
            String validJson = JsonUtils.extractAndSanitizeJson(rawOutput);

            return ResponseEntity.ok(createAutoQuestionPaperResponse(removeExtraSlashes(validJson)));

        } catch (IOException e) {
            throw new VacademyException(e.getMessage());
        }
    }

    @PostMapping("/math-parser/from-not-html")
    public ResponseEntity<AutoDocumentSubmitResponse> fromNotHtmlMathParser(
            @RequestParam("file") MultipartFile file) {

        if (isHtmlFile(file)) {
            throw new VacademyException("Invalid file format. Please do not upload an HTML file.");
        }

        try {
            String publicUrl = fileService.uploadFile(file);
            if (!StringUtils.hasText(publicUrl)) {
                throw new VacademyException("Error uploading file");
            }
            String pdfId = newDocConverterService.startProcessing(publicUrl);
            if (!StringUtils.hasText(pdfId)) {
                throw new VacademyException("Error processing file");
            }

            return ResponseEntity.ok(new AutoDocumentSubmitResponse(pdfId));

        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }


    @GetMapping("/math-parser/pdf-to-html")
    public ResponseEntity<PdfHtmlResponseStatusResponse> getMathParserPdfHtml(@RequestParam String pdfId) throws IOException {
        String html = newDocConverterService.getConvertedHtml(pdfId);
        String htmlBody = extractBody(html);
        String networkHtml = htmlImageConverter.convertBase64ToUrls(htmlBody);

        return ResponseEntity.ok(new PdfHtmlResponseStatusResponse(networkHtml));
    }


    @PostMapping("/from-text")
    public ResponseEntity<AutoQuestionPaperResponse> fromHtml(
            @RequestBody TextDTO textPrompt) {

        String rawOutput = (deepSeekService.getQuestionsWithDeepSeekFromTextPrompt(textPrompt.getText(), textPrompt.getNum().toString(), textPrompt.getQuestionType(), textPrompt.getClassLevel(), textPrompt.getTopics(), textPrompt.getQuestionLanguage()));

        // Process the raw output to get valid JSON
        String validJson = JsonUtils.extractAndSanitizeJson(rawOutput);

        return ResponseEntity.ok(createAutoQuestionPaperResponse(removeExtraSlashes(validJson)));
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

}
