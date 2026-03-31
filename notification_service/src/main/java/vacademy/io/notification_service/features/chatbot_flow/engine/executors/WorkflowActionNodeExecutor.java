package vacademy.io.notification_service.features.chatbot_flow.engine.executors;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.notification_service.features.chatbot_flow.engine.ChatbotNodeExecutor;
import vacademy.io.notification_service.features.chatbot_flow.engine.FlowExecutionContext;
import vacademy.io.notification_service.features.chatbot_flow.engine.NodeExecutionResult;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotFlowNode;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotFlowSession;
import vacademy.io.notification_service.features.chatbot_flow.enums.ChatbotNodeType;

import java.util.HashMap;
import java.util.Map;

@Component
@Slf4j
@RequiredArgsConstructor
public class WorkflowActionNodeExecutor implements ChatbotNodeExecutor {

    private final ObjectMapper objectMapper;
    private final InternalClientUtils internalClientUtils;

    @Value("${admin.core.service.baseurl:http://localhost:8081}")
    private String adminCoreServiceUrl;

    @Value("${spring.application.name:notification_service}")
    private String clientName;

    @Override
    public boolean canHandle(String nodeType) {
        return ChatbotNodeType.WORKFLOW_ACTION.name().equals(nodeType);
    }

    @Override
    public NodeExecutionResult execute(ChatbotFlowNode node, ChatbotFlowSession session,
                                        String userText, FlowExecutionContext context) {
        Map<String, Object> config = parseConfig(node.getConfig());
        if (config == null) {
            return NodeExecutionResult.builder().success(false).errorMessage("Invalid workflow config").build();
        }

        String workflowId = (String) config.get("workflowId");
        if (workflowId == null || workflowId.isBlank()) {
            return NodeExecutionResult.builder().success(false).errorMessage("No workflowId configured").build();
        }

        try {
            @SuppressWarnings("unchecked")
            Map<String, String> configParams = (Map<String, String>) config.getOrDefault("params", Map.of());
            Map<String, Object> params = new HashMap<>(configParams);
            params.put("phone_number", context.getPhoneNumber());
            params.put("instituteId", context.getInstituteId());
            if (context.getUserId() != null) params.put("userId", context.getUserId());
            if (context.getMessageText() != null) params.put("messageText", context.getMessageText());

            String endpoint = "/admin-core-service/internal/workflow/run?wfId=" + workflowId;

            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                    clientName, HttpMethod.POST.name(), adminCoreServiceUrl, endpoint, params);

            boolean success = response.getStatusCode().is2xxSuccessful();
            log.info("Workflow {} triggered: success={}", workflowId, success);

            return NodeExecutionResult.builder()
                    .success(success)
                    .outputVariables(Map.of("workflowResult", success ? "ok" : "failed"))
                    .build();

        } catch (Exception e) {
            log.error("Failed to trigger workflow {}: {}", workflowId, e.getMessage());
            return NodeExecutionResult.builder()
                    .success(false)
                    .errorMessage("Workflow call failed: " + e.getMessage())
                    .build();
        }
    }

    private Map<String, Object> parseConfig(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return null;
        }
    }
}
