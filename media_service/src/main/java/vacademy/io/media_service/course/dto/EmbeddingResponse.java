package vacademy.io.media_service.course.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class EmbeddingResponse {
    private Embedding embedding;

    @Getter
    @Setter
    public static class Embedding {
        private List<Float> values;
    }
}
