package vacademy.io.admin_core_service.features.course.dto;

import lombok.Data;
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
