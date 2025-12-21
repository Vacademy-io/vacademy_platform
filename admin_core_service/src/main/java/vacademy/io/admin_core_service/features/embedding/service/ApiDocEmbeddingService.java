package vacademy.io.admin_core_service.features.embedding.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.embedding.dto.*;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ApiDocEmbeddingService {

    private static final String API_DOC_FILENAME = "admin_apis_embeddings.json";

    @Value("${embedding.storage.path:./embeddings}")
    private String embeddingStoragePath;

    @Value("${api.docs.path:admin_apis.md}")
    private String apiDocsPath;

    private final EmbeddingService embeddingService;
    private final ObjectMapper objectMapper;

    /**
     * Generate embeddings for the admin_apis.md file and store them
     */
    public ApiDocEmbeddingResult generateApiDocEmbeddings(ApiDocEmbeddingRequest request) {
        log.info("[ApiDocEmbedding] Starting API documentation embedding generation");

        try {
            // Read the admin_apis.md file
            String apiDocContent = readApiDocFile();
            log.info("[ApiDocEmbedding] Read API doc file with {} characters", apiDocContent.length());

            // Parse into individual API chunks
            List<ApiChunk> chunks = parseApiChunks(apiDocContent);
            log.info("[ApiDocEmbedding] Parsed {} API chunks", chunks.size());

            // Check if embeddings file exists and we're not forcing regeneration
            Path embeddingsFilePath = Paths.get(embeddingStoragePath, API_DOC_FILENAME);
            if (Files.exists(embeddingsFilePath) && !request.isForceRegenerate()) {
                log.info("[ApiDocEmbedding] Embeddings file already exists, loading existing data");
                ApiDocEmbeddingsFile existing = loadExistingEmbeddings();
                return ApiDocEmbeddingResult.builder()
                        .filePath(embeddingsFilePath.toAbsolutePath().toString())
                        .totalApis(existing.getTotalApis())
                        .embeddingsGenerated(existing.getEmbeddings().size())
                        .timestamp(LocalDateTime.now())
                        .status("EXISTING")
                        .chunks(existing.getEmbeddings().stream()
                                .map(e -> ApiDocEmbeddingResult.ApiChunkInfo.builder()
                                        .apiName(e.getApiName())
                                        .toolName(e.getToolName())
                                        .embeddingDimensions(e.getDimensions())
                                        .textLength(e.getContent().length())
                                        .build())
                                .toList())
                        .build();
            }

            // Generate embeddings for each chunk
            List<ApiDocEmbeddingsFile.ApiEmbedding> apiEmbeddings = new ArrayList<>();
            List<ApiDocEmbeddingResult.ApiChunkInfo> chunkInfos = new ArrayList<>();

            for (int i = 0; i < chunks.size(); i++) {
                ApiChunk chunk = chunks.get(i);
                log.info("[ApiDocEmbedding] Processing chunk {}/{}: {}", i + 1, chunks.size(), chunk.getApiName());

                try {
                    // Generate embedding for this chunk
                    EmbeddingRequest embeddingRequest = EmbeddingRequest.builder()
                            .text(chunk.getFullContent())
                            .model(request.getModel())
                            .encodingFormat(request.getEncodingFormat())
                            .build();

                    EmbeddingResponse response = embeddingService.generateEmbedding(embeddingRequest);
                    List<Double> embedding = response.getData().get(0).getEmbedding();

                    ApiDocEmbeddingsFile.ApiEmbedding apiEmbedding = ApiDocEmbeddingsFile.ApiEmbedding.builder()
                            .apiName(chunk.getApiName())
                            .toolName(chunk.getToolName())
                            .description(chunk.getDescription())
                            .endpoint(chunk.getEndpoint())
                            .content(chunk.getFullContent())
                            .embedding(embedding)
                            .dimensions(embedding.size())
                            .build();

                    apiEmbeddings.add(apiEmbedding);

                    chunkInfos.add(ApiDocEmbeddingResult.ApiChunkInfo.builder()
                            .apiName(chunk.getApiName())
                            .toolName(chunk.getToolName())
                            .embeddingDimensions(embedding.size())
                            .textLength(chunk.getFullContent().length())
                            .build());

                    // Rate limiting - small delay between API calls
                    if (i < chunks.size() - 1) {
                        Thread.sleep(100);
                    }

                } catch (Exception e) {
                    log.error("[ApiDocEmbedding] Error processing chunk {}: {}", chunk.getApiName(), e.getMessage());
                    // Continue with other chunks
                }
            }

            // Create the embeddings file
            ApiDocEmbeddingsFile embeddingsFile = ApiDocEmbeddingsFile.builder()
                    .version("1.0")
                    .sourceFile(apiDocsPath)
                    .createdAt(LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME))
                    .model(request.getModel())
                    .totalApis(apiEmbeddings.size())
                    .embeddings(apiEmbeddings)
                    .build();

            // Save to file
            String savedPath = saveEmbeddingsFile(embeddingsFile);

            log.info("[ApiDocEmbedding] Successfully generated {} embeddings, saved to: {}",
                    apiEmbeddings.size(), savedPath);

            return ApiDocEmbeddingResult.builder()
                    .filePath(savedPath)
                    .totalApis(chunks.size())
                    .embeddingsGenerated(apiEmbeddings.size())
                    .timestamp(LocalDateTime.now())
                    .status("GENERATED")
                    .chunks(chunkInfos)
                    .build();

        } catch (Exception e) {
            log.error("[ApiDocEmbedding] Error generating API doc embeddings: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to generate API doc embeddings: " + e.getMessage(), e);
        }
    }

    /**
     * Load existing embeddings file
     */
    public ApiDocEmbeddingsFile loadExistingEmbeddings() {
        try {
            Path filePath = Paths.get(embeddingStoragePath, API_DOC_FILENAME);
            if (!Files.exists(filePath)) {
                throw new RuntimeException("Embeddings file not found: " + filePath);
            }
            String content = Files.readString(filePath);
            return objectMapper.readValue(content, ApiDocEmbeddingsFile.class);
        } catch (IOException e) {
            log.error("[ApiDocEmbedding] Error loading embeddings file: {}", e.getMessage());
            throw new RuntimeException("Failed to load embeddings file: " + e.getMessage(), e);
        }
    }

    /**
     * Get embedding for a specific API by name
     */
    public ApiDocEmbeddingsFile.ApiEmbedding getEmbeddingByApiName(String apiName) {
        ApiDocEmbeddingsFile file = loadExistingEmbeddings();
        return file.getEmbeddings().stream()
                .filter(e -> e.getApiName().equalsIgnoreCase(apiName))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Embedding not found for API: " + apiName));
    }

    /**
     * Search embeddings - returns all API info (for now, semantic search can be
     * added later)
     */
    public List<ApiDocEmbeddingsFile.ApiEmbedding> searchApis(String query) {
        ApiDocEmbeddingsFile file = loadExistingEmbeddings();
        String lowerQuery = query.toLowerCase();

        return file.getEmbeddings().stream()
                .filter(e -> e.getApiName().toLowerCase().contains(lowerQuery) ||
                        e.getToolName().toLowerCase().contains(lowerQuery) ||
                        e.getDescription().toLowerCase().contains(lowerQuery))
                .toList();
    }

    private String readApiDocFile() throws IOException {
        // Try reading from classpath first, then from file system
        Path filePath = Paths.get(apiDocsPath);
        if (Files.exists(filePath)) {
            return Files.readString(filePath);
        }

        // Try reading from project root
        Path projectPath = Paths.get("admin_core_service", "admin_apis.md");
        if (Files.exists(projectPath)) {
            return Files.readString(projectPath);
        }

        // Try classpath
        try {
            ClassPathResource resource = new ClassPathResource("admin_apis.md");
            try (InputStream is = resource.getInputStream()) {
                return new String(is.readAllBytes(), StandardCharsets.UTF_8);
            }
        } catch (Exception e) {
            throw new IOException("Could not find admin_apis.md file at: " + apiDocsPath, e);
        }
    }

    private List<ApiChunk> parseApiChunks(String content) {
        List<ApiChunk> chunks = new ArrayList<>();

        // Split by "---" delimiter which separates each API
        String[] sections = content.split("\\n---\\n");

        for (String section : sections) {
            String trimmed = section.trim();
            if (trimmed.isEmpty() || !trimmed.startsWith("# Tool:")) {
                continue;
            }

            try {
                ApiChunk chunk = parseChunk(trimmed);
                if (chunk != null) {
                    chunks.add(chunk);
                }
            } catch (Exception e) {
                log.warn("[ApiDocEmbedding] Error parsing chunk: {}", e.getMessage());
            }
        }

        return chunks;
    }

    private ApiChunk parseChunk(String content) {
        String[] lines = content.split("\\n");
        if (lines.length < 3) {
            return null;
        }

        String toolName = "";
        String apiName = "";
        String description = "";
        String endpoint = "";

        for (String line : lines) {
            if (line.startsWith("# Tool:")) {
                toolName = line.substring("# Tool:".length()).trim();
            } else if (line.startsWith("## api_name:")) {
                apiName = line.substring("## api_name:".length()).trim();
            } else if (line.startsWith("Description:")) {
                description = line.substring("Description:".length()).trim();
                // Extract endpoint from description if present
                int endpointIdx = description.indexOf("Endpoint:");
                if (endpointIdx > 0) {
                    endpoint = description.substring(endpointIdx + "Endpoint:".length()).trim();
                    description = description.substring(0, endpointIdx).trim();
                }
            }
        }

        if (apiName.isEmpty()) {
            return null;
        }

        return ApiChunk.builder()
                .toolName(toolName)
                .apiName(apiName)
                .description(description)
                .endpoint(endpoint)
                .fullContent(content)
                .build();
    }

    private String saveEmbeddingsFile(ApiDocEmbeddingsFile file) throws IOException {
        Path storagePath = Paths.get(embeddingStoragePath);
        if (!Files.exists(storagePath)) {
            Files.createDirectories(storagePath);
        }

        Path filePath = storagePath.resolve(API_DOC_FILENAME);
        String jsonContent = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(file);
        Files.writeString(filePath, jsonContent);

        return filePath.toAbsolutePath().toString();
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    private static class ApiChunk {
        private String toolName;
        private String apiName;
        private String description;
        private String endpoint;
        private String fullContent;
    }
}
