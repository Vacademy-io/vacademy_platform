package vacademy.io.notification_service.features.combot.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.notification_service.features.combot.constants.CombotWebhookKeys;
import vacademy.io.notification_service.features.combot.service.CombotWebhookService;

import java.util.*;

/**
 * Robust Com.bot / WhatsApp webhook controller
 * - Accepts Com.bot simple format (message + response)
 * - Accepts WhatsApp Cloud format (entry -> changes -> value -> (value) -> statuses/messages)
 */
@RestController
@RequestMapping("/notification-service/v1/webhook")
@RequiredArgsConstructor
@Slf4j
public class CombotWebhookController {

    private final CombotWebhookService webhookService;
    private final ObjectMapper objectMapper;

    @Value("${combot.webhook.verify.token:vacademy_webhook_secret}")
    private String webhookVerifyToken;

    @GetMapping("/whatsapp")
    public ResponseEntity<String> verifyWebhook(@RequestParam Map<String, String> params) {
        log.info("Webhook verification request received: {}", params);

        if (params.containsKey(CombotWebhookKeys.CHALLANGE)) {
            return ResponseEntity.ok(params.get(CombotWebhookKeys.CHALLANGE));
        }
        if (params.containsKey(CombotWebhookKeys.CHALLENGE)) {
            return ResponseEntity.ok(params.get(CombotWebhookKeys.CHALLENGE));
        }
        if (params.containsKey(CombotWebhookKeys.HUB_CHALLENGE)) {
            String challenge = params.get(CombotWebhookKeys.HUB_CHALLENGE);
            String mode = params.get(CombotWebhookKeys.HUB_MODE);
            String token = params.get(CombotWebhookKeys.HUB_VERIFY_TOKEN);
            if ("subscribe".equals(mode) && webhookVerifyToken.equals(token)) {
                return ResponseEntity.ok(challenge);
            } else {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Meta verification failed");
            }
        }
        return ResponseEntity.badRequest().body("Invalid verification request");
    }

    @PostMapping("/whatsapp")
    public ResponseEntity<String> handleWebhook(@RequestBody Map<String, Object> payload) {
        try {
            log.info("Webhook received");
            log.debug("Payload: {}", objectMapper.writeValueAsString(payload));

            if (payload.containsKey(CombotWebhookKeys.MESSAGE) && payload.containsKey(CombotWebhookKeys.RESPONSE)) {
                handleCombotSimplePayload(payload);
                return ResponseEntity.ok("Processed Com.bot simple webhook");
            }

            Object entriesObj = payload.get(CombotWebhookKeys.ENTRY);
            if (entriesObj instanceof List) {
                List<?> entries = (List<?>) entriesObj;
                for (Object eObj : entries) {
                    if (!(eObj instanceof Map)) continue;
                    Map<String, Object> entry = (Map<String, Object>) eObj;
                    Object changesObj = entry.get(CombotWebhookKeys.CHANGES);
                    if (!(changesObj instanceof List)) continue;
                    List<?> changes = (List<?>) changesObj;

                    for (Object cObj : changes) {
                        if (!(cObj instanceof Map)) continue;
                        Map<String, Object> change = (Map<String, Object>) cObj;

                        // Outer value may be a map with key "value" whose value is the real payload
                        Map<String, Object> resolvedValue = resolveNestedValueMap(change);
                        if (resolvedValue == null) {
                            log.warn("Unable to resolve nested value for change: {}", change);
                            continue;
                        }

                        // 1) statuses (sent/delivered/read/failed)
                        if (containsStatuses(resolvedValue)) {
                            log.debug("Detected statuses block, delegating to service");
                            webhookService.processMessageStatusFromWebhook(resolvedValue, entry);
                            continue;
                        }

                        // 2) messages (incoming)
                        if (containsMessages(resolvedValue)) {
                            log.debug("Detected messages block, delegating to service");
                            webhookService.processIncomingMessageFromWebhook(resolvedValue, entry);
                            continue;
                        }

                        // 3) fallback: sometimes 'message' key exists at change level (rare)
                        if (change.containsKey("message")) {
                            Object msgObj = change.get("message");
                            if (msgObj instanceof Map) {
                                Map<String, Object> m = (Map<String, Object>) msgObj;
                                String status = (String) m.get("message_status");
                                // Try to extract messageId and phone from response block if present
                                Map<String, Object> response = (Map<String, Object>) payload.get("response");
                                String phone = null;
                                String messageId = null;
                                try {
                                    if (response != null) {
                                        Object contactsObj = response.get(CombotWebhookKeys.CONTACTS);
                                        if (contactsObj instanceof List && !((List<?>) contactsObj).isEmpty()) {
                                            Map<?,?> contact0 = (Map<?,?>) ((List<?>) contactsObj).get(0);
                                            phone = (String) contact0.get(CombotWebhookKeys.WA_ID);
                                        }
                                        Object msgsObj = response.get(CombotWebhookKeys.MESSAGES);
                                        if (msgsObj instanceof List && !((List<?>) msgsObj).isEmpty()) {
                                            Map<?,?> msg0 = (Map<?,?>) ((List<?>) msgsObj).get(0);
                                            messageId = (String) msg0.get(CombotWebhookKeys.MESSAGE_ID);
                                        }
                                    }
                                } catch (Exception ex) {
                                    log.debug("Failed to extract messageId/phone from response", ex);
                                }
                                webhookService.processCombotStatusWebhook(messageId, phone, status, payload);
                                continue;
                            }
                        }

                        log.warn("Unhandled change block: keys={} (resolvedValue keys={})",
                                change.keySet(), resolvedValue.keySet());
                    } // end changes loop
                } // end entries loop
            }

            return ResponseEntity.ok("Webhook processed");

        } catch (Exception ex) {
            log.error("Error processing webhook", ex);
            return ResponseEntity.ok("Error handled");
        }
    }

