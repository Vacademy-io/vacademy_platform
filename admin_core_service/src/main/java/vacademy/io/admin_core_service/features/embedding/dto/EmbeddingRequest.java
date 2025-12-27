package vacademy.io.admin_core_service.features.embedding.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotBlank;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmbeddingRequest {

    @NotBlank(message = "Text input is required")
    private String text;

    @Builder.Default
    private String model = "qwen/qwen3-embedding-8b";

    @Builder.Default
    private String encodingFormat = "float";
}
