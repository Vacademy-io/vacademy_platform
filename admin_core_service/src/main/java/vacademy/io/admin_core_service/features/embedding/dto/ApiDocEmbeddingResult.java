package vacademy.io.admin_core_service.features.embedding.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApiDocEmbeddingResult {

    private String filePath;
    private int totalApis;
    private int embeddingsGenerated;
    private LocalDateTime timestamp;
    private String status;
    private List<ApiChunkInfo> chunks;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ApiChunkInfo {
        private String apiName;
        private String toolName;
        private int embeddingDimensions;
        private int textLength;
    }
}
