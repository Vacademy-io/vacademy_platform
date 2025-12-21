package vacademy.io.admin_core_service.features.agent.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;
import vacademy.io.admin_core_service.features.agent.dto.ConversationSession;

import java.util.Map;

/**
 * Executes real API calls based on tool definitions.
 * Uses the user's JWT token for authentication.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ToolExecutor {

    private final RestTemplate restTemplate;

    @Value("${tool.executor.base-url:http://localhost}")
    private String baseUrl;

    /**
     * Execute a tool call and return the result as JSON string
     */
    public ToolExecutionResult execute(ConversationSession.ToolDefinition tool,
            Map<String, Object> arguments,
            ConversationSession session) {
        log.info("[ToolExecutor] Executing tool: {} with args: {}", tool.getName(), arguments);

        try {
            // Build the request
            String url = buildUrl(tool, arguments, session);
            HttpMethod method = HttpMethod.valueOf(tool.getMethod().toUpperCase());
            HttpHeaders headers = buildHeaders(session.getUserToken());

            // Get request body if present
            Object body = arguments.get("body");
            HttpEntity<?> entity = body != null ? new HttpEntity<>(body, headers) : new HttpEntity<>(headers);

            log.info("[ToolExecutor] Making {} request to: {}", method, url);

            // Execute the request
            ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    method,
                    entity,
                    String.class);

            log.info("[ToolExecutor] Response status: {}", response.getStatusCode());

            return ToolExecutionResult.success(tool.getName(), response.getBody());

        } catch (Exception e) {
            log.error("[ToolExecutor] Error executing tool {}: {}", tool.getName(), e.getMessage(), e);
            return ToolExecutionResult.failure(tool.getName(), e.getMessage());
        }
    }

    /**
     * Build the full URL with path variables and query parameters
     */
    private String buildUrl(ConversationSession.ToolDefinition tool,
            Map<String, Object> arguments,
            ConversationSession session) {
        String endpoint = tool.getEndpoint();

        // Replace path variables
        for (ConversationSession.ToolDefinition.ToolParameter param : tool.getParameters()) {
            if ("path".equals(param.getLocation()) && arguments.containsKey(param.getName())) {
                endpoint = endpoint.replace("{" + param.getName() + "}",
                        String.valueOf(arguments.get(param.getName())));
            }
        }

        // Build with query parameters
        UriComponentsBuilder builder = UriComponentsBuilder
                .fromHttpUrl(baseUrl + endpoint);

        for (ConversationSession.ToolDefinition.ToolParameter param : tool.getParameters()) {
            if ("query".equals(param.getLocation()) && arguments.containsKey(param.getName())) {
                builder.queryParam(param.getName(), arguments.get(param.getName()));
            }
        }

        // Always add instituteId from session context if not in arguments
        if (!arguments.containsKey("instituteId") && session.getInstituteId() != null) {
            builder.queryParam("instituteId", session.getInstituteId());
        }

        return builder.build().toUriString();
    }

    /**
     * Build HTTP headers with authentication
     */
    private HttpHeaders buildHeaders(String userToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        if (userToken != null && !userToken.isEmpty()) {
            // Add Bearer token
            if (!userToken.startsWith("Bearer ")) {
                userToken = "Bearer " + userToken;
            }
            headers.set("Authorization", userToken);
        }

        return headers;
    }

    /**
     * Result of tool execution
     */
    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class ToolExecutionResult {
        private String toolName;
        private boolean success;
        private String result;
        private String error;

        public static ToolExecutionResult success(String toolName, String result) {
            return ToolExecutionResult.builder()
                    .toolName(toolName)
                    .success(true)
                    .result(result)
                    .build();
        }

        public static ToolExecutionResult failure(String toolName, String error) {
            return ToolExecutionResult.builder()
                    .toolName(toolName)
                    .success(false)
                    .error(error)
                    .build();
        }
    }
}
