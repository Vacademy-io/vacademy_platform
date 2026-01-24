package vacademy.io.admin_core_service.features.embedding.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApiDocEmbeddingRequest {

    @Builder.Default
    private String model = "qwen/qwen3-embedding-8b";

    @Builder.Default
    private String encodingFormat = "float";

    // If true, regenerate embeddings even if the file already exists
    @Builder.Default
    private boolean forceRegenerate = false;
}
