package vacademy.io.media_service.course.service.content_generation;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import reactor.core.publisher.Mono;

@AllArgsConstructor
@NoArgsConstructor
public abstract class IContentGenerationStrategy {

    @Getter
    @Setter
    public String slideType;

    @Getter
    @Setter
    public Boolean success;

    public abstract Mono<String> generateContent(String prompt, String slideType, String slidePath, String actionType, String title);
}
