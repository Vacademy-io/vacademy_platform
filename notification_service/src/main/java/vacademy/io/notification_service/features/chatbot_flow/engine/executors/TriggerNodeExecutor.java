package vacademy.io.notification_service.features.chatbot_flow.engine.executors;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.notification_service.features.chatbot_flow.engine.ChatbotNodeExecutor;
import vacademy.io.notification_service.features.chatbot_flow.engine.FlowExecutionContext;
import vacademy.io.notification_service.features.chatbot_flow.engine.NodeExecutionResult;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotFlowNode;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotFlowSession;
import vacademy.io.notification_service.features.chatbot_flow.enums.ChatbotNodeType;

import java.util.List;
import java.util.Map;
import java.util.concurrent.*;
import java.util.regex.Pattern;

@Component
@Slf4j
@RequiredArgsConstructor
public class TriggerNodeExecutor implements ChatbotNodeExecutor {

    /** Bounded thread pool for regex execution — prevents backtracking from starving ForkJoinPool.commonPool */
    private static final ExecutorService REGEX_POOL = Executors.newFixedThreadPool(2, r -> {
        Thread t = new Thread(r, "chatbot-regex-safety");
        t.setDaemon(true);
        return t;
    });

    private final ObjectMapper objectMapper;

    @Override
    public boolean canHandle(String nodeType) {
        return ChatbotNodeType.TRIGGER.name().equals(nodeType);
    }

    @Override
    public NodeExecutionResult execute(ChatbotFlowNode node, ChatbotFlowSession session,
                                        String userText, FlowExecutionContext context) {
        Map<String, Object> config = parseConfig(node.getConfig());
        if (config == null) {
            return NodeExecutionResult.builder().success(false).errorMessage("Invalid trigger config").build();
        }

        String triggerType = (String) config.getOrDefault("triggerType", "KEYWORD_MATCH");

        switch (triggerType) {
            case "KEYWORD_MATCH":
                return evaluateKeywordMatch(config, userText);
            case "FIRST_CONTACT":
                // First contact: matches if there's no active session (session == null)
                return NodeExecutionResult.builder().success(session == null).build();
            case "BUTTON_REPLY":
                return evaluateButtonReply(config, context);
            default:
                log.warn("Unknown trigger type: {}", triggerType);
                return NodeExecutionResult.builder().success(false).build();
        }
    }

    private NodeExecutionResult evaluateKeywordMatch(Map<String, Object> config, String userText) {
        if (userText == null || userText.isBlank()) {
            return NodeExecutionResult.builder().success(false).build();
        }

        @SuppressWarnings("unchecked")
        List<String> keywords = (List<String>) config.get("keywords");
        String matchType = (String) config.getOrDefault("matchType", "contains");

        if (keywords == null || keywords.isEmpty()) {
            // No keywords means match everything (catch-all trigger)
            return NodeExecutionResult.builder().success(true).build();
        }

        String normalizedInput = userText.trim().toLowerCase();

        for (String keyword : keywords) {
            String normalizedKeyword = keyword.trim().toLowerCase();
            boolean matched = switch (matchType) {
                case "exact" -> normalizedInput.equals(normalizedKeyword);
                case "contains" -> normalizedInput.contains(normalizedKeyword);
                case "regex" -> {
                    yield safeRegexMatch(normalizedKeyword, userText);
                }
                default -> normalizedInput.contains(normalizedKeyword);
            };
            if (matched) {
                return NodeExecutionResult.builder().success(true).build();
            }
        }
        return NodeExecutionResult.builder().success(false).build();
    }

    private NodeExecutionResult evaluateButtonReply(Map<String, Object> config, FlowExecutionContext context) {
        @SuppressWarnings("unchecked")
        List<String> buttonIds = (List<String>) config.get("buttonIds");
        if (buttonIds == null || buttonIds.isEmpty()) {
            return NodeExecutionResult.builder().success(false).build();
        }

        String incomingButtonId = context.getButtonId();
        String incomingPayload = context.getButtonPayload();

        boolean matched = buttonIds.stream().anyMatch(bid ->
                bid.equalsIgnoreCase(incomingButtonId) || bid.equalsIgnoreCase(incomingPayload));

        return NodeExecutionResult.builder().success(matched).build();
    }

    /**
     * Regex match with timeout to prevent ReDoS from catastrophic backtracking patterns.
     */
    private boolean safeRegexMatch(String pattern, String input) {
        Future<Boolean> future = null;
        try {
            future = REGEX_POOL.submit(() ->
                    Pattern.compile(pattern, Pattern.CASE_INSENSITIVE).matcher(input).find());
            return future.get(2, TimeUnit.SECONDS);
        } catch (TimeoutException e) {
            log.warn("Regex timed out (possible ReDoS): pattern={}", pattern);
            if (future != null) future.cancel(true); // Interrupt the backtracking thread
            return false;
        } catch (Exception e) {
            log.warn("Invalid regex in trigger: {}", pattern);
            return false;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseConfig(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.warn("Failed to parse trigger config: {}", e.getMessage());
            return null;
        }
    }
}
