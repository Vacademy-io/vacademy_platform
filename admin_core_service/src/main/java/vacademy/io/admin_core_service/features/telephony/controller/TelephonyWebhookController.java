package vacademy.io.admin_core_service.features.telephony.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.telephony.core.CallEventBus;
import vacademy.io.admin_core_service.features.telephony.core.CallLogService;
import vacademy.io.admin_core_service.features.telephony.core.RecordingPersistenceService;
import vacademy.io.admin_core_service.features.telephony.core.TelephonyConfigCache;
import vacademy.io.admin_core_service.features.telephony.core.TelephonyProviderRegistry;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyCallLog;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyCallLogRepository;
import vacademy.io.admin_core_service.features.telephony.spi.CallWebhookHandler;
import vacademy.io.admin_core_service.features.telephony.spi.dto.InboundEnvelope;
import vacademy.io.admin_core_service.features.telephony.spi.dto.NormalizedCallEvent;
import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderSecrets;

/**
 * Public — registered in ApplicationSecurityConfig under ALLOWED_PATHS so
 * Exotel (and friends) can POST without a JWT. Auth is the shared-secret
 * token on ?token=, validated by the matching provider handler.
 *
 * Hot path: 3–5 callbacks per call. Heavy lift work (recording fetch +
 * media_service upload + S3 PUT + TimelineEvent write) is fully off the
 * webhook thread via @Async — Exotel times webhooks out at ~5s.
 *
 * Avoids DB reads where possible by routing through TelephonyConfigCache
 * (5-min Caffeine TTL): saves one SELECT and three AES-GCM decrypts per hit.
 *
 * Never throws past the boundary — providers retry aggressively on non-2xx,
 * which would cause a thundering-herd. Always return 2xx for "processed",
 * 401 for "invalid auth", 410 for "no such call".
 */
@RestController
@RequestMapping("/admin-core-service/v1/telephony/webhook")
public class TelephonyWebhookController {

    private static final Logger log = LoggerFactory.getLogger(TelephonyWebhookController.class);

    @Autowired private TelephonyCallLogRepository callLogRepo;
    @Autowired private TelephonyConfigCache configCache;
    @Autowired private TelephonyProviderRegistry registry;
    @Autowired private CallLogService callLogService;
    @Autowired private CallEventBus eventBus;
    @Autowired private RecordingPersistenceService recordingService;

    @RequestMapping(value = "/status", method = { RequestMethod.POST, RequestMethod.GET })
    public ResponseEntity<Void> status(
            @RequestParam("provider") String providerType,
            @RequestParam(value = "corr", required = false) String correlationId,
            HttpServletRequest req,
            @RequestBody(required = false) String body) {

        // Plivo echoes the callback URL's query params INTO its POST body, and
        // Spring joins duplicated params with a comma ("PLIVO,PLIVO") — which made
        // every Plivo callback 410 on findById("id,id"). Keep the first value.
        providerType = firstValue(providerType);
        correlationId = firstValue(correlationId);

        if (correlationId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }

        TelephonyCallLog row = callLogRepo.findById(correlationId).orElse(null);
        if (row == null) {
            log.warn("telephony webhook: no row for corr={} provider={}", correlationId, providerType);
            return ResponseEntity.status(HttpStatus.GONE).build();
        }

        TelephonyConfigCache.Resolved resolved = configCache.get(row.getInstituteId()).orElse(null);
        if (resolved == null) return ResponseEntity.status(HttpStatus.GONE).build();

        // The authoritative provider is the institute's STORED config, not the
        // attacker-controllable ?provider= param. Reject a mismatch and resolve
        // the handler from config (also makes provider-type case-insensitive).
        String configProvider = resolved.getConfig().getProviderType();
        if (configProvider != null && providerType != null
                && !configProvider.equalsIgnoreCase(providerType.trim())) {
            log.warn("telephony webhook: ?provider={} != configured {} for corr={}",
                    providerType, configProvider, correlationId);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
        CallWebhookHandler handler;
        try {
            handler = registry.handler(configProvider);
        } catch (Exception e) {
            log.warn("telephony webhook: no handler for configured provider {}", configProvider);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }

        InboundEnvelope env = InboundEnvelope.from(req, body);
        if (!handler.verify(env, ProviderSecrets.builder()
                .webhookToken(resolved.getWebhookToken())
                .secrets(resolved.getCredentials().getSecrets())
                .build())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            NormalizedCallEvent ev = handler.parse(env);
            log.info("telephony webhook: corr={} status={} terminal={} hasRecording={} provider={}",
                    row.getId(),
                    ev.getStatus(),
                    ev.isTerminal(),
                    ev.getRecordingUrl() != null,
                    providerType);
            callLogService.applyEvent(row, ev);
            eventBus.publish(row.getId(), ev);
            if (ev.isTerminal() && ev.getRecordingUrl() != null) {
                recordingService.persistAsync(row.getId());
            }
        } catch (Exception e) {
            log.error("telephony webhook: parse/apply failed for call {}", row.getId(), e);
            // 2xx — provider should NOT retry an event we already half-stored.
        }
        return ResponseEntity.ok().build();
    }

    /** First value of a possibly comma-joined duplicated request param. */
    private static String firstValue(String s) {
        if (s == null) return null;
        int i = s.indexOf(',');
        return (i < 0 ? s : s.substring(0, i)).trim();
    }
}
