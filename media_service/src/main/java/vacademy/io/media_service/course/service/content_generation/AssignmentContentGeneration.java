package vacademy.io.media_service.course.service.content_generation;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.constant.ConstantAiTemplate;
import vacademy.io.media_service.course.enums.SlideTypeEnums;
import vacademy.io.media_service.course.service.OpenRouterService;
import vacademy.io.media_service.enums.TaskStatusTypeEnum;
import vacademy.io.media_service.service.HtmlJsonProcessor;
import vacademy.io.media_service.util.JsonUtils;

import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Slf4j
@Component
public class AssignmentContentGeneration extends IContentGenerationStrategy{

    @Autowired
    private OpenRouterService openRouterService;

    @Autowired
    private ObjectMapper objectMapper;


    @Override
    public Mono<String> generateContent(String prompt, String slideType, String slidePath, String actionType, String title) {
        try {
            setSlideType(SlideTypeEnums.ASSESSMENT.name());
            setSuccess(true);


            HtmlJsonProcessor htmlJsonProcessor = new HtmlJsonProcessor();
            String unTaggedHtml = htmlJsonProcessor.removeTags(prompt);

            String template = ConstantAiTemplate.getTemplateBasedOnType(TaskStatusTypeEnum.PROMPT_TO_QUESTIONS);

            Map<String, Object> promptMap = Map.of("textPrompt", prompt,
                    "title", title);
            Prompt newPrompt = new PromptTemplate(template).create(promptMap);

            return openRouterService.streamAnswer(newPrompt.getContents().trim(), "google/gemini-2.5-flash-lite-preview-06-17") // Streams chunks from the content AI
                    .collect(Collectors.joining()) // Aggregates all chunks into a single String
                    .map(generatedContent -> formatSlideContentUpdate(slidePath, slideType, actionType, generatedContent,title)) // Format as a client-friendly JSON update
                    .doOnError(e -> log.error("Error during AI call for slide content {}: {}", slidePath, e.getMessage())) // Log specific AI call errors
                    .onErrorResume(e -> {
                        return Mono.just(formatErrorSlideContentUpdate(slidePath, slideType, actionType, e.getMessage()));
                    });

        } catch (Exception e) {
            setSlideType(SlideTypeEnums.ASSESSMENT.name());
            setSuccess(false);
            return Mono.just(formatErrorSlideContentUpdate(slidePath,slideType,actionType,e.getMessage()));
        }
    }
    private String formatErrorSlideContentUpdate(String slidePath, String slideType, String actionType, String errorMessage) {
        ObjectNode errorUpdate = objectMapper.createObjectNode();
        errorUpdate.put("type", "SLIDE_CONTENT_ERROR"); // Event type for client
        errorUpdate.put("path", slidePath);
        errorUpdate.put("status", false);
        errorUpdate.put("actionType", actionType);
        errorUpdate.put("slideType", slideType);
        errorUpdate.put("errorMessage", "Failed to generate content: " + errorMessage);
        errorUpdate.put("contentData", "Error generating content for this slide. Please try again or contact support."); // User-friendly message
        return errorUpdate.toString();
    }

    private String formatSlideContentUpdate(String slidePath, String slideType, String actionType, String content, String title) {

        String validJson = JsonUtils.extractAndSanitizeJson(Objects.requireNonNull(content));

        ObjectNode contentUpdate = objectMapper.createObjectNode();
        contentUpdate.put("type", "SLIDE_CONTENT_UPDATE");
        contentUpdate.put("path", slidePath);
        contentUpdate.put("status", true);
        contentUpdate.put("title", title);
        contentUpdate.put("actionType", actionType);
        contentUpdate.put("slideType", slideType);

        try {
            JsonNode contentDetails = objectMapper.readTree(validJson);
            contentUpdate.set("contentData", contentDetails);
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse YouTube content JSON for slide {}: {}", slidePath, e.getMessage());
            contentUpdate.put("contentData", content); // fallback
        }

        return contentUpdate.toString();
    }
}
