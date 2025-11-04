package vacademy.io.admin_core_service.features.workflow.engine.http;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.util.UriComponentsBuilder;
import vacademy.io.admin_core_service.features.workflow.dto.HttpRequestNodeConfigDTO;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils; // Assuming this path

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Component
@RequiredArgsConstructor
public class InternalHttpRequestStrategy implements HttpRequestStrategy {

    private final HttpHelperUtils httpHelperUtils;
    private final InternalClientUtils internalClientUtils; // Assuming this is injected

    @Override
    public boolean canHandle(String requestType) {
        return "INTERNAL".equalsIgnoreCase(requestType);
    }

    @Override
    public Map<String, Object> execute(Map<String, Object> context, HttpRequestNodeConfigDTO.RequestConfig cfg) {
        Map<String, Object> result = new HashMap<>();

        try {
            String clientName = Optional.ofNullable(cfg.getAuthentication())
                    .map(HttpRequestNodeConfigDTO.AuthenticationConfig::getClientName)
                    .orElse(null);

            clientName = httpHelperUtils.evaluateSpel(clientName, context, String.class, clientName);

            if (clientName == null || clientName.isBlank()) {
                log.error("INTERNAL request type requires 'authentication.clientName'.");
                result.put("error", "INTERNAL request missing clientName");
                return result;
            }

            String evaluatedUrl = httpHelperUtils.evaluateSpel(cfg.getUrl(), context, String.class, cfg.getUrl());
            String method = cfg.getMethod().toUpperCase();

            UriComponentsBuilder uriBuilder = UriComponentsBuilder.fromHttpUrl(evaluatedUrl);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            if (cfg.getHeaders() != null && cfg.getHeaders().isObject()) {
                cfg.getHeaders().fields().forEachRemaining(entry -> {
                    String val = httpHelperUtils.evaluateSpel(entry.getValue().asText(), context, String.class, "");
                    headers.add(entry.getKey(), val);
                });
            }

            if (cfg.getQueryParams() != null && cfg.getQueryParams().isObject()) {
                cfg.getQueryParams().fields().forEachRemaining(entry -> {
                    String val = httpHelperUtils.evaluateSpel(entry.getValue().asText(), context, String.class, "");
                    uriBuilder.queryParam(entry.getKey(), val);
                });
            }

            // The internal client utils builds the URL from base + route, but our DTO has a full URL.
            // We'll just pass the final URL as the "baseUrl" and an empty string as the "route".
            String finalUrl = uriBuilder.build().toUriString();

            Object requestBody = null;
            if (cfg.getBody() != null && !"GET".equals(method) && !"DELETE".equals(method)) {
                requestBody = httpHelperUtils.evaluateBodyExpressions(cfg.getBody(), context);
            }

            log.info("Executing INTERNAL HTTP {} → {} for client: {}", method, finalUrl, clientName);
            if (requestBody != null) log.debug("Request body: {}", requestBody);

            // Using the makeHmacRequest that accepts additional headers
            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                    clientName,
                    method,
                    finalUrl, // Pass final URL as baseUrl
                    "",       // Pass empty string as route
                    requestBody,
                    headers
            );

            result.putAll(httpHelperUtils.processResponse(response));

        } catch (HttpClientErrorException e) {
            log.error("HTTP Client Error (INTERNAL): {} {} - {}", cfg.getMethod(), cfg.getUrl(), e.getStatusCode(), e);
            result.putAll(httpHelperUtils.processHttpClientError(e));
        } catch (Exception e) {
            log.error("Error executing InternalHttpRequestStrategy: {}", e.getMessage(), e);
            result.put("error", "InternalHttpRequestStrategy failed: " + e.getMessage());
        }
        return result;
    }
}