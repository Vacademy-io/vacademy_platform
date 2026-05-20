package vacademy.io.media_service.service;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.json.JsonReadFeature;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.media_service.ai.ExternalAIApiService;
import vacademy.io.media_service.dto.AiGeneratedQuestionJsonDto;
import vacademy.io.media_service.dto.AiGeneratedQuestionPaperJsonDto;
import vacademy.io.media_service.dto.AutoQuestionPaperResponse;
import vacademy.io.media_service.dto.lecture.LectureFeedbackDto;
import vacademy.io.media_service.dto.lecture.LecturePlanDto;
import vacademy.io.media_service.exception.AiProcessingException;
import vacademy.io.media_service.util.HtmlParsingUtils;
import vacademy.io.media_service.util.JsonUtils;

import java.util.ArrayList;
import java.util.List;

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
     * Private mapper used only for LLM response parsing. Kept separate from the
     * shared Spring-managed {@link ObjectMapper} so the lenient features below do
     * not affect strict client-payload validation elsewhere in the service.
     */
    private final ObjectMapper lenientMapper = new ObjectMapper()
            .configure(JsonReadFeature.ALLOW_TRAILING_COMMA.mappedFeature(), true)
            .configure(JsonReadFeature.ALLOW_NON_NUMERIC_NUMBERS.mappedFeature(), true)
            .configure(JsonParser.Feature.ALLOW_SINGLE_QUOTES, true)
            .configure(JsonParser.Feature.ALLOW_UNQUOTED_FIELD_NAMES, true)
            .configure(JsonReadFeature.ALLOW_BACKSLASH_ESCAPING_ANY_CHARACTER.mappedFeature(), true)
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

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

        // Top-level JSON parse failure preserves the original behavior: throw
        // AiProcessingException. TaskStatusManager catches and returns an empty
        // response; the synchronous controllers let it surface as 5xx so the
        // frontend's existing error-toast / retry interceptors keep working.
        JsonNode root;
        try {
            String validJson = JsonUtils.extractAndSanitizeJson(jsonResponse);
            String cleanedJson = tryUnwrapQuotedJson(validJson);
            root = lenientMapper.readTree(cleanedJson);
        } catch (Exception e) {
            log.error("Failed to parse question paper response: {}", e.getMessage(), e);
            throw new AiProcessingException(
                    "RESPONSE_CONVERSION_ERROR",
                    "Failed to process AI response. Please try again.",
                    "Response conversion failed: " + e.getMessage(),
                    e);
        }

        // If the parsed tree is not an object (e.g. a top-level array, a literal
        // value, or null), fall through to the original strict behavior: throw,
        // so the controller layer surfaces the same error it did before.
        if (root == null || !root.isObject()) {
            throw new AiProcessingException(
                    "RESPONSE_CONVERSION_ERROR",
                    "Failed to process AI response. Please try again.",
                    "Response is not a JSON object");
        }

        AutoQuestionPaperResponse result = new AutoQuestionPaperResponse();

        // Metadata: isolate parse so a malformed tag/subject field doesn't kill the response
        try {
            AiGeneratedQuestionPaperJsonDto metadata = lenientMapper.treeToValue(
                    withoutQuestions(root), AiGeneratedQuestionPaperJsonDto.class);
            if (metadata != null) {
                result.setTitle(metadata.getTitle());
                result.setTags(metadata.getTags());
                result.setClasses(metadata.getClasses());
                result.setSubjects(metadata.getSubjects());
                result.setDifficulty(metadata.getDifficulty());
            }
        } catch (Exception e) {
            log.warn("Failed to parse question paper metadata; continuing with questions only: {}",
                    e.getMessage());
        }

        // Questions: lenient per-element parse, then resilient per-element formatting
        try {
            List<AiGeneratedQuestionJsonDto> validQuestions = parseQuestionsLeniently(root.get("questions"));
            result.setQuestions(externalAIApiService.formatQuestions(
                    validQuestions.toArray(new AiGeneratedQuestionJsonDto[0])));
        } catch (Exception e) {
            log.error("Failed to format questions: {}", e.getMessage(), e);
            result.setQuestions(new ArrayList<>());
        }

        return result;
    }

    private JsonNode withoutQuestions(JsonNode root) {
        if (root == null || !root.isObject()) {
            return objectMapper.createObjectNode();
        }
        return ((com.fasterxml.jackson.databind.node.ObjectNode) root.deepCopy()).without("questions");
    }

    private List<AiGeneratedQuestionJsonDto> parseQuestionsLeniently(JsonNode questionsNode) {
        List<AiGeneratedQuestionJsonDto> parsed = new ArrayList<>();
        if (questionsNode == null || !questionsNode.isArray()) {
            return parsed;
        }
        int index = 0;
        for (JsonNode questionNode : questionsNode) {
            index++;
            try {
                AiGeneratedQuestionJsonDto dto = lenientMapper.treeToValue(
                        questionNode, AiGeneratedQuestionJsonDto.class);
                if (dto != null && dto.getQuestion() != null
                        && dto.getQuestion().getContent() != null
                        && dto.getQuestionType() != null) {
                    parsed.add(dto);
                } else {
                    log.warn("Skipping malformed question at index {}: missing required fields", index);
                }
            } catch (Exception e) {
                log.warn("Skipping malformed question at index {}: {}", index, e.getMessage());
            }
        }
        return parsed;
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
