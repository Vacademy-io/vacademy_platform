package vacademy.io.admin_core_service.features.embedding.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.embedding.dto.*;
import vacademy.io.admin_core_service.features.embedding.service.ApiDocEmbeddingService;
import vacademy.io.admin_core_service.features.embedding.service.EmbeddingService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/v1/embedding")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Embedding", description = "APIs for generating and managing text embeddings")
public class EmbeddingController {

    private final EmbeddingService embeddingService;
    private final ApiDocEmbeddingService apiDocEmbeddingService;

    @PostMapping("/generate")
    @Operation(summary = "Generate embedding from text", description = "Generates a vector embedding from the provided text using OpenRouter API")
    public ResponseEntity<EmbeddingResponse> generateEmbedding(
            @Valid @RequestBody EmbeddingRequest request,
            @RequestAttribute(value = "user", required = false) CustomUserDetails userDetails) {

        log.info("[Embedding-API] Generating embedding for text of length: {}", request.getText().length());

        EmbeddingResponse response = embeddingService.generateEmbedding(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/generate-and-store")
    @Operation(summary = "Generate and store embedding", description = "Generates embedding and stores it to a file")
    public ResponseEntity<StoredEmbeddingResult> generateAndStoreEmbedding(
            @Valid @RequestBody EmbeddingRequest request,
            @RequestParam(value = "filename", required = false) String filename,
            @RequestAttribute(value = "user", required = false) CustomUserDetails userDetails) {

        log.info("[Embedding-API] Generating and storing embedding with filename: {}", filename);

        StoredEmbeddingResult result = embeddingService.generateAndStoreEmbedding(request, filename);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/load/{filename}")
    @Operation(summary = "Load stored embedding", description = "Loads an embedding from a stored file")
    public ResponseEntity<EmbeddingFileContent> loadEmbedding(
            @PathVariable String filename,
            @RequestAttribute(value = "user", required = false) CustomUserDetails userDetails) {

        log.info("[Embedding-API] Loading embedding from file: {}", filename);

        EmbeddingFileContent content = embeddingService.loadEmbedding(filename);
        return ResponseEntity.ok(content);
    }

    @GetMapping("/list")
    @Operation(summary = "List all stored embeddings", description = "Returns a list of all stored embedding filenames")
    public ResponseEntity<List<String>> listStoredEmbeddings(
            @RequestAttribute(value = "user", required = false) CustomUserDetails userDetails) {

        log.info("[Embedding-API] Listing all stored embeddings");

        List<String> embeddings = embeddingService.listStoredEmbeddings();
        return ResponseEntity.ok(embeddings);
    }

    @PostMapping("/batch-generate")
    @Operation(summary = "Generate embeddings for multiple texts", description = "Generates embeddings for a batch of texts")
    public ResponseEntity<List<EmbeddingResponse>> batchGenerateEmbeddings(
            @RequestBody List<EmbeddingRequest> requests,
            @RequestAttribute(value = "user", required = false) CustomUserDetails userDetails) {

        log.info("[Embedding-API] Batch generating {} embeddings", requests.size());

        List<EmbeddingResponse> responses = requests.stream()
                .map(embeddingService::generateEmbedding)
                .toList();

        return ResponseEntity.ok(responses);
    }

    // ========== API Documentation Embedding Endpoints ==========

    @PostMapping("/api-docs/generate")
    @Operation(summary = "Generate embeddings for API documentation", description = "Parses admin_apis.md file, generates embeddings for each API, and stores them in a file")
    public ResponseEntity<ApiDocEmbeddingResult> generateApiDocEmbeddings(
            @RequestBody(required = false) ApiDocEmbeddingRequest request,
            @RequestAttribute(value = "user", required = false) CustomUserDetails userDetails) {

        log.info("[Embedding-API] Generating API documentation embeddings");

        if (request == null) {
            request = new ApiDocEmbeddingRequest();
        }

        ApiDocEmbeddingResult result = apiDocEmbeddingService.generateApiDocEmbeddings(request);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/api-docs/update")
    @Operation(summary = "Update/regenerate API documentation embeddings", description = "Forces regeneration of all API documentation embeddings")
    public ResponseEntity<ApiDocEmbeddingResult> updateApiDocEmbeddings(
            @RequestBody(required = false) ApiDocEmbeddingRequest request,
            @RequestAttribute(value = "user", required = false) CustomUserDetails userDetails) {

        log.info("[Embedding-API] Updating API documentation embeddings (force regenerate)");

        if (request == null) {
            request = new ApiDocEmbeddingRequest();
        }
        request.setForceRegenerate(true);

        ApiDocEmbeddingResult result = apiDocEmbeddingService.generateApiDocEmbeddings(request);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/api-docs/load")
    @Operation(summary = "Load API documentation embeddings", description = "Loads the stored API documentation embeddings file")
    public ResponseEntity<ApiDocEmbeddingsFile> loadApiDocEmbeddings(
            @RequestAttribute(value = "user", required = false) CustomUserDetails userDetails) {

        log.info("[Embedding-API] Loading API documentation embeddings");

        ApiDocEmbeddingsFile file = apiDocEmbeddingService.loadExistingEmbeddings();
        return ResponseEntity.ok(file);
    }

    @GetMapping("/api-docs/api/{apiName}")
    @Operation(summary = "Get embedding for specific API", description = "Returns the embedding for a specific API by name")
    public ResponseEntity<ApiDocEmbeddingsFile.ApiEmbedding> getApiEmbedding(
            @PathVariable String apiName,
            @RequestAttribute(value = "user", required = false) CustomUserDetails userDetails) {

        log.info("[Embedding-API] Getting embedding for API: {}", apiName);

        ApiDocEmbeddingsFile.ApiEmbedding embedding = apiDocEmbeddingService.getEmbeddingByApiName(apiName);
        return ResponseEntity.ok(embedding);
    }

    @GetMapping("/api-docs/search")
    @Operation(summary = "Search API documentation", description = "Searches API documentation by keyword in name, tool name, or description")
    public ResponseEntity<List<ApiDocEmbeddingsFile.ApiEmbedding>> searchApis(
            @RequestParam String query,
            @RequestAttribute(value = "user", required = false) CustomUserDetails userDetails) {

        log.info("[Embedding-API] Searching APIs with query: {}", query);

        List<ApiDocEmbeddingsFile.ApiEmbedding> results = apiDocEmbeddingService.searchApis(query);
        return ResponseEntity.ok(results);
    }
}
