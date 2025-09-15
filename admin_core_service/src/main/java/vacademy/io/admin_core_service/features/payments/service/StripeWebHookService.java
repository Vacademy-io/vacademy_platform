package vacademy.io.admin_core_service.features.payments.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.PaymentIntent;
import com.stripe.model.StripeObject;
import com.stripe.net.Webhook;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.service.InstitutePaymentGatewayMappingService;
import vacademy.io.admin_core_service.features.payments.enums.WebHookStatus;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentLogService;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.payment.enums.PaymentGateway;
import vacademy.io.common.payment.enums.PaymentStatusEnum;

import java.util.Map;
import java.util.Optional;

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
    private PaymentLogService paymentLogService;

    public ResponseEntity<String> processWebHook(String payload, String sigHeader) {
        log.info("Received Stripe webhook payload.");
        String webhookId = null;

        try {
            // Log the incoming webhook for auditing purposes
            webhookId = webHookService.saveWebhook(PaymentGateway.STRIPE.name(), payload);

            String instituteId = extractInstituteId(payload);
            if (instituteId == null) {
                log.warn("Webhook ignored: Missing or invalid 'instituteId' in metadata.");
                updateWebhookStatus(webhookId, WebHookStatus.FAILED, "Missing instituteId in metadata");
                // Return 200 OK to Stripe to prevent retries for irrelevant events.
                return ResponseEntity.ok("Webhook ignored: No instituteId found.");
            }

            String webhookSecret = getWebhookSecret(instituteId);
            if (webhookSecret == null) {
                log.error("Webhook secret not found for institute: {}", instituteId);
                updateWebhookStatus(webhookId, WebHookStatus.FAILED, "Webhook secret not found");
                return ResponseEntity.status(404).body("Unknown institute");
            }

            Event event = verifySignature(payload, sigHeader, webhookSecret);
            if (event == null) {
                updateWebhookStatus(webhookId, WebHookStatus.FAILED, "Invalid signature");
                return ResponseEntity.status(400).body("Invalid signature");
            }

            log.info("Processing Stripe event: {} for institute: {}", event.getType(), instituteId);

            // Extract the PaymentIntent object from the event payload
            PaymentIntent paymentIntent = extractPaymentIntentFromEvent(event);
            if (paymentIntent == null) {
                // This could be an event we don't handle, like `customer.created`. This is normal.
                log.info("Event {} does not contain a PaymentIntent object. Acknowledging and skipping.", event.getType());
                updateWebhookStatus(webhookId, WebHookStatus.PROCESSED, "Event does not contain a PaymentIntent, skipped.");
                return ResponseEntity.ok("Webhook acknowledged, no action taken.");
            }

            String orderId = paymentIntent.getMetadata().get("orderId");
            if (orderId == null) {
                log.error("Missing 'orderId' in PaymentIntent metadata for pi_id: {}", paymentIntent.getId());
                updateWebhookStatus(webhookId, WebHookStatus.FAILED, "Missing orderId in metadata");
                return ResponseEntity.status(400).body("Missing orderId in metadata");
            }

            // Update our internal records with the final event type and order ID
            webHookService.updateWebHook(webhookId, payload, orderId, event.getType());

            // Handle the event based on its type
            switch (event.getType()) {
                case "payment_intent.succeeded":
                    log.info("PaymentIntent succeeded for orderId: {}", orderId);
                    paymentLogService.updatePaymentLog(orderId, PaymentStatusEnum.PAID.name(), instituteId);
                    break;
                case "payment_intent.payment_failed":
                    log.warn("PaymentIntent failed for orderId: {}", orderId);
                    paymentLogService.updatePaymentLog(orderId, PaymentStatusEnum.FAILED.name(), instituteId);
                    break;
                default:
                    log.info("Unhandled but valid event type: {}. Acknowledging.", event.getType());
                    break;
            }

            updateWebhookStatus(webhookId, WebHookStatus.PROCESSED, null);
            return ResponseEntity.ok("Webhook processed successfully");

        } catch (Exception ex) {
            log.error("Unhandled error during webhook processing", ex);
            if (webhookId != null) {
                updateWebhookStatus(webhookId, WebHookStatus.FAILED, ex.getMessage());
            }
            return ResponseEntity.status(500).body("Internal server error");
        }
    }

    private void updateWebhookStatus(String webhookId, WebHookStatus status, String notes) {
        if (webhookId != null) {
            webHookService.updateWebHookStatus(webhookId, status, notes);
        }
    }

    /**
     * UPDATED: Extracts instituteId from PaymentIntent or Invoice metadata.
     */
    private String extractInstituteId(String payload) {
        try {
            JsonNode dataObject = objectMapper.readTree(payload).at("/data/object");
            JsonNode metadataNode = dataObject.get("metadata");
            if (metadataNode != null && metadataNode.has("instituteId")) {
                return metadataNode.get("instituteId").asText();
            }
        } catch (Exception e) {
            log.error("Failed to parse payload or extract instituteId", e);
        }
        return null;
    }

    private String getWebhookSecret(String instituteId) {
        Map<String, Object> gatewayData = institutePaymentGatewayMappingService.findInstitutePaymentGatewaySpecifData(PaymentGateway.STRIPE.name(), instituteId);
        return gatewayData != null ? (String) gatewayData.get("webhookSecret") : null;
    }

    private Event verifySignature(String payload, String sigHeader, String secret) {
        try {
            return Webhook.constructEvent(payload, sigHeader, secret);
        } catch (SignatureVerificationException e) {
            log.error("Stripe signature verification failed.", e);
            return null;
        }
    }

    /**
     * NEW METHOD: Extracts a PaymentIntent object directly from the webhook event payload.
     * This avoids making an extra API call and is more efficient.
     */
    private PaymentIntent extractPaymentIntentFromEvent(Event event) {
        if (!event.getType().startsWith("payment_intent.")) {
            return null; // Not a payment intent event
        }

        Optional<StripeObject> stripeObjectOpt = event.getDataObjectDeserializer().getObject();
        if (stripeObjectOpt.isPresent() && stripeObjectOpt.get() instanceof PaymentIntent) {
            return (PaymentIntent) stripeObjectOpt.get();
        } else {
            log.error("Could not deserialize PaymentIntent from event data for event type: {}", event.getType());
            throw new VacademyException("Webhook data object is not a valid PaymentIntent.");
        }
    }
}
