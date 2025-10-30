package vacademy.io.admin_core_service.features.workflow.engine;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;
import vacademy.io.admin_core_service.features.workflow.dto.HttpRequestNodeConfigDTO;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class HttpRequestNodeHandler implements NodeHandler {

    private final ObjectMapper objectMapper;
    private final SpelEvaluator spelEvaluator;
    private final RestTemplate restTemplate = new RestTemplate(); // ideally inject as @Bean

    @Override
    public boolean supports(String nodeType) {
        return "HTTP_REQUEST".equalsIgnoreCase(nodeType);
    }

    @Override
    public Map<String, Object> handle(Map<String, Object> context, String nodeConfigJson,
                                      Map<String, NodeTemplate> nodeTemplates, int countProcessed) {
        log.info("HttpRequestNodeHandler invoked.");
        Map<String, Object> changes = new HashMap<>();

        HttpRequestNodeConfigDTO dto;
        try {
            dto = objectMapper.readValue(nodeConfigJson, HttpRequestNodeConfigDTO.class);
        } catch (Exception e) {
            log.error("Failed to parse node config JSON into DTO: {}", e.getMessage());
            changes.put("error", "Invalid node config JSON");
            return changes;
        }

        HttpRequestNodeConfigDTO.RequestConfig cfg = dto.getConfig();
        String resultKey = Optional.ofNullable(dto.getResultKey()).orElse("httpResult");
        resultKey = evaluateSpel(resultKey,context,String.class,resultKey);
        try {
            // --- Conditional Execution ---
            if (StringUtils.hasText(cfg.getCondition())) {
                Boolean conditionResult = evaluateSpel(cfg.getCondition(), context, Boolean.class, false);
                if (!conditionResult) {
                    log.info("Condition '{}' evaluated to false, skipping execution.", cfg.getCondition());
                    changes.put(resultKey, Map.of("status", "skipped", "condition", cfg.getCondition()));
                    return changes;
                }
                log.info("Condition '{}' evaluated to true.", cfg.getCondition());
            }

            // --- Prepare Request ---
            String evaluatedUrl = evaluateSpel(cfg.getUrl(), context, String.class, cfg.getUrl());
            HttpMethod method = HttpMethod.valueOf(cfg.getMethod().toUpperCase());
            UriComponentsBuilder uriBuilder = UriComponentsBuilder.fromHttpUrl(evaluatedUrl);

            // --- Headers ---
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            if (cfg.getHeaders() != null && cfg.getHeaders().isObject()) {
                cfg.getHeaders().fields().forEachRemaining(entry -> {
                    String val = evaluateSpel(entry.getValue().asText(), context, String.class, "");
                    headers.add(entry.getKey(), val);
                });
            }

            // --- Authentication ---
            if (cfg.getAuthentication() != null && StringUtils.hasText(cfg.getAuthentication().getType())) {
                var auth = cfg.getAuthentication();
                switch (auth.getType().toUpperCase()) {
                    case "BASIC" -> {
                        String username = evaluateSpel(auth.getUsername(), context, String.class, "");
                        String password = evaluateSpel(auth.getPassword(), context, String.class, "");
                        headers.setBasicAuth(username, password);
                    }
                    case "BEARER" -> {
                        String token = evaluateSpel(auth.getToken(), context, String.class, "");
                        headers.setBearerAuth(token);
                    }
                    default -> log.warn("Unsupported auth type: {}", auth.getType());
                }
            }

            // --- Query Params ---
            if (cfg.getQueryParams() != null && cfg.getQueryParams().isObject()) {
                cfg.getQueryParams().fields().forEachRemaining(entry -> {
                    String val = evaluateSpel(entry.getValue().asText(), context, String.class, "");
                    uriBuilder.queryParam(entry.getKey(), val);
                });
            }

            // --- Body ---
            Object requestBody = null;
            if (cfg.getBody() != null && method != HttpMethod.GET && method != HttpMethod.DELETE) {
                requestBody = evaluateBodyExpressions(cfg.getBody(), context);
            }

            String finalUrl = uriBuilder.build().toUriString();
            HttpEntity<?> entity = new HttpEntity<>(requestBody, headers);

            // --- [START] LOG EQUIVALENT CURL COMMAND ---
            try {
                StringBuilder curlBuilder = new StringBuilder("curl --location"); // --location handles redirects
                curlBuilder.append(" -X ").append(method.name());
                curlBuilder.append(" '").append(finalUrl).append("'");

                // Add Headers
                entity.getHeaders().forEach((key, values) -> {
                    // Skip Content-Length, curl calculates it.
                    if (!key.equalsIgnoreCase(HttpHeaders.CONTENT_LENGTH)) {
                        values.forEach(value -> {
                            // Escape single quotes in header value for shell
                            String escapedValue = value.replace("'", "'\\''");
                            curlBuilder.append(" -H '").append(key).append(": ").append(escapedValue).append("'");
                        });
                    }
                });

                // Add Body
                if (entity.getBody() != null) {
                    String bodyJson = objectMapper.writeValueAsString(entity.getBody());
                    // Escape single quotes in JSON for shell
                    bodyJson = bodyJson.replace("'", "'\\''");
                    curlBuilder.append(" -d '").append(bodyJson).append("'");
                }

                log.info("Equivalent cURL: {}", curlBuilder.toString());

            } catch (Exception e) {
                log.warn("Failed to generate cURL command for logging: {}", e.getMessage());
            }
            // --- [END] LOG EQUIVALENT CURL COMMAND ---

            // --- Execute Request ---
            log.info("Executing HTTP {} → {}", method, finalUrl);
            if (requestBody != null) log.debug("Request body: {}", requestBody);

            ResponseEntity<String> response = restTemplate.exchange(finalUrl, method, entity, String.class);
            Map<String, Object> responseResult = processResponse(response);
            changes.put(resultKey, responseResult);
            log.info("HTTP Request Node Success: {}", finalUrl);

        } catch (HttpClientErrorException e) {
            log.error("HTTP Client Error: {} {} - {}", cfg.getMethod(), cfg.getUrl(), e.getStatusCode(), e);
            changes.put(resultKey, processHttpClientError(e));
            changes.put("error", "HttpClientError: " + e.getStatusCode());
        } catch (Exception e) {
            log.error("Error executing HttpRequestNodeHandler: {}", e.getMessage(), e);
            changes.put("error", "HttpRequestNodeHandler failed: " + e.getMessage());
        }

        return changes;
    }

    // ---------- Helper Methods ----------

    private <T> T evaluateSpel(String expression, Map<String, Object> context, Class<T> targetType, T defaultValue) {
        if (!StringUtils.hasText(expression)) return defaultValue;
        try {
            Object res = spelEvaluator.evaluate(expression, context);
            return (T) res;
        } catch (Exception e) {
            log.warn("SpEL evaluation failed for '{}': {}", expression, e.getMessage());
            return defaultValue;
        }
    }

    private Map<String, Object> processResponse(ResponseEntity<String> response) {
        Map<String, Object> result = new HashMap<>();
        result.put("statusCode", response.getStatusCode().value());
        result.put("headers", response.getHeaders().toSingleValueMap());
        String body = response.getBody();

        if (StringUtils.hasText(body)) {
            try {
                JsonNode json = objectMapper.readTree(body);
                result.put("body", objectMapper.convertValue(json, new TypeReference<Object>() {}));
            } catch (Exception e) {
                result.put("body", body);
            }
        } else {
            result.put("body", null);
        }
        return result;
    }

    private Map<String, Object> processHttpClientError(HttpClientErrorException e) {
        Map<String, Object> err = new HashMap<>();
        err.put("statusCode", e.getStatusCode().value());
        err.put("error", "HttpClientError");
        err.put("message", e.getMessage());
        try {
            JsonNode json = objectMapper.readTree(e.getResponseBodyAsString());
            err.put("responseBody", objectMapper.convertValue(json, new TypeReference<Object>() {}));
        } catch (Exception ex) {
            err.put("responseBody", e.getResponseBodyAsString());
        }
        return err;
    }

    private Object evaluateBodyExpressions(JsonNode node, Map<String, Object> context) {
        if (node.isObject()) {
            Map<String, Object> map = new HashMap<>();
            node.fields().forEachRemaining(e -> map.put(e.getKey(), evaluateBodyExpressions(e.getValue(), context)));
            return map;
        } else if (node.isArray()) {
            List<Object> list = new ArrayList<>();
            node.forEach(item -> list.add(evaluateBodyExpressions(item, context)));
            return list;
        } else if (node.isTextual()) {
            String text = node.asText();
            if (text.contains("#ctx") || text.contains("#root")) {
                try {
                    return spelEvaluator.evaluate(text, context);
                } catch (Exception e) {
                    log.warn("Failed SpEL in body '{}': {}", text, e.getMessage());
                }
            }
            return text;
        } else if (node.isNumber()) return node.numberValue();
        else if (node.isBoolean()) return node.booleanValue();
        else if (node.isNull()) return null;
        return node.toString();
    }
}