package vacademy.io.admin_core_service.features.agent.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.agent.dto.ConversationSession;
import vacademy.io.admin_core_service.features.embedding.dto.ApiDocEmbeddingsFile;
import vacademy.io.admin_core_service.features.embedding.service.ApiDocEmbeddingService;
import vacademy.io.admin_core_service.features.embedding.service.EmbeddingService;
import vacademy.io.admin_core_service.features.embedding.dto.EmbeddingRequest;
import vacademy.io.admin_core_service.features.embedding.dto.EmbeddingResponse;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for semantic search on API documentation embeddings.
 * Uses cosine similarity to find relevant APIs for a user query.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class VectorSearchService {

    private final EmbeddingService embeddingService;
    private final ApiDocEmbeddingService apiDocEmbeddingService;

    private static final int DEFAULT_TOP_K = 10;
    private static final double SIMILARITY_THRESHOLD = 0.3;

    /**
     * Search for relevant APIs based on user query
     */
    public List<ConversationSession.ToolDefinition> searchRelevantTools(String query, int topK) {
        log.info("[VectorSearch] Searching for tools matching query: {}", query);

        try {
            // 1. Generate embedding for the query
            EmbeddingRequest embeddingRequest = EmbeddingRequest.builder()
                    .text(query)
                    .build();

            EmbeddingResponse queryEmbedding = embeddingService.generateEmbedding(embeddingRequest);
            List<Double> queryVector = queryEmbedding.getData().get(0).getEmbedding();

            // 2. Load all API embeddings
            ApiDocEmbeddingsFile apiEmbeddings = apiDocEmbeddingService.loadExistingEmbeddings();

            // 3. Calculate similarity scores
            List<ScoredApi> scoredApis = new ArrayList<>();

            for (ApiDocEmbeddingsFile.ApiEmbedding apiEmbed : apiEmbeddings.getEmbeddings()) {
                double similarity = cosineSimilarity(queryVector, apiEmbed.getEmbedding());

                if (similarity >= SIMILARITY_THRESHOLD) {
                    scoredApis.add(new ScoredApi(apiEmbed, similarity));
                }
            }

            // 4. Sort by similarity and take top K
            scoredApis.sort((a, b) -> Double.compare(b.similarity, a.similarity));

            List<ScoredApi> topApis = scoredApis.stream()
                    .limit(topK > 0 ? topK : DEFAULT_TOP_K)
                    .collect(Collectors.toList());

            log.info("[VectorSearch] Found {} relevant APIs (threshold: {})", topApis.size(), SIMILARITY_THRESHOLD);

            // 5. Convert to ToolDefinitions
            return topApis.stream()
                    .map(this::convertToToolDefinition)
                    .collect(Collectors.toList());

        } catch (Exception e) {
            log.error("[VectorSearch] Error searching for tools: {}", e.getMessage(), e);
            return Collections.emptyList();
        }
    }

    /**
     * Search with default top K
     */
    public List<ConversationSession.ToolDefinition> searchRelevantTools(String query) {
        return searchRelevantTools(query, DEFAULT_TOP_K);
    }

    /**
     * Get all available tools (for cases where we want full access)
     */
    public List<ConversationSession.ToolDefinition> getAllTools() {
        try {
            ApiDocEmbeddingsFile apiEmbeddings = apiDocEmbeddingService.loadExistingEmbeddings();
            return apiEmbeddings.getEmbeddings().stream()
                    .map(api -> convertToToolDefinition(new ScoredApi(api, 1.0)))
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("[VectorSearch] Error loading all tools: {}", e.getMessage(), e);
            return Collections.emptyList();
        }
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    private double cosineSimilarity(List<Double> vec1, List<Double> vec2) {
        if (vec1.size() != vec2.size()) {
            throw new IllegalArgumentException("Vectors must have same dimension");
        }

        double dotProduct = 0.0;
        double norm1 = 0.0;
        double norm2 = 0.0;

        for (int i = 0; i < vec1.size(); i++) {
            dotProduct += vec1.get(i) * vec2.get(i);
            norm1 += vec1.get(i) * vec1.get(i);
            norm2 += vec2.get(i) * vec2.get(i);
        }

        if (norm1 == 0 || norm2 == 0) {
            return 0.0;
        }

        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }

    /**
     * Convert API embedding to tool definition
     */
    private ConversationSession.ToolDefinition convertToToolDefinition(ScoredApi scoredApi) {
        ApiDocEmbeddingsFile.ApiEmbedding api = scoredApi.api;

        // Parse the API content to extract parameters
        List<ConversationSession.ToolDefinition.ToolParameter> parameters = parseParameters(api.getContent());

        // Determine if this action requires confirmation
        boolean requiresConfirmation = shouldRequireConfirmation(api.getApiName(), api.getEndpoint());

        // Extract method from endpoint
        String method = extractMethod(api.getEndpoint());
        String cleanEndpoint = extractCleanEndpoint(api.getEndpoint());

        return ConversationSession.ToolDefinition.builder()
                .name(api.getApiName())
                .description(api.getToolName() + ": " + api.getDescription())
                .endpoint(cleanEndpoint)
                .method(method)
                .parameters(parameters)
                .sampleInput(extractSampleInput(api.getContent()))
                .sampleOutput(extractSampleOutput(api.getContent()))
                .requiresConfirmation(requiresConfirmation)
                .build();
    }

    /**
     * Parse parameters from API content
     */
    private List<ConversationSession.ToolDefinition.ToolParameter> parseParameters(String content) {
        List<ConversationSession.ToolDefinition.ToolParameter> params = new ArrayList<>();

        if (content == null)
            return params;

        // Split by lines and look for "Inputs:" section
        String[] lines = content.split("\n");
        boolean inInputs = false;

        for (String line : lines) {
            if (line.startsWith("Inputs:")) {
                inInputs = true;
                continue;
            }

            if (inInputs && line.startsWith("- ")) {
                // Parse parameter line like "- userId (String): Query Param"
                String paramLine = line.substring(2).trim();

                // Extract name and type
                String name = "";
                String type = "string";
                String location = "query";

                if (paramLine.startsWith("Body:")) {
                    name = "body";
                    type = paramLine.substring(5).trim();
                    location = "body";
                } else if (paramLine.contains("(") && paramLine.contains(")")) {
                    int parenStart = paramLine.indexOf("(");
                    int parenEnd = paramLine.indexOf(")");
                    name = paramLine.substring(0, parenStart).trim();
                    type = paramLine.substring(parenStart + 1, parenEnd).trim();

                    if (paramLine.toLowerCase().contains("path")) {
                        location = "path";
                    } else if (paramLine.toLowerCase().contains("query")) {
                        location = "query";
                    }
                } else {
                    name = paramLine.split(" ")[0];
                }

                if (!name.isEmpty()) {
                    params.add(ConversationSession.ToolDefinition.ToolParameter.builder()
                            .name(name)
                            .type(type.toLowerCase())
                            .description(paramLine)
                            .required(true)
                            .location(location)
                            .build());
                }
            }

            // Stop parsing inputs when we hit Sample
            if (line.startsWith("Sample")) {
                inInputs = false;
            }
        }

        return params;
    }

    /**
     * Determine if an action requires user confirmation
     */
    private boolean shouldRequireConfirmation(String apiName, String endpoint) {
        String lower = (apiName + " " + (endpoint != null ? endpoint : "")).toLowerCase();

        // DELETE operations always need confirmation
        if (lower.contains("delete") || lower.contains("remove")) {
            return true;
        }

        // Status changes need confirmation
        if (lower.contains("status") || lower.contains("deactivate") || lower.contains("suspend")) {
            return true;
        }

        // Bulk operations need confirmation
        if (lower.contains("bulk") || lower.contains("batch") || lower.contains("multiple")) {
            return true;
        }

        // Approval/Rejection needs confirmation
        if (lower.contains("approve") || lower.contains("reject")) {
            return true;
        }

        // Enrollment operations
        if (lower.contains("enroll") || lower.contains("unenroll")) {
            return true;
        }

        return false;
    }

    private String extractMethod(String endpoint) {
        if (endpoint == null)
            return "GET";
        String upper = endpoint.toUpperCase();
        if (upper.startsWith("POST"))
            return "POST";
        if (upper.startsWith("PUT"))
            return "PUT";
        if (upper.startsWith("DELETE"))
            return "DELETE";
        if (upper.startsWith("PATCH"))
            return "PATCH";
        return "GET";
    }

    private String extractCleanEndpoint(String endpoint) {
        if (endpoint == null)
            return "";
        // Remove method prefix
        return endpoint.replaceFirst("(?i)^(GET|POST|PUT|DELETE|PATCH)\\s+", "").trim();
    }

    private String extractSampleInput(String content) {
        if (content == null)
            return null;
        int start = content.indexOf("Sample Input JSON:");
        int end = content.indexOf("Sample Output JSON:");
        if (start != -1 && end != -1 && end > start) {
            return content.substring(start + "Sample Input JSON:".length(), end).trim()
                    .replaceAll("```json", "").replaceAll("```", "").trim();
        }
        return null;
    }

    private String extractSampleOutput(String content) {
        if (content == null)
            return null;
        int start = content.indexOf("Sample Output JSON:");
        if (start != -1) {
            return content.substring(start + "Sample Output JSON:".length()).trim()
                    .replaceAll("```json", "").replaceAll("```", "").replaceAll("---", "").trim();
        }
        return null;
    }

    /**
     * Internal class to hold API with similarity score
     */
    private static class ScoredApi {
        ApiDocEmbeddingsFile.ApiEmbedding api;
        double similarity;

        ScoredApi(ApiDocEmbeddingsFile.ApiEmbedding api, double similarity) {
            this.api = api;
            this.similarity = similarity;
        }
    }
}
