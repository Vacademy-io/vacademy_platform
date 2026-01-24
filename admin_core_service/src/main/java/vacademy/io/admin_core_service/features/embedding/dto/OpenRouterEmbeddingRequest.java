package vacademy.io.admin_core_service.features.embedding.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OpenRouterEmbeddingRequest {

    private String model;

    private String input;

    @JsonProperty("encoding_format")
    private String encodingFormat;
}
