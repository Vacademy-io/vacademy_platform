package vacademy.io.media_service.course.manager;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.publisher.SignalType;
import vacademy.io.media_service.course.constant.CoursePromptTemplate;
import vacademy.io.media_service.course.dto.CourseUserPrompt;
import vacademy.io.media_service.course.service.EmbeddingService;
import vacademy.io.media_service.course.service.MerkelHashService;
import vacademy.io.media_service.course.service.OpenRouterService;
import vacademy.io.media_service.course.service.content_generation.ContentGenerationFactory;
import vacademy.io.media_service.util.JsonUtils;

import java.util.List;
import java.util.Map;
import java.util.Spliterators;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

@Slf4j
@Component
public class CourseWithAiManager {

    private final OpenRouterService openRouterService;
    private final EmbeddingService embeddingService;
    private final MerkelHashService merkelHashService;
    private final ObjectMapper objectMapper;
    private final ContentGenerationFactory contentGenerationFactory;

    public CourseWithAiManager(OpenRouterService openRouterService, EmbeddingService embeddingService, MerkelHashService merkelHashService, ObjectMapper objectMapper, ContentGenerationFactory contentGenerationFactory) {
        this.openRouterService = openRouterService;
        this.embeddingService = embeddingService;
        this.merkelHashService = merkelHashService;
        this.objectMapper = objectMapper;
        this.contentGenerationFactory = contentGenerationFactory;
    }

    /**
     * Generates a course outline by streaming a response from the AI service,
     * then processes todos for content generation and streams those results.
     * The overall process is streamed as Server-Sent Events (SSE).
     *
     * @param instituteId      The ID of the institute.
     * @param courseUserPrompt The user's prompt and existing course data.
     * @param model
     * @return A Flux<String> that emits structural JSON chunks, followed by content update JSONs.
     */
    public Flux<String> generateCourseWithAi(String instituteId, CourseUserPrompt courseUserPrompt, String model) {
        log.info("Start streaming course generation for instituteId: {}", instituteId);

        String userPrompt = courseUserPrompt.getUserPrompt();
        String existingCourseJson = courseUserPrompt.getCourseTree();

        Map<String, Object> promptContext = preparePromptContext(existingCourseJson, userPrompt);
        String finalPrompt = applyTemplateVariables(CoursePromptTemplate.getGenerateCourseWithAiTemplate(), promptContext);

        Flux<String> aiStream = openRouterService.streamAnswer(finalPrompt, model)
                .doOnSubscribe(sub -> log.info("Subscribed to AI streaming response"));

        // Shared stream for both:
        Flux<String> cachedAiStream = aiStream.cache(); // Important to cache for multi-subscriber reuse

        Flux<String> contentGenerationFlux = cachedAiStream
                .reduce(new StringBuilder(), StringBuilder::append)
                .map(StringBuilder::toString)
                .flatMapMany(fullJson -> {
                    try {
                        return processAiStructuralResponse(fullJson);
                    } catch (Exception e) {
                        log.error("Error extracting or processing structural response: {}", e.getMessage(), e);
                        return Flux.error(new RuntimeException("Structure parse failed", e));
                    }
                })
                .doOnComplete(() -> log.info("Post-stream content generation completed"))
                .doOnError(e -> log.error("Content generation failed: {}", e.getMessage(), e));

        // Merge both: 1) the raw stream and 2) content generation from todos
        return Flux.merge(cachedAiStream, contentGenerationFlux);
    }