    // -------------------------
    // Helper: handle Com.bot simple format payload
    // -------------------------
    private void handleCombotSimplePayload(Map<String, Object> payload) {
        try {
            Map<String, Object> message = (Map<String, Object>) payload.get(CombotWebhookKeys.MESSAGE);
            Map<String, Object> response = (Map<String, Object>) payload.get(CombotWebhookKeys.RESPONSE);

            String status = (String) message.get(CombotWebhookKeys.MESSAGE_STATUS);
            String messageId = null;
            String phone = null;

            if (response != null) {
                Object contactsObj = response.get(CombotWebhookKeys.CONTACTS);
                if (contactsObj instanceof List && !((List<?>) contactsObj).isEmpty()) {
                    Map<?,?> contact0 = (Map<?,?>) ((List<?>) contactsObj).get(0);
                    phone = (String) contact0.get(CombotWebhookKeys.WA_ID);
                }
                Object msgsObj = response.get(CombotWebhookKeys.MESSAGES);
                if (msgsObj instanceof List && !((List<?>) msgsObj).isEmpty()) {
                    Map<?,?> msg0 = (Map<?,?>) ((List<?>) msgsObj).get(0);
                    messageId = (String) msg0.get(CombotWebhookKeys.MESSAGE_ID);
                }
            }

            webhookService.processCombotStatusWebhook(messageId, phone, status, payload);

        } catch (Exception e) {
            log.error("Error handling Com.bot simple payload", e);
        }
    }

    // -------------------------
    // Helper: find the inner value map robustly
    // -------------------------
    @SuppressWarnings("unchecked")
    private Map<String, Object> resolveNestedValueMap(Map<String, Object> change) {
        if (change == null) return null;

        // change.get("value") sometimes returns a map where outerValue.get("value") is the real payload.
        Object outerValObj = change.get(CombotWebhookKeys.VALUE);
        if (outerValObj instanceof Map) {
            Map<String, Object> outerVal = (Map<String, Object>) outerValObj;

            // if outerVal itself contains keys like "messaging_product"/"statuses"/"messages", we can use it directly
            if (outerVal.containsKey(CombotWebhookKeys.MESSAGING_PRODUCT) || outerVal.containsKey(CombotWebhookKeys.STATUSES) || outerVal.containsKey(CombotWebhookKeys.MESSAGES)) {
                return outerVal;
            }

            // otherwise the payload is nested: outerVal.get("value") contains the real map
            Object innerValObj = outerVal.get(CombotWebhookKeys.VALUE);
            if (innerValObj instanceof Map) {
                return (Map<String, Object>) innerValObj;
            }

            // fallback: perhaps outerVal already is the inner, return it
            return outerVal;
        }

        return null;
    }

    private boolean containsStatuses(Map<String, Object> valueMap) {
        if (valueMap == null) return false;
        Object statusesObj = valueMap.get(CombotWebhookKeys.STATUSES);
        return statusesObj instanceof List && !((List<?>) statusesObj).isEmpty();
    }

    private boolean containsMessages(Map<String, Object> valueMap) {
        if (valueMap == null) return false;
        Object messagesObj = valueMap.get(CombotWebhookKeys.MESSAGES);
        return messagesObj instanceof List && !((List<?>) messagesObj).isEmpty();
    }

    @PostMapping("/combot/test")
    public ResponseEntity<String> testWebhook(@RequestBody Map<String, Object> testPayload) {
        try {
            // reuse main handler logic for testing
            handleWebhook(testPayload);
            return ResponseEntity.ok("Test processed");
        } catch (Exception e) {
            log.error("Error in testWebhook", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Test error");
        }
    }
}
