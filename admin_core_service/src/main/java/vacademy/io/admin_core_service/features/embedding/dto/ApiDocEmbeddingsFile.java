package vacademy.io.admin_core_service.features.embedding.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApiDocEmbeddingsFile {

    private String version;
    private String sourceFile;
    private String createdAt;
    private String model;
    private int totalApis;
    private List<ApiEmbedding> embeddings;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ApiEmbedding {
        private String apiName;
        private String toolName;
        private String description;
        private String endpoint;
        private String content; // Full API documentation chunk
        private List<Double> embedding;
        private int dimensions;
    }
}
