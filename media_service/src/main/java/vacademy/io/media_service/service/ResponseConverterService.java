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
            String processedJson = cleanedJson;

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
        if (json == null)
            return null;
        json = json.trim();

        // 1. Remove wrapping ```json ... ``` or just ``` ... ```
        if (json.startsWith("```")) {
            json = json.replaceFirst("(?is)^```([a-z]*)?\\s*", "");
            json = json.replaceFirst("(?s)\\s*```$", "");
            json = json.trim();
        }

        // 2. If it starts with a quote, it MIGHT be a JSON string that *contains* the
        // JSON we want.
        // We use Jackson to parse the string literal which handles standard JSON
        // escaping (\", \n, etc.) automatically.
        if (json.startsWith("\"") && json.endsWith("\"")) {
            try {
                JsonNode node = objectMapper.readTree(json);
                if (node.isTextual()) {
                    String inner = node.textValue();
                    return tryUnwrapQuotedJson(inner);
                }
            } catch (Exception e) {
                // If Jackson fails (e.g. malformed escape), we might try a manual fallback
                // OR just proceed if we think it's actually an Object but happened to star/end
                // with quotes (rare but possible in malformed data).
                // For now, let's try a very basic manual unwrap if Jackson failed,
                // assuming it might be a weirdly formatted string.
                if (json.length() > 2) {
                    // Check if it looks like a JSON object inside even if Jackson failed to parse
                    // it as a string
                    // e.g. " { ... } " with bad escapes
                    String potentialJson = json.substring(1, json.length() - 1);
                    // If the inner part looks like an object/array, return that
                    String trimmedInner = potentialJson.trim();
                    if ((trimmedInner.startsWith("{") && trimmedInner.endsWith("}")) ||
                            (trimmedInner.startsWith("[") && trimmedInner.endsWith("]"))) {
                        // Attempt to unescape manually common chars
                        return trimmedInner.replace("\\\"", "\"")
                                .replace("\\\\", "\\")
                                .replace("\\n", "\n")
                                .replace("\\t", "\t");
                    }
                }
            }
        }

        // 3. Final sanity check: does it look like start of an object or array?
        // If not, and it still has random chars, we might want to try finding the first
        // '{' or '['
        int startObj = json.indexOf('{');
        int startArr = json.indexOf('[');

        int start = -1;
        if (startObj != -1 && startArr != -1) {
            start = Math.min(startObj, startArr);
        } else if (startObj != -1) {
            start = startObj;
        } else if (startArr != -1) {
            start = startArr;
        }

        if (start > 0) {
            // There is some garbage prefix before the actual JSON
            json = json.substring(start);
            // Verify end as well
            int endObj = json.lastIndexOf('}');
            int endArr = json.lastIndexOf(']');
            int end = Math.max(endObj, endArr);
            if (end != -1 && end < json.length() - 1) {
                json = json.substring(0, end + 1);
            }
        } else if (start == 0) {
            // Verify end as well
            int endObj = json.lastIndexOf('}');
            int endArr = json.lastIndexOf(']');
            int end = Math.max(endObj, endArr);
            if (end != -1 && end < json.length() - 1) {
                json = json.substring(0, end + 1);
            }
        }

        return json;
    }
}
