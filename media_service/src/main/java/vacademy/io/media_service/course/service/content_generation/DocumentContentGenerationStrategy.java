package vacademy.io.media_service.course.service.content_generation;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import vacademy.io.media_service.course.enums.SlideTypeEnums;
import vacademy.io.media_service.course.service.OpenRouterService;

import java.util.stream.Collectors;

@Slf4j
@Component
public class DocumentContentGenerationStrategy extends IContentGenerationStrategy {

    @Autowired
    private OpenRouterService openRouterService;

    @Autowired
    private ObjectMapper objectMapper;

    @Override
    public Mono<String> generateContent(String prompt, String slideType, String slidePath, String actionType, String title) {
        try{
            setSlideType("DOCUMENT");
            setSuccess(true);

            return openRouterService.streamAnswer(prompt, "google/gemini-2.5-flash-preview-05-20") // Streams chunks from the content AI
                    .collect(Collectors.joining()) // Aggregates all chunks into a single String
                    .map(generatedContent -> formatSlideContentUpdate(slidePath, slideType, actionType, generatedContent)) // Format as a client-friendly JSON update
                    .doOnError(e -> log.error("Error during AI call for slide content {}: {}", slidePath, e.getMessage())) // Log specific AI call errors
                    .onErrorResume(e -> {
                        return Mono.just(formatErrorSlideContentUpdate(slidePath, slideType, actionType, e.getMessage()));
                    });
        } catch (Exception e) {
            setSlideType(SlideTypeEnums.DOCUMENT.name());
            setSuccess(false);
            return Mono.just(e.getMessage());
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

    private String formatSlideContentUpdate(String slidePath, String slideType, String actionType, String generatedContent) {
        ObjectNode contentUpdate = objectMapper.createObjectNode();
        contentUpdate.put("type", "SLIDE_CONTENT_UPDATE"); // Event type for client
        contentUpdate.put("path", slidePath);
        contentUpdate.put("status", true);
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
}
