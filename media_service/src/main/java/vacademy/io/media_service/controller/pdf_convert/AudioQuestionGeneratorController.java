package vacademy.io.media_service.controller.pdf_convert;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.util.ObjectUtils;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.media.dto.FileDetailsDTO;
import vacademy.io.media_service.ai.DeepSeekService;
import vacademy.io.media_service.dto.*;
import vacademy.io.media_service.service.*;
import vacademy.io.media_service.util.JsonUtils;

import java.io.IOException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;


@RestController
@RequestMapping("/media-service/ai/get-question-audio")
public class AudioQuestionGeneratorController {

    @Autowired
    HtmlImageConverter htmlImageConverter;
    @Autowired
    DeepSeekService deepSeekService;
    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private FileService fileService;

    @Autowired
    private FileConversionStatusService fileConversionStatusService;

    @Autowired
    private NewAudioConverterService newAudioConverterService;

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


    @PostMapping("/audio-parser/start-process-audio")
    public ResponseEntity<AutoDocumentSubmitResponse> startProcessPdf(@RequestParam("file") MultipartFile file) {

        try {
            FileDetailsDTO fileDetailsDTO = fileService.uploadFileWithDetails(file);
            if (ObjectUtils.isEmpty(fileDetailsDTO) || !StringUtils.hasText(fileDetailsDTO.getUrl())) {
                throw new VacademyException("Error uploading file");
            }
            String pdfId = newAudioConverterService.startProcessing(fileDetailsDTO.getUrl());
            if (!StringUtils.hasText(pdfId)) {
                throw new VacademyException("Error processing file");
            }
            fileConversionStatusService.startProcessing(pdfId, "assemblyai", fileDetailsDTO.getId());

            return ResponseEntity.ok(new AutoDocumentSubmitResponse(pdfId));

        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }


    @PostMapping("/audio-parser/start-process-audio-file-id")
    public ResponseEntity<AutoDocumentSubmitResponse> startProcessPdf(@RequestBody FileIdSubmitRequest file) {

        try {
            var fileDetailsDTOs = fileService.getMultipleFileDetailsWithExpiryAndId(file.getFileId(), 7);
            if (ObjectUtils.isEmpty(fileDetailsDTOs) || fileDetailsDTOs.isEmpty()) {
                throw new VacademyException("Error uploading file");
            }
            String pdfId = newAudioConverterService.startProcessing(fileDetailsDTOs.get(0).getUrl());
            if (!StringUtils.hasText(pdfId)) {
                throw new VacademyException("Error processing file");
            }
            fileConversionStatusService.startProcessing(pdfId, "assemblyai", fileDetailsDTOs.get(0).getId());

            return ResponseEntity.ok(new AutoDocumentSubmitResponse(pdfId));

        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }


    @GetMapping("/audio-parser/audio-to-questions")
    public ResponseEntity<AutoQuestionPaperResponse> getMathParserPdfHtml(@RequestParam String audioId, @RequestParam(required = false) String numQuestions, @RequestParam(required = false) String prompt, @RequestParam(required = false) String difficulty, @RequestParam(required = false) String language) throws IOException {

        if (difficulty == null) {
            difficulty = "hard and medium";
        }

        if (numQuestions == null) {
            numQuestions = "20";
        }

        if (prompt == null) {
            prompt = "";
        }

        if(language == null) {
            language = "english";
        }

        var fileConversionStatus = fileConversionStatusService.findByVendorFileId(audioId);

        if (fileConversionStatus.isEmpty() || !StringUtils.hasText(fileConversionStatus.get().getHtmlText())) {
            String convertedText = newAudioConverterService.getConvertedAudio(audioId);
            if (convertedText == null) {
                throw new VacademyException("File Still Processing");
            }


            fileConversionStatusService.updateHtmlText(audioId, convertedText);
            String rawOutput = (deepSeekService.getQuestionsWithDeepSeekFromAudio(convertedText, numQuestions, prompt, difficulty, language));

            // Process the raw output to get valid JSON
            String validJson = JsonUtils.extractAndSanitizeJson(rawOutput);

            return ResponseEntity.ok(createAutoQuestionPaperResponse(removeExtraSlashes(validJson)));
        }

        String rawOutput = (deepSeekService.getQuestionsWithDeepSeekFromAudio(fileConversionStatus.get().getHtmlText(), numQuestions, prompt, difficulty, language));

        // Process the raw output to get valid JSON
        String validJson = JsonUtils.extractAndSanitizeJson(rawOutput);
        return ResponseEntity.ok(createAutoQuestionPaperResponse(removeExtraSlashes(validJson)));
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
