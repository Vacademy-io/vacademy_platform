package vacademy.io.media_service.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Verifies {@link ExternalAIApiService#cleanInvalidQuestionsFromJson} always
 * produces parseable JSON, never corrupts a clean payload, and never throws.
 *
 * Instantiates the service directly (no Spring context) so the test runs
 * without a DB.
 */
class ExternalAIApiServiceCleanJsonTest {

    private ExternalAIApiService service;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() throws Exception {
        objectMapper = new ObjectMapper();
        service = new ExternalAIApiService(null);
        Field f = ExternalAIApiService.class.getDeclaredField("objectMapper");
        f.setAccessible(true);
        f.set(service, objectMapper);
    }

    @Test
    void cleanedJson_isAlwaysParseable_andDropsUnrepairableQuestions() throws Exception {
        String input = "{"
                + "\"title\":\"Polynomials\","
                + "\"questions\":["
                + "  {"
                + "    \"question_number\":\"1\","
                + "    \"question\":{\"type\":\"HTML\",\"content\":\"Q1?\"},"
                + "    \"options\":["
                + "      {\"type\":\"HTML\",\"preview_id\":\"1\",\"content\":\"A\"},"
                + "      {\"type\":\"HTML\",\"preview_id\":\"2\",\"content\":\"B\"}"
                + "    ],"
                + "    \"correct_options\":[\"1\"],"
                + "    \"ans\":\"A\","
                + "    \"exp\":\"because\","
                + "    \"question_type\":\"MCQS\","
                + "    \"level\":\"easy\""
                + "  },"
                + "  {"
                + "    \"question_number\":\"16\","
                + "    \"question\":\"in\","
                + "    \"options\":\"and\","
                + "    \"correct_options\":[\"1\"],"
                + "    \"ans\":\"a=-4, b=12\","
                + "    \"exp\":\"...\","
                + "    \"Strictly\":\"avoid\","
                + "    \"duplicate\":\"content\","
                + "    \"a\":-4.0,"
                + "    \"question_type\":\"MCQS\","
                + "    \"level\":\"hard\""
                + "  }"
                + "]"
                + "}";

        String cleaned = service.cleanInvalidQuestionsFromJson(input);

        JsonNode root = assertDoesNotThrow(() -> objectMapper.readTree(cleaned));
        assertNotNull(root);
        assertTrue(root.isObject());
        assertTrue(root.has("questions"));
        assertTrue(root.get("questions").isArray());

        assertEquals(1, root.get("questions").size(),
                "broken question 16 (options is bare string) must be dropped");
        assertEquals("1", root.get("questions").get(0).get("question_number").asText());

        assertEquals("Polynomials", root.get("title").asText(),
                "top-level metadata must be preserved");
    }

    @Test
    void cleanedJson_isByteIdenticalForValidInput() {
        String input = "{"
                + "\"title\":\"T\","
                + "\"questions\":["
                + "  {"
                + "    \"question_number\":\"1\","
                + "    \"question\":{\"type\":\"HTML\",\"content\":\"Q?\"},"
                + "    \"options\":[{\"type\":\"HTML\",\"preview_id\":\"1\",\"content\":\"A\"}],"
                + "    \"correct_options\":[\"1\"],"
                + "    \"ans\":\"A\","
                + "    \"exp\":\"...\","
                + "    \"question_type\":\"MCQS\","
                + "    \"level\":\"easy\""
                + "  }"
                + "]"
                + "}";

        String cleaned = service.cleanInvalidQuestionsFromJson(input);

        assertEquals(input, cleaned,
                "valid input must pass through unchanged (no format drift)");
    }

    @Test
    void repairWrapsBareStringQuestion() throws Exception {
        String input = "{"
                + "\"questions\":["
                + "  {"
                + "    \"question\":\"What is 2+2?\","
                + "    \"options\":["
                + "      {\"type\":\"HTML\",\"preview_id\":\"1\",\"content\":\"4\"},"
                + "      {\"type\":\"HTML\",\"preview_id\":\"2\",\"content\":\"5\"}"
                + "    ],"
                + "    \"correct_options\":[\"1\"],"
                + "    \"question_type\":\"MCQS\""
                + "  }"
                + "]"
                + "}";

        String cleaned = service.cleanInvalidQuestionsFromJson(input);
        JsonNode root = objectMapper.readTree(cleaned);

        assertEquals(1, root.get("questions").size());
        JsonNode q0 = root.get("questions").get(0);
        assertTrue(q0.get("question").isObject(),
                "bare-string question should have been wrapped to an object");
        assertEquals("HTML", q0.get("question").get("type").asText());
        assertEquals("What is 2+2?", q0.get("question").get("content").asText());
    }

    @Test
    void repairWrapsArrayOfStringOptions() throws Exception {
        String input = "{"
                + "\"questions\":["
                + "  {"
                + "    \"question\":{\"type\":\"HTML\",\"content\":\"Q?\"},"
                + "    \"options\":[\"foo\",\"bar\",\"baz\"],"
                + "    \"correct_options\":[\"1\"],"
                + "    \"question_type\":\"MCQS\""
                + "  }"
                + "]"
                + "}";

        String cleaned = service.cleanInvalidQuestionsFromJson(input);
        JsonNode root = objectMapper.readTree(cleaned);

        JsonNode options = root.get("questions").get(0).get("options");
        assertEquals(3, options.size());
        assertTrue(options.get(0).isObject());
        assertEquals("HTML", options.get(0).get("type").asText());
        assertEquals("foo", options.get(0).get("content").asText());
        assertEquals("1", options.get(0).get("preview_id").asText());
    }

    @Test
    void repairWrapsBareStringCorrectOptions() throws Exception {
        String input = "{"
                + "\"questions\":["
                + "  {"
                + "    \"question\":{\"type\":\"HTML\",\"content\":\"Q?\"},"
                + "    \"options\":[{\"type\":\"HTML\",\"preview_id\":\"1\",\"content\":\"A\"}],"
                + "    \"correct_options\":\"1\","
                + "    \"question_type\":\"MCQS\""
                + "  }"
                + "]"
                + "}";

        String cleaned = service.cleanInvalidQuestionsFromJson(input);
        JsonNode root = objectMapper.readTree(cleaned);

        JsonNode correct = root.get("questions").get(0).get("correct_options");
        assertTrue(correct.isArray());
        assertEquals(1, correct.size());
        assertEquals("1", correct.get(0).asText());
    }

    @Test
    void emptyAndNullInput_returnedUnchanged() {
        assertEquals(null, service.cleanInvalidQuestionsFromJson(null));
        assertEquals("", service.cleanInvalidQuestionsFromJson(""));
    }

    @Test
    void malformedJsonInput_returnedUnchanged_neverThrows() {
        String garbage = "this is not even close to JSON {{{";
        String cleaned = assertDoesNotThrow(
                () -> service.cleanInvalidQuestionsFromJson(garbage));
        assertEquals(garbage, cleaned,
                "on parse failure cleaner must return input unchanged, never throw");
    }
}