    /**
     * Prepares the map of variables to inject into the AI prompt template.
     * Handles parsing existing course JSON, generating Merkle hashes, and injecting slide vectors.
     *
     * @param existingCourseJson The JSON string of the existing course tree. Can be null or empty.
     * @param userPrompt         The user's prompt.
     * @return A map of prompt variables, ensuring all keys are present, even if values are empty.
     */
    private Map<String, Object> preparePromptContext(String existingCourseJson, String userPrompt) {
        String globalHash = "";
        String pathHashString = "";
        String existingCourseJsonContext = "";

        if (existingCourseJson != null && !existingCourseJson.isEmpty()) {
            try {
                JsonNode courseTreeJson = objectMapper.readTree(existingCourseJson);
                globalHash = merkelHashService.generateMerkleHash(existingCourseJson);
                Map<String, String> pathHashes = merkelHashService.generatePathWiseHashes(courseTreeJson);
                pathHashString = pathHashes.entrySet().stream()
                        .map(e -> e.getKey() + " → " + e.getValue())
                        .collect(Collectors.joining("\n"));
                existingCourseJsonContext = injectSlideVectors(existingCourseJson); // This should inject into a *copy* or be careful with mutation
                log.info("Existing course context prepared: globalHash={}, numPathHashes={}", globalHash, pathHashes.size());
            } catch (JsonProcessingException e) {
                log.warn("Failed to parse existing course JSON for context. Proceeding without it: {}", e.getMessage());
            } catch (Exception e) {
                log.error("An unexpected error occurred while preparing existing course context: {}", e.getMessage(), e);
            }
        } else {
            log.info("No existing course provided. Building a new course from scratch.");
        }

        // Use Map.of for immutability and conciseness
        return Map.of(
                "userPrompt", userPrompt,
                "merkleHash", globalHash,
                "merkleMap", pathHashString,
                "existingCourse", existingCourseJsonContext
        );
    }

    /**
     * Processes the complete structural JSON response from the AI.
     * This method emits the full structural JSON first, then extracts "todos" and initiates
     * concurrent content generation for each, streaming their results.
     *
     * @param fullStructuralJson The complete JSON string generated by the AI.
     * @return A Flux<String> that starts with the full structural JSON, followed by content updates for todos.
     */
    private Flux<String> processAiStructuralResponse(String fullStructuralJson) {
        try {
            String validJson = JsonUtils.extractFinalJsonBlock(fullStructuralJson);
            JsonNode rootNode = objectMapper.readTree(validJson);
            JsonNode todosNode = rootNode.get("todos");

            // Always emit the full structural JSON as the first event for the client
            Flux<String> structuralUpdateFlux = Flux.just(fullStructuralJson)
                    .doOnSubscribe(s -> log.info("Emitting the complete structural JSON response to client."));

            // If there are "todos", process them for content generation
            if (todosNode != null && todosNode.isArray() && todosNode.size() > 0) {
                log.info("Found {} 'todo' items in AI structural response. Initiating content generation.", todosNode.size());

                List<Mono<String>> contentGenerationMonos = StreamSupport.stream(
                                Spliterators.spliteratorUnknownSize(todosNode.elements(), 0), false)
                        .map(this::processSingleTodoForContent) // Create a Mono for each todo
                        .collect(Collectors.toList());

                // Merge all content generation Monos to run them in parallel.
                // The order of completion for these will be non-deterministic.
                Flux<String> contentUpdatesFlux = Flux.merge(contentGenerationMonos)
                        .doOnComplete(() -> log.info("All 'todo' content generation tasks have completed."));

                // Concatenate the structural flux with the content updates flux
                return structuralUpdateFlux.concatWith(contentUpdatesFlux);
            } else {
                log.info("No 'todo' items found in AI structural response. Content generation phase skipped.");
                return structuralUpdateFlux; // No todos, just emit the structural JSON
            }
        } catch (JsonProcessingException e) {
            log.error("Failed to parse full structural JSON response from AI: {}", e.getMessage(), e);
            // If parsing fails, emit the raw response and then an error to signal failure
            return Flux.just(fullStructuralJson)
                    .concatWith(Flux.error(new RuntimeException("Error parsing AI structural response: " + e.getMessage(), e)));
        } catch (Exception e) {
            log.error("An unexpected error occurred during AI structural response processing: {}", e.getMessage(), e);
            return Flux.error(new RuntimeException("Unexpected error during AI response processing: " + e.getMessage(), e));
        }
    }

