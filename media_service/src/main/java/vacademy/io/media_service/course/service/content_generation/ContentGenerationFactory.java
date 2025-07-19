package vacademy.io.media_service.course.service.content_generation;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import vacademy.io.media_service.course.enums.SlideTypeEnums;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;


@Component
public class ContentGenerationFactory {

    private final Map<String, IContentGenerationStrategy> strategies = new HashMap<>();

    @Autowired
    public ContentGenerationFactory(
            DocumentContentGenerationStrategy docStrategy,
            YoutubeContentGenerationStrategy ytStrategy,
            PdfContentGenerationStrategy pdfStrategy,
            ExcaliDrawImageContentGenerationStrategy imageStrategy
    ) {
        strategies.put(SlideTypeEnums.DOCUMENT.name(), docStrategy);
        strategies.put(SlideTypeEnums.VIDEO.name(), ytStrategy);
        strategies.put(SlideTypeEnums.PDF.name(), pdfStrategy);
        strategies.put(SlideTypeEnums.EXCALIDRAW_IMAGE.name(), imageStrategy);
    }

    public IContentGenerationStrategy getStrategy(String slideType) {
        IContentGenerationStrategy strategy = strategies.getOrDefault(slideType, null);
        if (strategy != null) {
            strategy.setSlideType(slideType);
            strategy.setSuccess(false);
        }
        return strategy;
    }

    public Mono<String> getContentBasedOnType(String slideType, String actionType, String path, String prompt, String title) {
        try {
            IContentGenerationStrategy strategy = getStrategy(slideType);
            return strategy.generateContent(prompt, slideType, path, actionType, title);
        } catch (Exception e) {
            return Mono.just("Failed To Generate");
        }
    }
}

