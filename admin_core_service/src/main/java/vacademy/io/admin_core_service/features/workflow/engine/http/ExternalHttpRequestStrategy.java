package vacademy.io.admin_core_service.features.workflow.engine.http;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;
import vacademy.io.admin_core_service.features.workflow.dto.HttpRequestNodeConfigDTO;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class ExternalHttpRequestStrategy implements HttpRequestStrategy {

    private final HttpHelperUtils httpHelperUtils;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate = new RestTemplate();

    @Override
    public boolean canHandle(String requestType) {
        return "EXTERNAL".equalsIgnoreCase(requestType);
    }

    @Override
    public Map<String, Object> execute(Map<String, Object> context, HttpRequestNodeConfigDTO.RequestConfig cfg) {
        Map<String, Object> result = new HashMap<>();
        try {
            String evaluatedUrl = httpHelperUtils.evaluateSpel(cfg.getUrl(), context, String.class, cfg.getUrl());
            HttpMethod method = HttpMethod.valueOf(cfg.getMethod().toUpperCase());
            UriComponentsBuilder uriBuilder = UriComponentsBuilder.fromHttpUrl(evaluatedUrl);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            if (cfg.getHeaders() != null && cfg.getHeaders().isObject()) {
                cfg.getHeaders().fields().forEachRemaining(entry -> {
                    String val = httpHelperUtils.evaluateSpel(entry.getValue().asText(), context, String.class, "");
                    headers.add(entry.getKey(), val);
                });
            }

            if (cfg.getAuthentication() != null && StringUtils.hasText(cfg.getAuthentication().getType())) {
                var auth = cfg.getAuthentication();
                switch (auth.getType().toUpperCase()) {
                    case "BASIC":
                        String username = httpHelperUtils.evaluateSpel(auth.getUsername(), context, String.class, "");
                        String password = httpHelperUtils.evaluateSpel(auth.getPassword(), context, String.class, "");
                        headers.setBasicAuth(username, password);
                        break;
                    case "BEARER":
                        String token = httpHelperUtils.evaluateSpel(auth.getToken(), context, String.class, "");
                        headers.setBearerAuth(token);
                        break;
                    default:
                        log.warn("Unsupported external auth type: {}", auth.getType());
                }
            }

            if (cfg.getQueryParams() != null && cfg.getQueryParams().isObject()) {
                cfg.getQueryParams().fields().forEachRemaining(entry -> {
                    String val = httpHelperUtils.evaluateSpel(entry.getValue().asText(), context, String.class, "");
                    uriBuilder.queryParam(entry.getKey(), val);
                });
            }

            Object requestBody = null;
            if (cfg.getBody() != null && method != HttpMethod.GET && method != HttpMethod.DELETE) {
                requestBody = httpHelperUtils.evaluateBodyExpressions(cfg.getBody(), context);
            }

            String finalUrl = uriBuilder.build().toUriString();
            HttpEntity<?> entity = new HttpEntity<>(requestBody, headers);

            logCurl(method, finalUrl, entity);

            log.info("Executing EXTERNAL HTTP {} → {}", method, finalUrl);
            if (requestBody != null) log.debug("Request body: {}", requestBody);

            ResponseEntity<String> response = restTemplate.exchange(finalUrl, method, entity, String.class);
            result.putAll(httpHelperUtils.processResponse(response));

        } catch (HttpClientErrorException e) {
            log.error("HTTP Client Error: {} {} - {}", cfg.getMethod(), cfg.getUrl(), e.getStatusCode(), e);
            result.putAll(httpHelperUtils.processHttpClientError(e));
        } catch (Exception e) {
            log.error("Error executing ExternalHttpRequestStrategy: {}", e.getMessage(), e);
            result.put("error", "ExternalHttpRequestStrategy failed: " + e.getMessage());
        }
        return result;
    }

    private void logCurl(HttpMethod method, String finalUrl, HttpEntity<?> entity) {
        try {
            StringBuilder curlBuilder = new StringBuilder("curl --location");
            curlBuilder.append(" -X ").append(method.name());
            curlBuilder.append(" '").append(finalUrl).append("'");

            entity.getHeaders().forEach((key, values) -> {
                if (!key.equalsIgnoreCase(HttpHeaders.CONTENT_LENGTH)) {
                    values.forEach(value -> {
                        String escapedValue = value.replace("'", "'\\''");
                        curlBuilder.append(" -H '").append(key).append(": ").append(escapedValue).append("'");
                    });
                }
            });

            if (entity.getBody() != null) {
                String bodyJson = objectMapper.writeValueAsString(entity.getBody());
                bodyJson = bodyJson.replace("'", "'\\''");
                curlBuilder.append(" -d '").append(bodyJson).append("'");
            }

            log.info("Equivalent cURL: {}", curlBuilder.toString());

        } catch (Exception e) {
            log.warn("Failed to generate cURL command for logging: {}", e.getMessage());
        }
    }
}