package vacademy.io.admin_core_service.features.course.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
public class OpenRouterService {

    private static final String OPEN_ROUTER_API_KEY = "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";
    private static final String API_URL = "https://openrouter.ai";

    private final WebClient webClient = WebClient.builder()
            .baseUrl(API_URL)
            .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + OPEN_ROUTER_API_KEY)
            .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .build();

    public Flux<String> streamAnswer(String question) {
        Map<String, Object> payload = Map.of(
                "model", "deepseek/deepseek-r1-0528:free",
                "stream", true,
                "messages", List.of(Map.of("role", "user", "content", question))
        );

        return webClient.post()
                .uri("/api/v1/chat/completions")
                .bodyValue(payload)
                .accept(MediaType.TEXT_EVENT_STREAM)
                .retrieve()
                .bodyToFlux(String.class)
                .doOnNext(chunk -> log.info("Raw chunk: {}", chunk))
                .flatMap(this::extractContent)
                .doOnNext(content -> log.info("Extracted content: {}", content));
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
