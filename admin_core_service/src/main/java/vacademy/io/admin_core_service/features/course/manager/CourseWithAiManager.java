package vacademy.io.admin_core_service.features.course.manager;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import vacademy.io.admin_core_service.features.course.constant.CoursePromptTemplate;
import vacademy.io.admin_core_service.features.course.dto.CourseUserPrompt;
import vacademy.io.admin_core_service.features.course.service.EmbeddingService;
import vacademy.io.admin_core_service.features.course.service.MerkelHashService;
import vacademy.io.admin_core_service.features.course.service.OpenRouterService;



import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Component
public class CourseWithAiManager {

    private final OpenRouterService openRouterService;
    private final EmbeddingService embeddingService;
    private final MerkelHashService merkelHashService;

    public CourseWithAiManager(OpenRouterService openRouterService, EmbeddingService embeddingService, MerkelHashService merkelHashService) {
        this.openRouterService = openRouterService;
        this.embeddingService = embeddingService;
        this.merkelHashService = merkelHashService;
    }

    /**
     * Generates a course outline by streaming a response from the AI service.
     * @return A Flux<String> that emits content chunks as they are received.
     */
    public Flux<String> generateCourseWithAi(String instituteId, CourseUserPrompt courseUserPrompt) throws JsonProcessingException {
        String userPrompt = courseUserPrompt.getUserPrompt();

        String courseTree = courseUserPrompt.getCourseTree();
        String globalHash = merkelHashService.generateMerkleHash(courseTree);

        String pathHashString = "";
        String JsonContext = "";

        if(courseUserPrompt.getCourseTree()!=null){
            JsonContext = injectSlideVectors(courseUserPrompt.getCourseTree());
            JsonNode courseTreeJson = new ObjectMapper().readTree(courseTree);
            Map<String, String> pathHashes = merkelHashService.generatePathWiseHashes(courseTreeJson);
            pathHashString = pathHashes.entrySet().stream()
                    .map(e -> e.getKey() + " → " + e.getValue())
                    .collect(Collectors.joining("\n"));
        }


        Map<String, Object> promptMap = Map.of(
                "userPrompt", userPrompt,
//                "context", context,
                "merkleHash", globalHash,
                "merkleMap", pathHashString
//                "existingCourse", JsonContext
        );

        String finalPrompt = applyTemplateVariables(CoursePromptTemplate.getGenerateCourseWithAiTemplate(), promptMap);
        return openRouterService.streamAnswer(finalPrompt);
    }

    public static String applyTemplateVariables(String template, Map<String, Object> promptMap) {
        for (Map.Entry<String, Object> entry : promptMap.entrySet()) {
            String placeholder = "{{" + entry.getKey() + "}}";
            String value = String.valueOf(entry.getValue());
            template = template.replace(placeholder, value);
        }
        return template;
    }

    public String injectSlideVectors(String json) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(json);

            ArrayNode tree = (ArrayNode) root.get("tree");
            for (JsonNode subject : tree) {
                for (JsonNode module : subject.get("modules")) {
                    for (JsonNode chapter : module.get("chapters")) {
                        for (JsonNode slide : chapter.get("slides")) {
                            String slideName = slide.get("name").asText();
                            String content = slide.has("content") ? slide.get("content").asText() : "";

                            // generate vector with slide name and content
                            List<Float> vector = embeddingService.generateVectorEmbedding(slideName, content);

                            // inject vector into the slide node
                            ((ObjectNode) slide).putPOJO("vector_content", vector);
                        }
                    }
                }
            }

            return mapper.writerWithDefaultPrettyPrinter().writeValueAsString(root);
        } catch (Exception e) {
            log.error("Failed To Inject vector content: {}", e.getMessage());
            return json;
        }
    }

}
