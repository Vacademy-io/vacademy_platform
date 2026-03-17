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
import vacademy.io.notification_service.features.combot.action.dto.VerificationAction;

import java.util.HashMap;
import java.util.Map;

/**
 * Executor for VERIFICATION actions.
 * Calls admin-core-service internal verification API when user clicks VERIFY.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class VerificationActionExecutor implements FlowActionExecutor {

    @Value("${admin.core.service.baseurl:http://admin-core-service.vacademy.svc.cluster.local:8072}")
    private String adminCoreServiceBaseUrl;

    @Value("${spring.application.name:notification_service}")
    private String clientName;

    private final InternalClientUtils internalClientUtils;

    @Override
    public boolean canHandle(FlowAction action) {
        return action instanceof VerificationAction;
    }

    @Override
    public void execute(FlowAction action, FlowContext context) {
        VerificationAction verificationAction = (VerificationAction) action;

        log.info("Executing verification action: type={}, phone={}, instituteId={}",
                verificationAction.getVerificationType(),
                context.getPhoneNumber(),
                context.getInstituteId());

        try {
            // Call admin-core-service internal verification API
            String endpoint = String.format(
                    "/admin-core-service/internal/verification/complete?phoneNumber=%s&instituteId=%s",
                    context.getPhoneNumber(),
                    context.getInstituteId());

            Map<String, Object> requestBody = new HashMap<>();
            // Body is optional for this endpoint, but we can add context if needed

            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                    clientName,
                    HttpMethod.POST.name(),
                    adminCoreServiceBaseUrl,
                    endpoint,
                    requestBody);

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Verification completed successfully: phone={}, response={}",
                        context.getPhoneNumber(),
                        response.getBody());

                // Optionally send confirmation message to user
                sendVerificationConfirmation(context);
            } else {
                log.warn("Verification failed: phone={}, status={}, response={}",
                        context.getPhoneNumber(),
                        response.getStatusCode(),
                        response.getBody());
            }

        } catch (Exception e) {
            log.error("Failed to execute verification action: phone={}, error={}",
                    context.getPhoneNumber(), e.getMessage(), e);
        }
    }

    /**
     * Send confirmation message to user after successful verification.
     * This can be implemented to send a WhatsApp template or message.
     */
    private void sendVerificationConfirmation(FlowContext context) {
        // TODO: Implement sending confirmation template
        // This could use CombotWebhookService.sendAutoReply() or similar
        log.info("Verification confirmation would be sent to phone={}", context.getPhoneNumber());
    }
}
