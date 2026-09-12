package vacademy.io.admin_core_service.features.agent.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import vacademy.io.admin_core_service.features.agent.dto.ConversationSession;
import vacademy.io.admin_core_service.features.ai_usage.enums.ApiProvider;
import vacademy.io.admin_core_service.features.ai_usage.enums.RequestType;
import vacademy.io.admin_core_service.features.ai_usage.service.AiTokenUsageService;

import java.util.*;

/**
 * Service for interacting with OpenRouter LLM API.
 * Handles chat completions with tool calling support.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LLMService {

    private static final String OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

    @Value("${openrouter.api.key:#{null}}")
    private String openRouterApiKey;

    // Deliberately NOT the shared RestTemplate bean: that bean has no connect/read timeouts,
    // so one stalled OpenRouter response would pin a Tomcat worker thread forever (and each
    // admin retry would pin another). Other clients of the shared bean are untouched.
    private final RestTemplate restTemplate = buildLlmRestTemplate();
    private final ObjectMapper objectMapper;
    private final AiTokenUsageService aiTokenUsageService;

    private static RestTemplate buildLlmRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);
        // Large drafts (16k completion tokens) legitimately stream for minutes; the frontend
        // aborts at 150s, so cap the server-side wait just above that.
        factory.setReadTimeout(160_000);
        return new RestTemplate(factory);
    }

    /**
     * Generate a chat completion with tool calling support
     */
    public LLMResponse generateChatCompletion(ConversationSession session) {
        log.info("[LLMService] Generating chat completion for session: {}", session.getSessionId());

        validateApiKey();

        try {
            // Build the request
            ObjectNode requestBody = buildChatRequest(session);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(openRouterApiKey);
            headers.set("HTTP-Referer", "https://vacademy.io");
            headers.set("X-Title", "Vacademy Agent");

            HttpEntity<String> entity = new HttpEntity<>(
                    objectMapper.writeValueAsString(requestBody),
                    headers);

            log.debug("[LLMService] Request: {}", objectMapper.writeValueAsString(requestBody));

            ResponseEntity<String> response = restTemplate.exchange(
                    OPENROUTER_CHAT_URL,
                    HttpMethod.POST,
                    entity,
                    String.class);

            if (response.getBody() == null) {
                throw new RuntimeException("Empty response from OpenRouter");
            }

            LLMResponse llmResponse = parseResponse(response.getBody());

            // Record the usage row (async by default; see logTokenUsage for the
            // synchronous variant callers that need to BILL the call opt into)
            logTokenUsage(llmResponse, session);

            return llmResponse;

        } catch (Exception e) {
            log.error("[LLMService] Error generating chat completion: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to generate chat completion: " + e.getMessage(), e);
        }
    }

    /**
     * Context key a caller sets to bucket its usage under something other than
     * {@link RequestType#AGENT} — e.g. the Automations chatbot bills as CHATBOT so its
     * spend is separable from admin agent use in the AI usage screens. Value may be a
     * {@link RequestType} or its string value.
     */
    public static final String CTX_REQUEST_TYPE = "request_type";

    /**
     * Context flag (Boolean TRUE) asking for the usage row to be written SYNCHRONOUSLY so
     * its id lands on {@link LLMResponse#getUsageLogId()}. Callers that go on to charge
     * credits need that id: it is the {@code usage_log_id} on the deduction, which is what
     * links a credit_transactions row back to the tokens that produced it. Default (absent)
     * stays fire-and-forget, so the agent path is unchanged.
     */
    public static final String CTX_USAGE_LOG_SYNC = "usage_log_sync";

    /**
     * Record the usage row for a completed call.
     *
     * <p>Token counts are already on the response (parsed in {@link #parseResponse}); this
     * only decides which bucket they land in and whether the write blocks.
     */
    private void logTokenUsage(LLMResponse llmResponse, ConversationSession session) {
        try {
            if (llmResponse.getPromptTokens() <= 0 && llmResponse.getCompletionTokens() <= 0) {
                return; // provider returned no usage block — nothing to record
            }

            // Parse each id independently: a caller with a non-UUID user id (an external
            // chat participant, say) must still get its institute-level usage recorded.
            UUID instituteId = toUuid(session.getInstituteId());
            UUID userId = toUuid(session.getUserId());

            Map<String, Object> ctx = session.getContext();
            RequestType requestType = resolveRequestType(ctx);

            if (ctx != null && Boolean.TRUE.equals(ctx.get(CTX_USAGE_LOG_SYNC))) {
                var saved = aiTokenUsageService.recordUsage(
                        ApiProvider.OPENAI,
                        requestType,
                        session.getModel(),
                        llmResponse.getPromptTokens(),
                        llmResponse.getCompletionTokens(),
                        instituteId,
                        userId);
                if (saved != null && saved.getId() != null) {
                    llmResponse.setUsageLogId(saved.getId().toString());
                }
                return;
            }

            aiTokenUsageService.recordUsageAsync(
                    ApiProvider.OPENAI,
                    requestType,
                    session.getModel(),
                    llmResponse.getPromptTokens(),
                    llmResponse.getCompletionTokens(),
                    instituteId,
                    userId);
        } catch (Exception e) {
            // Never fail the main request due to usage logging issues
            log.warn("[LLMService] Failed to log token usage: {}", e.getMessage());
        }
    }

    /** {@link #CTX_REQUEST_TYPE} from the session context, defaulting to AGENT. */
    private static RequestType resolveRequestType(Map<String, Object> ctx) {
        Object configured = ctx == null ? null : ctx.get(CTX_REQUEST_TYPE);
        if (configured instanceof RequestType rt) return rt;
        if (configured instanceof String s && !s.isBlank()) {
            try {
                return RequestType.fromValue(s);
            } catch (IllegalArgumentException ignored) {
                // Unknown value — fall through to AGENT rather than losing the row to the
                // ai_token_usage request_type CHECK.
            }
        }
        return RequestType.AGENT;
    }

    private static UUID toUuid(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /**
     * Build the chat request with messages and tools
     */
    private ObjectNode buildChatRequest(ConversationSession session) {
        ObjectNode request = objectMapper.createObjectNode();

        request.put("model", session.getModel());
        request.put("temperature", 0.7);
        request.put("max_tokens", session.getMaxTokens() != null ? session.getMaxTokens() : 4096);

        // Build messages array
        ArrayNode messages = objectMapper.createArrayNode();
        for (ConversationSession.ChatMessage msg : session.getHistory()) {
            messages.add(convertMessage(msg));
        }
        request.set("messages", messages);

        // Build tools array if we have pinned tools
        if (!session.getPinnedTools().isEmpty()) {
            ArrayNode tools = objectMapper.createArrayNode();
            for (ConversationSession.ToolDefinition tool : session.getPinnedTools()) {
                tools.add(convertTool(tool));
            }
            request.set("tools", tools);
            request.put("tool_choice", "auto");
        }

        return request;
    }

    /**
     * Convert internal message format to OpenAI format
     */
    private ObjectNode convertMessage(ConversationSession.ChatMessage msg) {
        ObjectNode message = objectMapper.createObjectNode();
        message.put("role", msg.getRole());

        if (msg.getContent() != null) {
            message.put("content", msg.getContent());
        }

        // Handle tool calls (assistant requesting tool use)
        if ("assistant".equals(msg.getRole()) && msg.getToolCallId() != null) {
            ArrayNode toolCalls = objectMapper.createArrayNode();
            ObjectNode toolCall = objectMapper.createObjectNode();
            toolCall.put("id", msg.getToolCallId());
            toolCall.put("type", "function");

            ObjectNode function = objectMapper.createObjectNode();
            function.put("name", msg.getToolName());
            try {
                function.put("arguments", objectMapper.writeValueAsString(msg.getToolArguments()));
            } catch (JsonProcessingException e) {
                function.put("arguments", "{}");
            }
            toolCall.set("function", function);
            toolCalls.add(toolCall);

            message.set("tool_calls", toolCalls);
            message.remove("content");
        }

        // Handle tool results
        if ("tool".equals(msg.getRole())) {
            message.put("tool_call_id", msg.getToolCallId());
            message.put("name", msg.getToolName());
        }

        return message;
    }

    /**
     * Convert tool definition to OpenAI function format
     */
    private ObjectNode convertTool(ConversationSession.ToolDefinition tool) {
        ObjectNode toolObj = objectMapper.createObjectNode();
        toolObj.put("type", "function");

        ObjectNode function = objectMapper.createObjectNode();
        function.put("name", tool.getName());
        function.put("description", tool.getDescription());

        // Build parameters schema
        ObjectNode parameters = objectMapper.createObjectNode();
        parameters.put("type", "object");

        ObjectNode properties = objectMapper.createObjectNode();
        ArrayNode required = objectMapper.createArrayNode();

        for (ConversationSession.ToolDefinition.ToolParameter param : tool.getParameters()) {
            ObjectNode paramObj = objectMapper.createObjectNode();
            paramObj.put("type", mapToJsonType(param.getType()));
            paramObj.put("description", param.getDescription());
            properties.set(param.getName(), paramObj);

            if (param.isRequired()) {
                required.add(param.getName());
            }
        }

        parameters.set("properties", properties);
        parameters.set("required", required);

        function.set("parameters", parameters);
        toolObj.set("function", function);

        return toolObj;
    }

    /**
     * Map Java types to JSON Schema types
     */
    private String mapToJsonType(String javaType) {
        if (javaType == null)
            return "string";
        String lower = javaType.toLowerCase();
        if (lower.contains("int") || lower.contains("long"))
            return "integer";
        if (lower.contains("double") || lower.contains("float"))
            return "number";
        if (lower.contains("bool"))
            return "boolean";
        if (lower.contains("list") || lower.contains("array"))
            return "array";
        if (lower.contains("map") || lower.contains("object"))
            return "object";
        return "string";
    }

    /**
     * Parse the LLM response
     */
    private LLMResponse parseResponse(String responseBody) throws JsonProcessingException {
        JsonNode root = objectMapper.readTree(responseBody);
        JsonNode choices = root.get("choices");

        if (choices == null || choices.isEmpty()) {
            throw new RuntimeException("No choices in LLM response");
        }

        JsonNode message = choices.get(0).get("message");
        String content = message.has("content") && !message.get("content").isNull()
                ? message.get("content").asText()
                : null;

        // Check for tool calls
        List<ToolCall> toolCalls = new ArrayList<>();
        if (message.has("tool_calls") && message.get("tool_calls").isArray()) {
            for (JsonNode tc : message.get("tool_calls")) {
                String id = tc.get("id").asText();
                JsonNode function = tc.get("function");
                String name = function.get("name").asText();
                String args = function.get("arguments").asText();

                Map<String, Object> arguments = objectMapper.readValue(
                        args,
                        new TypeReference<Map<String, Object>>() {
                        });

                toolCalls.add(new ToolCall(id, name, arguments));
            }
        }

        // Get finish reason
        String finishReason = choices.get(0).has("finish_reason")
                ? choices.get(0).get("finish_reason").asText()
                : "stop";

        // Real token counts — needed both for the usage row and for pricing the charge.
        JsonNode usage = root.get("usage");
        int promptTokens = usage != null && usage.has("prompt_tokens") ? usage.get("prompt_tokens").asInt() : 0;
        int completionTokens = usage != null && usage.has("completion_tokens")
                ? usage.get("completion_tokens").asInt() : 0;

        return LLMResponse.builder()
                .content(content)
                .toolCalls(toolCalls)
                .finishReason(finishReason)
                .hasToolCalls(!toolCalls.isEmpty())
                .promptTokens(promptTokens)
                .completionTokens(completionTokens)
                .build();
    }

    private void validateApiKey() {
        if (openRouterApiKey == null || openRouterApiKey.isBlank()) {
            throw new RuntimeException("OPENROUTER_API_KEY is not configured");
        }
    }

    /**
     * LLM Response wrapper
     */
    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class LLMResponse {
        private String content;
        private List<ToolCall> toolCalls;
        private String finishReason;
        private boolean hasToolCalls;

        /** Real usage from the provider's response — 0 when it returned no usage block. */
        private int promptTokens;
        private int completionTokens;

        /**
         * id of the ai_token_usage row this call wrote, set only when the caller asked
         * for a synchronous write via {@link LLMService#CTX_USAGE_LOG_SYNC}. Passed on as
         * {@code usage_log_id} so the credit transaction points back at the tokens.
         */
        private String usageLogId;
    }

    /**
     * Tool call from LLM
     */
    @lombok.Data
    @lombok.AllArgsConstructor
    public static class ToolCall {
        private String id;
        private String name;
        private Map<String, Object> arguments;
    }
}
