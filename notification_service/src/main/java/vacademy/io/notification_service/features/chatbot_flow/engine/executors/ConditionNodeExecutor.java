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
public class ConditionNodeExecutor implements ChatbotNodeExecutor {

    private static final ExecutorService REGEX_POOL = Executors.newFixedThreadPool(2, r -> {
        Thread t = new Thread(r, "chatbot-condition-regex");
        t.setDaemon(true);
        return t;
    });

    private final ObjectMapper objectMapper;

    @Override
    public boolean canHandle(String nodeType) {
        return ChatbotNodeType.CONDITION.name().equals(nodeType);
    }

    @Override
    public NodeExecutionResult execute(ChatbotFlowNode node, ChatbotFlowSession session,
                                        String userText, FlowExecutionContext context) {
        // If no user text yet (just arrived at this node), wait for input
        if (userText == null && context.getButtonId() == null
                && context.getButtonPayload() == null && context.getListReplyId() == null) {
            return NodeExecutionResult.builder().success(true).waitForInput(true).build();
        }

        Map<String, Object> config = parseConfig(node.getConfig());
        if (config == null) {
            return NodeExecutionResult.builder().success(false).errorMessage("Invalid condition config").build();
        }

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> branches = (List<Map<String, Object>>) config.get("branches");
        if (branches == null || branches.isEmpty()) {
            return NodeExecutionResult.builder().success(false).errorMessage("No branches configured").build();
        }

        // Try to match branches in order
        String defaultBranchId = null;
        for (Map<String, Object> branch : branches) {
            Boolean isDefault = (Boolean) branch.get("isDefault");
            if (Boolean.TRUE.equals(isDefault)) {
                defaultBranchId = (String) branch.get("id");
                continue;
            }

            String matchType = (String) branch.getOrDefault("matchType", "contains");
            String matchValue = (String) branch.get("matchValue");
            String branchId = (String) branch.get("id");

            if (matchValue == null || matchValue.isBlank()) continue;

            boolean matched = evaluateMatch(matchType, matchValue, userText, context);
            if (matched) {
                log.debug("Condition branch matched: branchId={}, matchType={}, matchValue={}",
                        branchId, matchType, matchValue);
                return NodeExecutionResult.builder()
                        .success(true)
                        .selectedBranchId(branchId)
                        .build();
            }
        }

        // No branch matched — use default if available
        if (defaultBranchId != null) {
            return NodeExecutionResult.builder()
                    .success(true)
                    .selectedBranchId(defaultBranchId)
                    .build();
        }

        // No match and no default — stay on this node
        log.warn("No condition branch matched and no default for node: {}", node.getId());
        return NodeExecutionResult.builder().success(true).waitForInput(true).build();
    }

    private boolean evaluateMatch(String matchType, String matchValue,
                                   String userText, FlowExecutionContext context) {
        String normalizedValue = matchValue.trim().toLowerCase();

        switch (matchType) {
            case "exact":
                return userText != null && userText.trim().equalsIgnoreCase(matchValue);

            case "contains":
                return userText != null && userText.toLowerCase().contains(normalizedValue);

            case "regex":
                if (userText == null) return false;
                return safeRegexMatch(matchValue, userText);

            case "button_id":
                return context.getButtonId() != null && matchValue.equalsIgnoreCase(context.getButtonId());

            case "list_id":
                return context.getListReplyId() != null && matchValue.equalsIgnoreCase(context.getListReplyId());

            case "payload":
                return context.getButtonPayload() != null && matchValue.equalsIgnoreCase(context.getButtonPayload());

            default:
                return userText != null && userText.toLowerCase().contains(normalizedValue);
        }
    }

    private boolean safeRegexMatch(String pattern, String input) {
        Future<Boolean> future = null;
        try {
            future = REGEX_POOL.submit(() ->
                    Pattern.compile(pattern, Pattern.CASE_INSENSITIVE).matcher(input).find());
            return future.get(2, TimeUnit.SECONDS);
        } catch (TimeoutException e) {
            log.warn("Regex timed out (possible ReDoS): pattern={}", pattern);
            if (future != null) future.cancel(true);
            return false;
        } catch (Exception e) {
            log.warn("Invalid regex in condition: {}", pattern);
            return false;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseConfig(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.warn("Failed to parse condition config: {}", e.getMessage());
            return null;
        }
    }
}