    /**
     * Processes a single 'todo' JSON node to initiate content generation for a slide.
     * This method adds specific logging around the content generation for each slide.
     *
     * @param todoNode The JSON node representing a single todo item from the AI response.
     * @return A Mono<String> that resolves to the formatted JSON string of the generated slide content.
     */
    private Mono<String> processSingleTodoForContent(JsonNode todoNode) {
        String todoName = todoNode.get("name").asText();
        String slideType = todoNode.get("type").asText();
        String slidePath = todoNode.get("path").asText();
        String actionType = todoNode.get("actionType").asText();
        String contentPrompt = todoNode.get("prompt").asText();
        String title = todoNode.get("title").asText();
        int order = todoNode.has("order") ? todoNode.get("order").asInt() : -1; // Default to -1 if order is missing

        log.debug("Preparing content generation for todo item {}: '{}' (Path: {})", order, todoName, slidePath);

        // Use Mono.defer to ensure the log.info for "Starting" runs exactly when this Mono is subscribed to.
        return Mono.defer(() -> {
            log.info("Initiating content generation for slide: {} (Type: {}, Action: {})", slidePath, slideType, actionType);
            return generateSlideContent(slidePath, slideType, contentPrompt, actionType, title)
                    // Log completion or error for this specific content generation task
                    .doFinally(signalType -> {
                        if (signalType.equals(SignalType.ON_COMPLETE)) {
                            log.info("Successfully completed content generation for slide: {}", slidePath);
                        } else if (signalType.equals(SignalType.ON_ERROR)) {
                            log.error("Failed content generation for slide: {}", slidePath);
                        }
                    });
        });
    }

    /**
     * Generates content for a single slide by making a call to the external AI service.
     * Handles potential errors from the AI service and formats the response.
     *
     * @param slidePath     The unique identifier path for the slide.
     * @param slideType     The type of content to generate (e.g., "DOCUMENT", "YOUTUBE").
     * @param contentPrompt The specific prompt for the AI to generate this slide's content.
     * @param actionType    The action to perform (e.g., "ADD", "UPDATE").
     * @param title
     * @return A Mono<String> emitting a JSON string containing the generated slide content or an error message.
     */
    private Mono<String> generateSlideContent(String slidePath, String slideType, String contentPrompt, String actionType, String title) {
        return contentGenerationFactory.getContentBasedOnType(slideType,actionType,slidePath,contentPrompt,title);
    }

    /**
     * Formats the generated slide content into a standardized JSON string for client updates.
     * This JSON is designed to be consumed by the frontend to update specific slides.
     *
     * @param slidePath        The path of the slide.
     * @param slideType        The type of the slide (e.g., "DOCUMENT", "YOUTUBE").
     * @param actionType       The action to be performed (e.g., "ADD", "UPDATE").
     * @param generatedContent The content generated by the AI for the slide.
     * @return A JSON string representing the slide content update event.
     */
    private String formatSlideContentUpdate(String slidePath, String slideType, String actionType, String generatedContent) {
        ObjectNode contentUpdate = objectMapper.createObjectNode();
        contentUpdate.put("type", "SLIDE_CONTENT_UPDATE"); // Event type for client
        contentUpdate.put("path", slidePath);
        contentUpdate.put("actionType", actionType);
        contentUpdate.put("slideType", slideType);

        if ("DOCUMENT".equalsIgnoreCase(slideType)) {
            contentUpdate.put("contentData", generatedContent);
        } else if ("YOUTUBE".equalsIgnoreCase(slideType)) {
            try {
                // Assuming YouTube content generation provides a JSON with video details
                JsonNode youtubeDetails = objectMapper.readTree(generatedContent);
                contentUpdate.set("youtubeDetails", youtubeDetails);
            } catch (JsonProcessingException e) {
                log.warn("Failed to parse YouTube content JSON for slide {}. Storing raw string: {}", slidePath, e.getMessage());
                contentUpdate.put("contentData", generatedContent); // Fallback if parsing fails
            }
        } else {
            log.warn("Unknown slide type '{}' for slide {}. Storing raw contentData.", slideType, slidePath);
            contentUpdate.put("contentData", generatedContent); // Generic fallback for unknown types
        }
        return contentUpdate.toString();
    }

