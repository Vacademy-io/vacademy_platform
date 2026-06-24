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
import vacademy.io.admin_core_service.features.telephony.core.InboundRoutingService;
import vacademy.io.admin_core_service.features.telephony.core.RecordingPersistenceService;
import vacademy.io.admin_core_service.features.telephony.core.TelephonyConfigCache;
import vacademy.io.admin_core_service.features.telephony.core.TelephonyProviderRegistry;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyCallLog;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyCallLogRepository;
import vacademy.io.admin_core_service.features.telephony.spi.CallWebhookHandler;
import vacademy.io.admin_core_service.features.telephony.spi.InboundResponseRenderer;
import vacademy.io.admin_core_service.features.telephony.spi.dto.InboundEnvelope;
import vacademy.io.admin_core_service.features.telephony.spi.dto.InboundRouteDecision;
import vacademy.io.admin_core_service.features.telephony.spi.dto.NormalizedCallEvent;
import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderSecrets;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Collections;
import java.util.Map;

/**
 * Inbound (lead → counsellor) telephony entry points.
 *
 *   GET  /inbound/route   — Exotel's Connect applet hits this with CallFrom /
 *                           CallTo / CallSid; we return JSON describing which
 *                           number(s) to bridge the lead to.
 *   POST /inbound/status  — provider status callbacks for INBOUND calls. Looks
 *                           up by provider_call_id (we don't get to inject
 *                           our own ?corr= on inbound; the CallSid we stored
 *                           at route time is the join key).
 *
 * Both endpoints are public — registered in ApplicationSecurityConfig under
 * ALLOWED_PATHS so providers can hit them without a Vacademy JWT. Auth is the
 * shared-secret ?token= verified by the matching provider handler.
 *
 * Latency: the route endpoint is synchronous — Exotel holds the lead's audio
 * open until we respond. Target ≤ 200ms. The status endpoint is async-style
 * (we ack 2xx fast and do recording fetch off-thread).
 */
@RestController
@RequestMapping("/admin-core-service/v1/telephony/inbound")
public class InboundCallController {

    private static final Logger log = LoggerFactory.getLogger(InboundCallController.class);

    @Autowired private InboundRoutingService routingService;
    @Autowired private TelephonyConfigCache configCache;
    @Autowired private TelephonyCallLogRepository callLogRepo;
    @Autowired private TelephonyProviderRegistry registry;
    @Autowired private CallLogService callLogService;
    @Autowired private CallEventBus eventBus;
    @Autowired private RecordingPersistenceService recordingService;

    /**
     * Connect-applet entry. Exotel sends the call's basic context as query
     * params (CallFrom, CallTo, CallSid). We resolve routing and respond with
     * the JSON Exotel needs to bridge the call.
     *
     * Returns an empty {@code destination.numbers} list when no agent and no
     * voicemail can be routed — Exotel then plays its default "agents
     * unavailable" message and we have a missed-call row.
     */
    @GetMapping("/route")
    public ResponseEntity<?> route(
            @RequestParam("provider") String providerType,
            HttpServletRequest req,
            @RequestParam(value = "CallSid", required = false) String callSid,
            @RequestParam(value = "token",   required = false) String token) {

        // Exotel sends two pairs of From/To-ish fields and they don't mean the
        // same thing. {@code From}/{@code To} are the ORIGINAL call legs (lead
        // dialled this ExoPhone). {@code CallFrom}/{@code CallTo} are the
        // CURRENT dial-attempt context — during fallback retries, {@code CallTo}
        // becomes the leg that was just tried, not the original ExoPhone.
        // Always identify the institute by the original {@code To}; fall back
        // to {@code CallTo} only if a future provider doesn't send {@code To}.
        String callFrom = firstNonBlank(req.getParameter("From"), req.getParameter("CallFrom"));
        String callTo   = firstNonBlank(req.getParameter("To"),   req.getParameter("CallTo"));

        if (callTo == null || callTo.isBlank()) {
            log.warn("inbound /route: missing To/CallTo");
            return ResponseEntity.badRequest().build();
        }

        // Token verification — we identify the institute from CallTo, then
        // compare against its stored webhook token. "Open mode" institutes
        // (no token configured) accept any inbound route call.
        String pt = normaliseProvider(providerType);
        InboundRoutingService.RoutedInbound routed = routingService.route(
                pt, callFrom, callTo, callSid);

        if (!routed.isRouted()) {
            // We couldn't even attribute the institute. Return an empty
            // destination so Exotel falls through to its default handling.
            return ResponseEntity.ok(emptyDestination());
        }

        if (!verifyToken(routed.getInstituteId(), token)) {
            log.warn("inbound /route: token mismatch institute={}", routed.getInstituteId());
            // Don't leak that the institute exists — return empty destination
            // so the call drops without any extra information.
            return ResponseEntity.ok(emptyDestination());
        }

        InboundResponseRenderer renderer = registry.inboundResponseRenderer(pt).orElse(null);
        if (renderer == null) {
            // Provider has no synchronous applet to render (it routes inbound
            // natively). Such a provider shouldn't be calling /route at all —
            // reject rather than emit an Exotel-shaped empty body.
            log.warn("inbound /route: no inbound renderer for provider {} (native-routed?)", pt);
            return ResponseEntity.badRequest().build();
        }

        InboundRouteDecision decision = routed.getDecision();
        Object body = renderer.render(decision, callTo);

        log.info("inbound /route: institute={} callSid={} strategy={} legs={}",
                routed.getInstituteId(), callSid,
                decision.getStrategyKey(),
                decision.getNumbersToDial() == null ? 0 : decision.getNumbersToDial().size());

        return ResponseEntity.ok(body);
    }

