package vacademy.io.admin_core_service.features.workflow.engine.http;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpClientErrorException;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class HttpHelperUtils {

    private final SpelEvaluator spelEvaluator;
    private final ObjectMapper objectMapper;

    public <T> T evaluateSpel(String expression, Map<String, Object> context, Class<T> targetType, T defaultValue) {
        if (!StringUtils.hasText(expression)) return defaultValue;
        try {
            Object res = spelEvaluator.evaluate(expression, context);
            return (T) res;
        } catch (Exception e) {
            e.printStackTrace();
            log.warn("SpEL evaluation failed for '{}': {}", expression, e.getMessage());
            return defaultValue;
        }
    }

    public Object evaluateBodyExpressions(JsonNode node, Map<String, Object> context) {
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

    public Map<String, Object> processResponse(ResponseEntity<String> response) {
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

    public Map<String, Object> processHttpClientError(HttpClientErrorException e) {
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
}