    /**
     * Creates an error message formatted as a slide content update event.
     * This allows the client to display an error for a specific slide without breaking the stream.
     *
     * @param slidePath    The path of the slide where the error occurred.
     * @param slideType    The type of the slide.
     * @param actionType   The action attempted.
     * @param errorMessage The detailed error message.
     * @return A JSON string representing a slide content error event.
     */
    private String formatErrorSlideContentUpdate(String slidePath, String slideType, String actionType, String errorMessage) {
        ObjectNode errorUpdate = objectMapper.createObjectNode();
        errorUpdate.put("type", "SLIDE_CONTENT_ERROR"); // Event type for client
        errorUpdate.put("path", slidePath);
        errorUpdate.put("actionType", actionType);
        errorUpdate.put("slideType", slideType);
        errorUpdate.put("errorMessage", "Failed to generate content: " + errorMessage);
        errorUpdate.put("contentData", "Error generating content for this slide. Please try again or contact support."); // User-friendly message
        return errorUpdate.toString();
    }

    /**
     * Applies template variables from a map to a given string template.
     * Placeholders in the template are expected in the format {{key}}.
     *
     * @param template  The template string with placeholders.
     * @param promptMap A map where keys correspond to placeholder names and values are their replacements.
     * @return The template string with all placeholders replaced by their respective values.
     */
    public static String applyTemplateVariables(String template, Map<String, Object> promptMap) {
        String result = template;
        for (Map.Entry<String, Object> entry : promptMap.entrySet()) {
            String placeholder = "{{" + entry.getKey() + "}}";
            String value = (entry.getValue() != null) ? String.valueOf(entry.getValue()) : "";
            result = result.replace(placeholder, value);
        }
        return result;
    }

    /**
     * Injects content vectors into the 'SLIDE' nodes of an existing course JSON tree.
     * This method traverses the tree recursively to find all slides.
     *
     * @param json The JSON string of the course tree.
     * @return The JSON string with 'vector_content' added to slide nodes, or the original JSON if processing fails.
     */
    public String injectSlideVectors(String json) {
        try {
            JsonNode root = objectMapper.readTree(json);

            if (root.has("tree") && root.get("tree").isArray()) {
                processNodesForVectors((ArrayNode) root.get("tree"));
            } else {
                log.warn("Existing course JSON does not contain a 'tree' array at the root for vector injection.");
            }

            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(root);
        } catch (JsonProcessingException e) {
            log.error("Failed to parse JSON for vector injection: {}", e.getMessage(), e);
            return json; // Return original JSON if parsing fails
        } catch (Exception e) {
            log.error("An unexpected error occurred during vector injection: {}", e.getMessage(), e);
            return json; // Return original JSON on other errors
        }
    }

    /**
     * Recursive helper method to traverse JSON nodes and inject vectors into 'SLIDE' nodes.
     * It checks for nodes with a "key" field equal to "SLIDE".
     *
     * @param nodes An ArrayNode containing JSON objects (e.g., subjects, modules, chapters, or slides).
     */
    private void processNodesForVectors(ArrayNode nodes) {
        for (JsonNode node : nodes) {
            if (node.isObject()) {
                ObjectNode objNode = (ObjectNode) node;

                // Check if this is a 'SLIDE' node
                if (objNode.has("key") && "SLIDE".equals(objNode.get("key").asText())) {
                    String slideName = objNode.has("name") ? objNode.get("name").asText() : "";
                    // Use 'contentData' as per your DTO structure
                    String contentData = objNode.has("contentData") ? objNode.get("contentData").asText() : "";

                    if (!slideName.isEmpty() || !contentData.isEmpty()) {
                        try {
                            List<Float> vector = embeddingService.generateVectorEmbedding(slideName, contentData);
                            objNode.putPOJO("vector_content", vector);
                        } catch (Exception e) {
                            log.error("Failed to generate vector for slide '{}': {}", slideName, e.getMessage());
                            // Continue processing other slides, don't stop the overall vector injection
                        }
                    }
                }

                // Recursively process any nested ArrayNodes (e.g., 'modules', 'chapters', 'slides' themselves)
                objNode.fields().forEachRemaining(entry -> {
                    if (entry.getValue().isArray()) {
                        processNodesForVectors((ArrayNode) entry.getValue());
                    }
                });
            }
        }
    }

}