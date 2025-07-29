package vacademy.io.admin_core_service.features.payments.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.net.Webhook;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.service.InstitutePaymentGatewayMappingService;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentLogService;
import vacademy.io.common.payment.enums.PaymentGateway;

import java.util.Map;

@Slf4j
@Service
public class StripeWebHookService {

    @Autowired
    private InstitutePaymentGatewayMappingService institutePaymentGatewayMappingService;

    @Autowired
    private WebHookService webHookService;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    public PaymentLogService paymentLogService;

    public ResponseEntity<String> processWebHook(String payload, String sigHeader) {
        log.info("Received Stripe webhook");

        String instituteId = extractInstituteId(payload);
        if (instituteId == null) {
            return ResponseEntity.status(400).body("Missing or invalid institute_id in metadata");
        }

        String webhookSecret = getWebhookSecret(instituteId);
        if (webhookSecret == null) {
            return ResponseEntity.status(404).body("Unknown institute");
        }

        Event event = verifySignature(payload, sigHeader, webhookSecret, instituteId);
        if (event == null) {
            return ResponseEntity.status(400).body("Invalid signature");
        }

        try {
            JsonNode object = objectMapper.readTree(event.getData().getObject().toJson());
            String userId = object.get("metadata").get("user_id").asText(null);
            String userPlanId = object.get("metadata").get("user_plan_id").asText(null);
            String paymentStatus = getPaymentStatus(object);

            // Save payment logs, handle payment status, etc.
            log.info("Processed webhook event: {}, User: {}, Plan: {}, Status: {}", event.getId(), userId, userPlanId, paymentStatus);

            return ResponseEntity.ok("Webhook processed");
        } catch (Exception e) {
            log.error("Error while processing Stripe event data", e);
            return ResponseEntity.status(500).body("Error processing event");
        }
    }

    private String extractInstituteId(String payload) {
        try {
            JsonNode payloadJson = objectMapper.readTree(payload);
            JsonNode dataObject = payloadJson.get("data").get("object");
            if (dataObject.has("metadata") && dataObject.get("metadata").has("instituteId")) {
                return dataObject.get("metadata").get("instituteId").asText();
            }
        } catch (Exception e) {
            log.error("Failed to extract institute_id", e);
        }
        return null;
    }

    private String getWebhookSecret(String instituteId) {
        Map<String, Object> gatewayData = institutePaymentGatewayMappingService
                .findInstitutePaymentGatewaySpecifData(PaymentGateway.STRIPE.name(), instituteId);
        return gatewayData != null ? (String) gatewayData.get("webhookSecret") : null;
    }

    private Event verifySignature(String payload, String sigHeader, String secret, String instituteId) {
        try {
            Event event = Webhook.constructEvent(payload, sigHeader, secret);
            log.info("Webhook verified for institute {}", instituteId);
            return event;
        } catch (SignatureVerificationException e) {
            log.error("Invalid signature for webhook from institute {}", instituteId, e);
            return null;
        }
    }

    private String getPaymentStatus(JsonNode object) {
        if (object.has("status")) {
            return object.get("status").asText();
        } else if (object.has("payment_status")) {
            return object.get("payment_status").asText();
        }
        return "unknown";
    }
}
