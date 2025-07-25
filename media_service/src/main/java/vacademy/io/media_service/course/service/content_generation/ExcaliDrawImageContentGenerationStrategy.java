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

@Slf4j
@Component
public class ExcaliDrawImageContentGenerationStrategy extends IContentGenerationStrategy{

    @Autowired
    private UnsplashApiClient unsplashApiClient;

    @Autowired
    private ObjectMapper objectMapper;

    @Override
    public Mono<String> generateContent(String prompt, String slideType, String slidePath, String actionType, String title) {
        try {
            setSuccess(true);
            setSlideType(SlideTypeEnums.EXCALIDRAW_IMAGE.name());

            return unsplashApiClient.getUnsplashContent(title)
                    .map(imageContent -> formatSlideContentUpdate(slidePath, slideType, actionType, ExcalidrawGenerator.createExcalidrawClipboardData(imageContent,title), title))
                    .doOnError(e -> log.error("Error during YouTube content generation for {}: {}", slidePath, e.getMessage()))
                    .onErrorResume(e -> {
                        setSuccess(false);
                        return Mono.just(formatErrorSlideContentUpdate(slidePath, slideType, actionType, e.getMessage(), title));
                    });
        } catch (Exception e) {
            setSuccess(false);
            setSlideType(SlideTypeEnums.EXCALIDRAW_IMAGE.name());
            return Mono.just(formatErrorSlideContentUpdate(slidePath, slideType, actionType, e.getMessage(), title));
        }
    }

    private String formatSlideContentUpdate(String slidePath, String slideType, String actionType, String imageContent, String title) {
        ObjectNode contentUpdate = objectMapper.createObjectNode();
        contentUpdate.put("type", "SLIDE_CONTENT_UPDATE");
        contentUpdate.put("path", slidePath);
        contentUpdate.put("status", true);
        contentUpdate.put("title", title);
        contentUpdate.put("actionType", actionType);
        contentUpdate.put("slideType", slideType);

        try {
            JsonNode imageDetails = objectMapper.readTree(imageContent);
            contentUpdate.set("contentData", imageDetails);
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse Image content JSON for slide {}: {}", slidePath, e.getMessage());
            contentUpdate.put("contentData", imageContent); // fallback
        }

        return contentUpdate.toString();
    }

    private String formatErrorSlideContentUpdate(String slidePath, String slideType, String actionType, String errorMessage, String title) {
        ObjectNode errorUpdate = objectMapper.createObjectNode();
        errorUpdate.put("type", "SLIDE_CONTENT_ERROR");
        errorUpdate.put("path", slidePath);
        errorUpdate.put("title", title);
        errorUpdate.put("status", false);
        errorUpdate.put("actionType", actionType);
        errorUpdate.put("slideType", slideType);
        errorUpdate.put("errorMessage", "Failed to generate content: " + errorMessage);
        errorUpdate.put("contentData", "Error generating Image content. Please try again later.");
        return errorUpdate.toString();
    }
}
