package vacademy.io.media_service.controller.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.batik.transcoder.TranscoderException;
import org.apache.batik.transcoder.TranscoderInput;
import org.apache.batik.transcoder.TranscoderOutput;
import org.apache.batik.transcoder.wmf.tosvg.WMFTranscoder;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.zwobble.mammoth.DocumentConverter;
import org.zwobble.mammoth.Result;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.ai.DeepSeekService;
import vacademy.io.media_service.dto.*;
import vacademy.io.media_service.enums.NumericQuestionTypes;
import vacademy.io.media_service.enums.QuestionResponseType;
import vacademy.io.media_service.enums.QuestionTypes;
import vacademy.io.media_service.service.DocConverterService;
import vacademy.io.media_service.service.EvaluationJsonToMapConverter;
import vacademy.io.media_service.service.HtmlImageConverter;
import vacademy.io.media_service.util.JsonUtils;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
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
    private DocConverterService docConverterService;


    @PostMapping("/from-html")
    public ResponseEntity<String> fromHtml(
            @RequestParam("file") MultipartFile file) {

        // Check if the uploaded file is HTML
        if (!isHtmlFile(file)) {
            throw new VacademyException("Invalid file format. Please upload an HTML file.");
        }

        try {
            String html = new String(file.getBytes(), StandardCharsets.UTF_8);
            String networkHtml = htmlImageConverter.convertBase64ImagesToNetworkImages(html);
            String rawOutput = (deepSeekService.getQuestionsWithDeepSeekFromHTML(networkHtml));

            // Process the raw output to get valid JSON
            String validJson = JsonUtils.extractAndSanitizeJson(rawOutput);

            return ResponseEntity.ok(removeExtraSlashes(validJson));

        } catch (IOException e) {
            throw new VacademyException(e.getMessage());
        }
    }

    @PostMapping("/from-not-html")
    public ResponseEntity<String> fromNotHtml(
            @RequestParam("file") MultipartFile file) {

        // Check if the uploaded file is HTML
        if (isHtmlFile(file)) {
            return fromHtml(file);
        }

        try {
            String html = docConverterService.convertDocument(file);
            String networkHtml = htmlImageConverter.convertBase64ImagesToNetworkImages(html);
            String rawOutput = (deepSeekService.getQuestionsWithDeepSeekFromHTML(networkHtml));

            // Process the raw output to get valid JSON
            String validJson = JsonUtils.extractAndSanitizeJson(rawOutput);

            return ResponseEntity.ok(removeExtraSlashes(validJson));

        } catch (IOException e) {
            throw new VacademyException(e.getMessage());
        }
    }

    @PostMapping("/from-text")
    public ResponseEntity<String> fromHtml(
            @RequestBody TextDTO textPrompt) {

        String rawOutput = (deepSeekService.getQuestionsWithDeepSeekFromTextPrompt(textPrompt.getText(), textPrompt.getNum().toString(), textPrompt.getQuestionType(), textPrompt.getClassLevel(), textPrompt.getTopics()));

        // Process the raw output to get valid JSON
        String validJson = JsonUtils.extractAndSanitizeJson(rawOutput);

        return ResponseEntity.ok(removeExtraSlashes(validJson));
    }

    private boolean isHtmlFile(MultipartFile file) {
        return "text/html".equals(file.getContentType());
    }

    public static String removeExtraSlashes(String input) {
        // Regular expression to match <img src=\"...\"> and replace with <img src="...">
        String regex = "<img src=\\\"(.*?)\\\">";
        String replacement = "<img src=\"$1\">";

        // Compile the pattern and create a matcher
        Pattern pattern = Pattern.compile(regex);
        Matcher matcher = pattern.matcher(input);

        // Replace all occurrences of the pattern with the replacement string
        return matcher.replaceAll(replacement);
    }


}
