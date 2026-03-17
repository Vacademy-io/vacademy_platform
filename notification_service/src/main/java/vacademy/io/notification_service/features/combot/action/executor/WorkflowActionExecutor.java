package vacademy.io.notification_service.features.combot.action.executor;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.notification_service.features.combot.action.dto.FlowAction;
import vacademy.io.notification_service.features.combot.action.dto.FlowContext;
import vacademy.io.notification_service.features.combot.action.dto.WorkflowAction;

import java.util.HashMap;
import java.util.Map;

/**
 * Executor for WORKFLOW actions.
 * Calls admin-core-service to trigger a workflow.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WorkflowActionExecutor implements FlowActionExecutor {

    @Value("${admin.core.service.baseurl:http://admin-core-service.vacademy.svc.cluster.local:8072}")
    private String adminCoreServiceBaseUrl;

    @Value("${spring.application.name:notification_service}")
    private String clientName;

    private final InternalClientUtils internalClientUtils;

    @Override
    public boolean canHandle(FlowAction action) {
        return action instanceof WorkflowAction;
    }

    @Override
    public void execute(FlowAction action, FlowContext context) {
        WorkflowAction workflowAction = (WorkflowAction) action;

        log.info("Executing workflow action: workflowId={}, phone={}, instituteId={}",
                workflowAction.getWorkflowId(),
                context.getPhoneNumber(),
                context.getInstituteId());

        try {
            // Build parameters for workflow
            Map<String, Object> workflowParams = buildWorkflowParams(workflowAction, context);

            // Call admin-core-service workflow API
            String endpoint = "/admin-core-service/internal/workflow/run?wfId=" + workflowAction.getWorkflowId();

            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                    clientName,
                    HttpMethod.POST.name(),
                    adminCoreServiceBaseUrl,
                    endpoint,
                    workflowParams);

            log.info("Workflow triggered successfully: workflowId={}, response={}",
                    workflowAction.getWorkflowId(),
                    response.getStatusCode());

        } catch (Exception e) {
            log.error("Failed to execute workflow action: workflowId={}, error={}",
                    workflowAction.getWorkflowId(), e.getMessage(), e);
        }
    }

    /**
     * Build workflow parameters from action config and context.
     */
    private Map<String, Object> buildWorkflowParams(WorkflowAction action, FlowContext context) {
        Map<String, Object> params = new HashMap<>();

        // Add default context fields
        params.put("phone_number", context.getPhoneNumber());
        params.put("instituteId", context.getInstituteId());
        params.put("businessChannelId", context.getBusinessChannelId());
        params.put("messageText", context.getMessageText());
        params.put("package_session_id",context.getPackageSessionId());
        params.put("destination_package_session_id",context.getDestinationPackageSessionId());

        if (context.getUserId() != null) {
            params.put("userId", context.getUserId());
        }

        // Add user details if available
        if (context.getUserDetails() != null) {
            params.put("userDetails", context.getUserDetails());
        }

        // Add explicit params from action config (override defaults)
        if (action.getParams() != null) {
            for (Map.Entry<String, String> entry : action.getParams().entrySet()) {
                String value = resolveParamValue(entry.getValue(), context);
                params.put(entry.getKey(), value);
            }
        }

        return params;
    }

    /**
     * Resolve parameter value - supports {{fieldName}} placeholders.
     */
    private String resolveParamValue(String value, FlowContext context) {
        if (value == null)
            return null;

        // Handle {{phoneNumber}}, {{userId}}, etc.
        if (value.startsWith("{{") && value.endsWith("}}")) {
            String fieldName = value.substring(2, value.length() - 2);
            return switch (fieldName) {
                case "phoneNumber" -> context.getPhoneNumber();
                case "userId" -> context.getUserId();
                case "instituteId" -> context.getInstituteId();
                case "messageText" -> context.getMessageText();
                case "businessChannelId" -> context.getBusinessChannelId();
                default -> value; // Return as-is if unknown
            };
        }

        return value;
    }
}
