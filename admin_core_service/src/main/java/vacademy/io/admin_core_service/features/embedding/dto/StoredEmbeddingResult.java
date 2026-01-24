package vacademy.io.admin_core_service.features.embedding.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StoredEmbeddingResult {

    private EmbeddingResponse embeddingResponse;
    private String filePath;
    private LocalDateTime timestamp;
}
