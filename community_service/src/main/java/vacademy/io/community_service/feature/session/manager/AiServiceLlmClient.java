package vacademy.io.community_service.feature.session.manager;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Chat completions through ai_service's model registry
 * ({@code POST /ai-service/internal/llm/v1/complete}, X-Internal-Service-Token).
 *
 * <p>community_service has no Isoquant key and no access to {@code ai_model_defaults},
 * so it names a USE CASE and ai_service picks the model, walks its fallback chain and
 * records token usage. {@code record_usage_only} is always true: ai_service charges no
 * credits for these calls.
 *
 * <p>{@link UnavailableException} means no model ran (token unset, endpoint not deployed
 * yet, token refused, connection failed); {@link CompletionException} means ai_service
 * answered with a failure.
 */
@Service
public class AiServiceLlmClient {

    private static final Logger log = LoggerFactory.getLogger(AiServiceLlmClient.class);
    public static final String PATH = "/ai-service/internal/llm/v1/complete";

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String baseUrl;
    private final String internalToken;

    @Autowired
    public AiServiceLlmClient(
            @Value("${ai.service.base.url:${AI_SERVICE_BASE_URL:http://ai-service:8077}}") String baseUrl,
            @Value("${internal.service.token:}") String internalToken) {
        this(baseUrl, internalToken, defaultRestTemplate());
    }

    AiServiceLlmClient(String baseUrl, String internalToken, RestTemplate restTemplate) {
        this.baseUrl = baseUrl.replaceAll("/$", "");
        this.internalToken = internalToken;
        this.restTemplate = restTemplate;
        if (!isConfigured()) {
            log.warn("[ai-llm] INTERNAL_SERVICE_TOKEN is not set on community-service: live-session summaries "
                    + "use the legacy direct OpenRouter call instead of ai_service's model defaults. "
                    + "Add the INTERNAL_SERVICE_TOKEN secret to the community-service deployment.");
        }
    }

    private static RestTemplate defaultRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        // GLM reasons before answering and ai_service may walk a fallback model.
        factory.setReadTimeout(180_000);
        return new RestTemplate(factory);
    }

    public record Completion(String content, String model, Map<String, Object> usage) {
    }

    public static class UnavailableException extends RuntimeException {
        public UnavailableException(String message) {
            super(message);
        }
    }

    public static class CompletionException extends RuntimeException {
        public CompletionException(String message) {
            super(message);
        }

        public CompletionException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    public boolean isConfigured() {
        return internalToken != null && !internalToken.isBlank();
    }

    public Completion complete(String useCase, List<Map<String, String>> messages, boolean jsonObject,
                               Integer maxTokens, String reasoningEffort, String instituteId) {
        if (!isConfigured()) {
            throw new UnavailableException("INTERNAL_SERVICE_TOKEN is not configured");
        }
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
        headers.set("X-Internal-Service-Token", internalToken);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(
                buildBody(useCase, messages, jsonObject, maxTokens, reasoningEffort, instituteId), headers);

        ResponseEntity<String> response;
        try {
            response = restTemplate.exchange(baseUrl + PATH, HttpMethod.POST, entity, String.class);
        } catch (RestClientResponseException e) {
            throw classify(useCase, e);
        } catch (ResourceAccessException e) {
            // I/O before a response. A read timeout also lands here, so say which.
            if (e.getMessage() != null && e.getMessage().toLowerCase().contains("timed out")
                    && !e.getMessage().toLowerCase().contains("connect")) {
                throw new CompletionException("ai_service " + useCase + " completion timed out", e);
            }
            throw new UnavailableException("ai_service unreachable: " + e.getMessage());
        }
        return parse(response.getBody());
    }

    static Map<String, Object> buildBody(String useCase, List<Map<String, String>> messages, boolean jsonObject,
                                         Integer maxTokens, String reasoningEffort, String instituteId) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("use_case", useCase);
        body.put("messages", messages);
        if (jsonObject) body.put("response_format", Map.of("type", "json_object"));
        if (maxTokens != null) body.put("max_tokens", maxTokens);
        if (reasoningEffort != null) body.put("reasoning_effort", reasoningEffort);
        if (instituteId != null && !instituteId.isBlank()) body.put("institute_id", instituteId);
        body.put("record_usage_only", true);
        return body;
    }

    @SuppressWarnings("unchecked")
    Completion parse(String responseBody) {
        JsonNode root;
        try {
            root = objectMapper.readTree(responseBody == null ? "" : responseBody);
        } catch (Exception e) {
            throw new CompletionException("ai_service returned an unreadable body", e);
        }
        String content = root.path("content").isTextual() ? root.path("content").asText() : "";
        if (content.isBlank()) {
            throw new CompletionException("ai_service returned an empty completion");
        }
        String model = root.path("model").isTextual() ? root.path("model").asText() : null;
        Map<String, Object> usage = root.path("usage").isObject()
                ? objectMapper.convertValue(root.path("usage"), Map.class)
                : Map.of();
        return new Completion(content, model, usage);
    }

    private RuntimeException classify(String useCase, RestClientResponseException e) {
        HttpStatus status = HttpStatus.resolve(e.getStatusCode().value());
        String body = e.getResponseBodyAsString();
        if (status == HttpStatus.NOT_FOUND || status == HttpStatus.METHOD_NOT_ALLOWED) {
            log.warn("[ai-llm] {} not available on ai_service ({}); using the legacy path", PATH, status);
            return new UnavailableException("ai_service has no " + PATH + " (" + status.value() + ")");
        }
        if (status == HttpStatus.UNAUTHORIZED || status == HttpStatus.FORBIDDEN) {
            log.error("[ai-llm] ai_service refused the internal token ({}); check INTERNAL_SERVICE_TOKEN",
                    status.value());
            return new UnavailableException("ai_service refused the internal token (" + status.value() + ")");
        }
        if (status == HttpStatus.SERVICE_UNAVAILABLE && body != null
                && body.contains("Internal service token is not configured")) {
            log.error("[ai-llm] ai_service has no INTERNAL_SERVICE_TOKEN configured; using the legacy path");
            return new UnavailableException("ai_service has no internal token configured");
        }
        String shortBody = body == null ? "" : (body.length() <= 300 ? body : body.substring(0, 300) + "…");
        return new CompletionException("ai_service " + useCase + " completion failed: HTTP "
                + e.getStatusCode().value() + " " + shortBody, e);
    }
}
