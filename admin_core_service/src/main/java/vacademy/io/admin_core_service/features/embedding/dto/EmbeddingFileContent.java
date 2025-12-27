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
public class EmbeddingFileContent {

    private String id;
    private String model;
    private String originalText;
    private List<Double> embedding;
    private int dimensions;
    private String createdAt;
    private EmbeddingResponse.Usage usage;
}