    /**
     * Inbound status callback. Looks up the row by provider_call_id (the
     * Exotel CallSid) — we don't get to inject our own corr id on inbound,
     * so the CallSid persisted at route time is the join key.
     *
     * Hot-path semantics mirror the outbound /webhook/status endpoint:
     * always return 2xx for "processed", 401 for "invalid auth", 410 for
     * "no such call". Never 5xx — provider retries are catastrophic.
     */
    @RequestMapping(value = "/status", method = { RequestMethod.POST, RequestMethod.GET })
    public ResponseEntity<Void> status(
            @RequestParam("provider") String providerType,
            HttpServletRequest req,
            @RequestBody(required = false) String body) {

        String sid = firstNonBlank(req.getParameter("CallSid"), req.getParameter("Sid"));
        if (sid == null) {
            log.warn("inbound /status: missing CallSid");
            return ResponseEntity.badRequest().build();
        }

        String pt = normaliseProvider(providerType);
        TelephonyCallLog row = callLogRepo
                .findByProviderTypeAndProviderCallId(pt, sid)
                .orElse(null);
        if (row == null) {
            log.warn("inbound /status: no row for callSid={} provider={}", sid, pt);
            return ResponseEntity.status(HttpStatus.GONE).build();
        }

        TelephonyConfigCache.Resolved resolved =
                configCache.get(row.getInstituteId()).orElse(null);
        if (resolved == null) return ResponseEntity.status(HttpStatus.GONE).build();

        CallWebhookHandler handler;
        try {
            handler = registry.handler(pt);
        } catch (Exception e) {
            log.warn("inbound /status: unknown provider {}", pt);
            return ResponseEntity.badRequest().build();
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
            log.info("inbound /status: row={} status={} terminal={} hasRecording={} provider={}",
                    row.getId(), ev.getStatus(), ev.isTerminal(),
                    ev.getRecordingUrl() != null, pt);
            callLogService.applyEvent(row, ev);
            eventBus.publish(row.getId(), ev);
            if (ev.isTerminal() && ev.getRecordingUrl() != null) {
                recordingService.persistAsync(row.getId());
            }
        } catch (Exception e) {
            log.error("inbound /status: parse/apply failed for row {}", row.getId(), e);
        }
        return ResponseEntity.ok().build();
    }

    private boolean verifyToken(String instituteId, String presented) {
        TelephonyConfigCache.Resolved r = configCache.get(instituteId).orElse(null);
        if (r == null) return false;
        String stored = r.getWebhookToken();
        if (stored == null || stored.isBlank()) return true; // open mode
        if (presented == null) return false;
        return MessageDigest.isEqual(
                presented.getBytes(StandardCharsets.UTF_8),
                stored.getBytes(StandardCharsets.UTF_8));
    }

    private static String normaliseProvider(String providerType) {
        if (providerType == null || providerType.isBlank()) return ProviderType.EXOTEL;
        return providerType.toUpperCase().trim();
    }

    private static String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank()) return a;
        if (b != null && !b.isBlank()) return b;
        return null;
    }

    private static Map<String, Object> emptyDestination() {
        return Map.of(
                "fetch_after_attempt", false,
                "destination", Map.of("numbers", Collections.emptyList()));
    }
}
