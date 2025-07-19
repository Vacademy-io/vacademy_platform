package vacademy.io.media_service.course.manager;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import reactor.core.Disposable;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.publisher.SignalType;
import reactor.core.publisher.Sinks;
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
import java.util.UUID;
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
    private final ActiveCourseGenerationManager activeCourseGenerationManager;

    public CourseWithAiManager(OpenRouterService openRouterService, EmbeddingService embeddingService, MerkelHashService merkelHashService, ObjectMapper objectMapper, ContentGenerationFactory contentGenerationFactory, ActiveCourseGenerationManager activeCourseGenerationManager) {
        this.openRouterService = openRouterService;
        this.embeddingService = embeddingService;
        this.merkelHashService = merkelHashService;
        this.objectMapper = objectMapper;
        this.contentGenerationFactory = contentGenerationFactory;
        this.activeCourseGenerationManager = activeCourseGenerationManager;
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
        String requestId = UUID.randomUUID().toString(); // 🔑 unique ID

        // 1. Build prompt
        String userPrompt = courseUserPrompt.getUserPrompt();
        String existingCourseJson = courseUserPrompt.getCourseTree();
        Map<String, Object> promptContext = preparePromptContext(existingCourseJson, userPrompt);
        String finalPrompt = applyTemplateVariables(CoursePromptTemplate.getGenerateCourseWithAiTemplate(), promptContext);

        // 2. Create stream
        Flux<String> aiStream = openRouterService.streamAnswer(finalPrompt, model)
                .doOnSubscribe(sub -> log.info("Subscribed to AI streaming response for {}", requestId));

        Sinks.Many<String> sink = Sinks.many().multicast().onBackpressureBuffer();
        Disposable disposable = aiStream
                .doOnError(sink::tryEmitError)
                .doOnComplete(sink::tryEmitComplete)
                .subscribe(sink::tryEmitNext);

        // Register sink and disposable for force-stopping
        activeCourseGenerationManager.register(requestId, disposable, sink);

        Flux<String> cachedAiStream = sink.asFlux();

        Flux<String> contentGenerationFlux = cachedAiStream
                .reduce(new StringBuilder(), StringBuilder::append)
                .map(StringBuilder::toString)
                .flatMapMany(this::processAiStructuralResponse);

        // Initial JSON metadata to be sent as the first SSE event
        String metadataJson = "```json {{\"requestId\": \"" + requestId + "\"}}```";

        // Final SSE stream
        return Flux.concat(
                Flux.just(metadataJson),
                Flux.merge(cachedAiStream, contentGenerationFlux)
        ).doFinally(signal -> activeCourseGenerationManager.cancel(requestId));
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
            String validJson = JsonUtils.extractAndSanitizeFinalJsonBlock(fullStructuralJson);
            JsonNode rootNode = objectMapper.readTree(validJson);
            JsonNode todosNode = rootNode.get("todos");

            // Emit full structural response first
            Flux<String> structuralUpdateFlux = Flux.just(fullStructuralJson)
                    .doOnSubscribe(s -> log.info("Emitting the complete structural JSON response to client."));

            if (todosNode != null && todosNode.isArray() && todosNode.size() > 0) {
                log.info("Found {} 'todo' items in AI structural response. Initiating content generation.", todosNode.size());

                List<Mono<String>> contentGenerationMonos = StreamSupport.stream(
                                Spliterators.spliteratorUnknownSize(todosNode.elements(), 0), false)
                        .map(this::processSingleTodoForContent)
                        .collect(Collectors.toList());

                return Flux.merge(contentGenerationMonos)
                        .doOnComplete(() -> log.info("All 'todo' content generation tasks have completed."))
                        .startWith(structuralUpdateFlux);
            } else {
                log.info("No 'todo' items found in AI structural response. Content generation phase skipped.");
                return structuralUpdateFlux;
            }
        } catch (Exception e) {
            log.error("Exception in AI structural response processing: {}", e.getMessage(), e);

            // Return fallback dummy JSON if any exception occurs
            ObjectNode dummyJson = objectMapper.createObjectNode();
            dummyJson.put("explanation", "");
            dummyJson.set("todos", objectMapper.createArrayNode());

            try {
                String fallbackJson = objectMapper.writeValueAsString(dummyJson);
                return Flux.just(fallbackJson);
            } catch (JsonProcessingException jpe) {
                log.error("Failed to serialize fallback dummy JSON: {}", jpe.getMessage(), jpe);
                // As last resort, return minimal hardcoded string
                return Flux.just("{\"explanation\":\"\",\"todos\":[]}");
            }
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

    public ResponseEntity<String> forceStopAiResponse(String generationId) {
        boolean stopped = activeCourseGenerationManager.cancel(generationId);
        if (stopped) {
            return ResponseEntity.ok("Streaming stopped for requestId: " + generationId);
        } else {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("No active stream with requestId: " + generationId);
        }
    }

    public ResponseEntity<String> getCourseStructure(String courseId, String instituteId) {
        return ResponseEntity.ok("Done");
    }
}