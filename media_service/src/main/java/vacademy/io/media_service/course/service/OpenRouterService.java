package vacademy.io.media_service.course.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import vacademy.io.media_service.service.AiTokenUsageClient;

import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Service
public class OpenRouterService {

    private static final String API_URL = "https://openrouter.ai";
    private final WebClient webClient;
    private final AiTokenUsageClient aiTokenUsageClient;

    public OpenRouterService(
            @Value("${openrouter.api.key}") String apiKey,
            AiTokenUsageClient aiTokenUsageClient) {
        this.aiTokenUsageClient = aiTokenUsageClient;
        this.webClient = WebClient.builder()
                .baseUrl(API_URL)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    public Flux<String> streamAnswer(String question, String model) {
        String actualModel = model != null ? model : "google/gemini-2.5-pro";
        Map<String, Object> payload = Map.of(
                "model", actualModel,
                "stream", true,
                "messages", List.of(Map.of("role", "user", "content", question)));

        // Track content length for token estimation
        AtomicInteger completionChars = new AtomicInteger(0);

        return webClient.post()
                .uri("/api/v1/chat/completions")
                .bodyValue(payload)
                .accept(MediaType.TEXT_EVENT_STREAM)
                .retrieve()
                .bodyToFlux(String.class)
                .takeWhile(data -> !data.equals("[DONE]")) // stop on [DONE]
                .flatMap(this::extractContent)
                .doOnNext(content -> {
                    completionChars.addAndGet(content.length());
                    log.info("Extracted content: {}", content);
                })
                .doOnComplete(() -> logTokenUsage(question, actualModel, completionChars.get()));
    }

    /**
     * Log estimated token usage after streaming completes
     */
    private void logTokenUsage(String prompt, String model, int completionChars) {
        try {
            // Estimate tokens based on character counts (roughly 4 chars per token)
            int estimatedPromptTokens = Math.max(1, prompt.length() / 4);
            int estimatedCompletionTokens = Math.max(1, completionChars / 4);

            aiTokenUsageClient.recordUsageAsync(
                    "openai",
                    model,
                    estimatedPromptTokens,
                    estimatedCompletionTokens,
                    "content", // Generic content type for streaming
                    null,
                    null);
        } catch (Exception e) {
            log.warn("Failed to log streaming usage: {}", e.getMessage());
        }
    }

    private Flux<String> extractContent(String line) {
        return Flux.just(line)
                .flatMap(json -> {
                    try {
                        JsonNode node = new ObjectMapper().readTree(json);
                        String content = node.path("choices").path(0).path("delta").path("content").asText(null);
                        return Mono.justOrEmpty(content);
                    } catch (JsonProcessingException e) {
                        log.warn("Failed to parse chunk: {}", json, e);
                        return Mono.empty();
                    }
                });
    }
}
