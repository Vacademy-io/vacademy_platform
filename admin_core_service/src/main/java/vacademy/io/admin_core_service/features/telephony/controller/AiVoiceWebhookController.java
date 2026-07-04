package vacademy.io.admin_core_service.features.telephony.controller;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.telephony.core.AiCallOutcomeProcessor;
import vacademy.io.admin_core_service.features.telephony.core.AiCallingConfigService;
import vacademy.io.admin_core_service.features.telephony.core.AiVoiceWebhookService;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * End-of-call webhook receiver for AI-voice providers. Public (covered by the
 * {@code /v1/telephony/webhook/**} allow-list). Providers POST one report after
 * each call ends.
 *
 *   POST /admin-core-service/v1/telephony/webhook/aavtaar?instituteId=&token=   (stable Aavtaar URL)
 *   POST /admin-core-service/v1/telephony/webhook/ai-voice/{provider}?instituteId=&token=  (any provider)
 *
 * Provider-neutral: the body is parsed by the registered {@code AiCallReportParser}
 * for the resolved provider. Never throws past the boundary; always 2xx for an
 * accepted body (providers retry-storm on non-2xx) except 401 for a bad token.
 */
@RestController
@RequestMapping("/admin-core-service/v1/telephony/webhook")
@RequiredArgsConstructor
public class AiVoiceWebhookController {

    private static final Logger log = LoggerFactory.getLogger(AiVoiceWebhookController.class);

    private final AiVoiceWebhookService service;
    private final AiCallOutcomeProcessor outcomeProcessor;
    private final AiCallingConfigService configService;

    @PostMapping("/aavtaar")
    public ResponseEntity<Map<String, Object>> aavtaar(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "token", required = false) String token,
            @RequestHeader(value = "X-Webhook-Token", required = false) String headerToken,
            @RequestBody(required = false) String body) {
        return receive(ProviderType.AAVTAAR, instituteId, token, headerToken, body);
    }

    @PostMapping("/ai-voice/{provider}")
    public ResponseEntity<Map<String, Object>> generic(
            @PathVariable String provider,
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "token", required = false) String token,
            @RequestHeader(value = "X-Webhook-Token", required = false) String headerToken,
            @RequestBody(required = false) String body) {
        return receive(provider == null ? null : provider.toUpperCase(), instituteId, token, headerToken, body);
    }

    private ResponseEntity<Map<String, Object>> receive(String provider, String instituteId,
                                                        String token, String headerToken, String body) {
        if (instituteId == null || instituteId.isBlank()) {
            return envelope(HttpStatus.BAD_REQUEST, false, "instituteId query param is required.", null);
        }
        if (!authorized(instituteId, token, headerToken)) {
            return envelope(HttpStatus.UNAUTHORIZED, false, "Unauthorized. Invalid or missing token.", null);
        }
        if (body == null || body.isBlank()) {
            return envelope(HttpStatus.BAD_REQUEST, false, "Empty request body.", null);
        }

        try {
            AiVoiceWebhookService.IngestResult r = service.ingest(provider, instituteId, body);
            log.info("ai-voice webhook: provider={} institute={} received={} updated={} failed={}",
                    provider, instituteId, r.received(), r.updated(), r.failed());

            // Landing committed — bind to lead, promote to call log, assign-or-retry.
            // Best-effort: a failure here never fails the webhook.
            for (String resultId : r.savedIds()) {
                try {
                    outcomeProcessor.process(resultId);
                } catch (Exception ex) {
                    log.error("ai-voice webhook: outcome processing failed for result {}", resultId, ex);
                }
            }

            Map<String, Object> data = new LinkedHashMap<>();
            data.put("received", r.received());
            data.put("updated", r.updated());
            data.put("failed", r.failed());
            return envelope(HttpStatus.OK, true, "Call data received.", data);
        } catch (Exception e) {
            log.error("ai-voice webhook: unexpected failure provider={} institute={}", provider, instituteId, e);
            return envelope(HttpStatus.OK, true, "Received.", null);
        }
    }

    private boolean authorized(String instituteId, String token, String headerToken) {
        // ONE source of truth (institute secret else the global property), shared with
        // VoiceBotInternalController.callContext — so the token our own voice bot
        // presents is provably the token checked here. Reading different sources
        // 401-dropped every VACADEMY_AI report on envs with a global secret set.
        String secret = configService.getEffectiveWebhookSecret(instituteId);
        if (secret == null || secret.isBlank()) {
            log.warn("ai-voice webhook: no webhook secret configured for institute {} — accepting unauthenticated POST", instituteId);
            return true;
        }
        return secret.equals(token) || secret.equals(headerToken);
    }

    private ResponseEntity<Map<String, Object>> envelope(HttpStatus status, boolean ok, String msg, Object data) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("isSuccess", ok);
        body.put("httpStatus", status.value());
        body.put("message", msg);
        if (data != null) body.put("data", data);
        return ResponseEntity.status(status).body(body);
    }
}
