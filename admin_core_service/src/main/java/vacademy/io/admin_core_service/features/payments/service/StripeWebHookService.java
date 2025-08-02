package vacademy.io.admin_core_service.features.payments.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.Invoice;
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
        log.info("Received Stripe webhook");
        System.out.println(sigHeader);
        System.out.println(payload);
        String webhookId = null;

        try {
            webhookId = webHookService.saveWebhook(PaymentGateway.STRIPE.name(), payload);

            String instituteId = extractInstituteId(payload);
            if (instituteId == null) {
                log.warn("Missing or invalid institute_id");
                return ResponseEntity.status(400).body("Missing or invalid institute_id in metadata");
            }

            String webhookSecret = getWebhookSecret(instituteId);
            System.out.println(instituteId);
            if (webhookSecret == null) {
                log.warn("Webhook secret not found for institute: {}", instituteId);
                return ResponseEntity.status(404).body("Unknown institute");
            }

            Event event = verifySignature(payload, sigHeader, webhookSecret, instituteId);
            if (event == null) {
                return ResponseEntity.status(400).body("Invalid signature");
            }

            Invoice invoice = extractInvoiceFromPayload(event);

            // Extract orderId from line item metadata (not top-level invoice metadata)
            String orderId = null;
            if (invoice.getLines() != null &&
                    invoice.getLines().getData() != null &&
                    !invoice.getLines().getData().isEmpty()) {
                orderId = invoice.getLines().getData().get(0).getMetadata().get("orderId");
            }

            if (orderId == null) {
                log.warn("Missing orderId in line item metadata");
                return ResponseEntity.status(400).body("Missing orderId in invoice line item metadata");
            }

            String paymentStatus = invoice.getPaid()
                    ? PaymentStatusEnum.PAID.name()
                    : PaymentStatusEnum.FAILED.name();

            if (!invoice.getPaid() && invoice.getStatus() != null) {
                if (invoice.getStatus().equalsIgnoreCase("open") || invoice.getStatus().equalsIgnoreCase("draft")) {
                    paymentStatus = PaymentStatusEnum.PAYMENT_PENDING.name();
                }
            }

            webHookService.updateWebHook(webhookId, PaymentGateway.STRIPE.name(), event.getType(), orderId);
            paymentLogService.updatePaymentLog(orderId, paymentStatus);
            webHookService.updateWebHookStatus(webhookId, WebHookStatus.PROCESSED);

            return ResponseEntity.ok("Webhook processed successfully");

        } catch (Exception ex) {
            log.error("Error while processing webhook", ex);
            ex.printStackTrace();
            if (webhookId != null) {
                webHookService.updateWebHookStatus(webhookId, WebHookStatus.FAILED);
            }
            return ResponseEntity.status(500).body("Internal error during webhook processing");
        }
    }

    private String extractInstituteId(String payload) {
        try {
            JsonNode payloadJson = objectMapper.readTree(payload);
            JsonNode metadata = payloadJson.at("/data/object/metadata");
            if (metadata != null && metadata.has("instituteId")) {
                return metadata.get("instituteId").asText();
            }
        } catch (Exception e) {
            log.error("Failed to extract instituteId from payload", e);
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
            log.info("Webhook signature verified for institute {}", instituteId);
            return event;
        } catch (SignatureVerificationException e) {
            e.printStackTrace();
            log.error("Signature verification failed for institute {}", instituteId, e);
            return null;
        }
    }

    private Invoice extractInvoiceFromPayload(Event event) {
        if (!event.getType().startsWith("invoice.")) {
            log.warn("Unhandled event type received: {}", event.getType());
            throw new VacademyException("Unhandled event type: " + event.getType());
        }

        try {
            JsonNode eventJson = objectMapper.readTree(event.toJson());
            String invoiceId = eventJson.at("/data/object/invoice").asText();

            if (invoiceId == null || invoiceId.isEmpty()) {
                invoiceId = eventJson.at("/data/object/id").asText(); // fallback
            }

            if (invoiceId == null || invoiceId.isEmpty()) {
                throw new VacademyException("Invoice ID not found in event");
            }

            Invoice invoice = Invoice.retrieve(invoiceId);
            log.info("Retrieved full invoice from Stripe for ID {}", invoiceId);
            return invoice;

        } catch (Exception e) {
            e.printStackTrace();
            log.error("Failed to retrieve full invoice from Stripe", e);
            throw new VacademyException("Failed to retrieve full invoice from Stripe");
        }
    }
}
