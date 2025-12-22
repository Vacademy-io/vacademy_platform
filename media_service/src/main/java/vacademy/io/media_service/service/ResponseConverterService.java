package vacademy.io.media_service.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.media_service.ai.ExternalAIApiService;
import vacademy.io.media_service.dto.AiGeneratedQuestionPaperJsonDto;
import vacademy.io.media_service.dto.AutoQuestionPaperResponse;
import vacademy.io.media_service.dto.lecture.LectureFeedbackDto;
import vacademy.io.media_service.dto.lecture.LecturePlanDto;
import vacademy.io.media_service.exception.AiProcessingException;
import vacademy.io.media_service.util.HtmlParsingUtils;
import vacademy.io.media_service.util.JsonUtils;

/**
 * Service for converting AI responses to structured DTOs.
 * Consolidates duplicate response conversion logic.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ResponseConverterService {

    private final ObjectMapper objectMapper;
    private final ExternalAIApiService externalAIApiService;

    /**
     * Converts AI JSON response to AutoQuestionPaperResponse.
     *
     * @param jsonResponse The raw JSON response from AI
     * @return Structured AutoQuestionPaperResponse
     */
    public AutoQuestionPaperResponse convertToQuestionPaperResponse(String jsonResponse) {
        if (jsonResponse == null || jsonResponse.isEmpty()) {
            return new AutoQuestionPaperResponse();
        }

        try {
            String validJson = JsonUtils.extractAndSanitizeJson(jsonResponse);
            String cleanedJson = tryUnwrapQuotedJson(validJson);
            String processedJson = HtmlParsingUtils.removeExtraSlashes(cleanedJson);

            AiGeneratedQuestionPaperJsonDto response = objectMapper.readValue(
                    processedJson,
                    new TypeReference<AiGeneratedQuestionPaperJsonDto>() {
                    });

            AutoQuestionPaperResponse result = new AutoQuestionPaperResponse();
            result.setQuestions(externalAIApiService.formatQuestions(response.getQuestions()));
            result.setTitle(response.getTitle());
            result.setTags(response.getTags());
            result.setClasses(response.getClasses());
            result.setSubjects(response.getSubjects());
            result.setDifficulty(response.getDifficulty());

            return result;
        } catch (Exception e) {
            log.error("Failed to convert question paper response: {}", e.getMessage(), e);
            throw new AiProcessingException(
                    "RESPONSE_CONVERSION_ERROR",
                    "Failed to process AI response. Please try again.",
                    "Response conversion failed: " + e.getMessage(),
                    e);
        }
    }

    /**
     * Converts AI JSON response to LecturePlanDto.
     *
     * @param jsonResponse The raw JSON response from AI
     * @return Structured LecturePlanDto
     */
    public LecturePlanDto convertToLecturePlanDto(String jsonResponse) {
        if (jsonResponse == null || jsonResponse.isEmpty()) {
            return new LecturePlanDto();
        }

        try {
            String validJson = JsonUtils.extractAndSanitizeJson(jsonResponse);
            return objectMapper.readValue(validJson, LecturePlanDto.class);
        } catch (Exception e) {
            log.error("Failed to convert lecture plan response: {}", e.getMessage(), e);
            throw new AiProcessingException(
                    "RESPONSE_CONVERSION_ERROR",
                    "Failed to process lecture plan. Please try again.",
                    "Lecture plan conversion failed: " + e.getMessage(),
                    e);
        }
    }

    /**
     * Converts AI JSON response to LectureFeedbackDto.
     *
     * @param jsonResponse The raw JSON response from AI
     * @return Structured LectureFeedbackDto
     */
    public LectureFeedbackDto convertToLectureFeedbackDto(String jsonResponse) {
        if (jsonResponse == null || jsonResponse.isEmpty()) {
            return new LectureFeedbackDto();
        }

        try {
            String validJson = JsonUtils.extractAndSanitizeJson(jsonResponse);
            return objectMapper.readValue(validJson, LectureFeedbackDto.class);
        } catch (Exception e) {
            log.error("Failed to convert lecture feedback response: {}", e.getMessage(), e);
            throw new AiProcessingException(
                    "RESPONSE_CONVERSION_ERROR",
                    "Failed to process lecture feedback. Please try again.",
                    "Lecture feedback conversion failed: " + e.getMessage(),
                    e);
        }
    }

    /**
     * Tries to unwrap JSON that might be double-encoded or wrapped in quotes.
     */
    private String tryUnwrapQuotedJson(String json) {
        try {
            JsonNode node = objectMapper.readTree(json);
            if (node.isTextual()) {
                String inner = node.textValue();
                String trimmed = inner.trim()
                        .replaceFirst("(?is)^```json\\s*", "")
                        .replaceFirst("(?s)```$", "");
                return JsonUtils.extractAndSanitizeJson(trimmed);
            }
            return json;
        } catch (Exception ex) {
            // Fallback manual unescape
            String s = json.trim()
                    .replaceFirst("(?is)^```json\\s*", "")
                    .replaceFirst("(?s)```$", "");
            if (s.startsWith("\"") && s.endsWith("\"")) {
                s = s.substring(1, s.length() - 1);
            }
            s = s.replace("\\\"", "\"")
                    .replace("\\n", "\n")
                    .replace("\\t", "\t")
                    .replace("\\/", "/");
            try {
                return JsonUtils.extractAndSanitizeJson(s);
            } catch (Exception ignored) {
                return s;
            }
        }
    }
}
