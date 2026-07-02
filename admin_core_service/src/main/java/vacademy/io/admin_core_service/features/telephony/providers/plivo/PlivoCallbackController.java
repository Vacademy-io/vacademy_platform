package vacademy.io.admin_core_service.features.telephony.providers.plivo;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.telephony.core.CallEventBus;
import vacademy.io.admin_core_service.features.telephony.core.CallLogService;
import vacademy.io.admin_core_service.features.telephony.core.InboundRoutingService;
import vacademy.io.admin_core_service.features.telephony.core.TelephonyConfigCache;
import vacademy.io.admin_core_service.features.telephony.enums.CallStatus;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.ivr.IvrMenuService;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.IvrMenu;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.IvrNode;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyCallLog;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyProviderNumber;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyCallLogRepository;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyProviderNumberRepository;
import vacademy.io.admin_core_service.features.telephony.spi.dto.NormalizedCallEvent;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

/**
 * Public Plivo call-flow applet surface (registered in ApplicationSecurityConfig).
 * Plivo fetches the answer XML for the outbound bridge here: when the counsellor's
 * leg is answered, Plivo POSTs to {@code /answer/outbound?corr=...}; we mark the
 * call COUNSELLOR_ANSWERED and return {@code <Dial><Number>lead</Number></Dial>} so
 * Plivo bridges to the lead — recording the two-party audio and posting the
 * recording + lead-leg events back to the status webhook.
 *
 * <p>Auth: the unguessable {@code ?corr=} call-log UUID, plus an optional
 * shared-secret {@code ?token=} when the institute configured one (open mode
 * otherwise — same model as the inbound applet).
 */
@RestController
@RequestMapping("/admin-core-service/v1/telephony/plivo")
public class PlivoCallbackController {

    private static final Logger log = LoggerFactory.getLogger(PlivoCallbackController.class);

    private static final String HANGUP_XML =
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Hangup/></Response>";

    @Autowired private TelephonyCallLogRepository callLogRepo;
    @Autowired private TelephonyConfigCache configCache;
    @Autowired private CallLogService callLogService;
    @Autowired private CallEventBus eventBus;
    @Autowired private InboundRoutingService inboundRoutingService;
    @Autowired private IvrMenuService ivrMenuService;
    @Autowired private PlivoIvrRenderer ivrRenderer;
    @Autowired private PlivoInboundResponseRenderer inboundResponseRenderer;
    @Autowired private TelephonyProviderNumberRepository numberRepo;

    @Value("${telephony.webhook.callback-base:}")
    private String webhookBase;

    @RequestMapping(value = "/answer/outbound",
            method = { RequestMethod.POST, RequestMethod.GET },
            produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> answerOutbound(
            @RequestParam("corr") String corr,
            @RequestParam(value = "token", required = false) String token) {

        TelephonyCallLog row = callLogRepo.findById(corr).orElse(null);
        if (row == null) {
            log.warn("plivo answer/outbound: no row for corr={}", corr);
            return xml(HANGUP_XML);
        }

        TelephonyConfigCache.Resolved resolved = configCache.get(row.getInstituteId()).orElse(null);
        if (resolved == null) return xml(HANGUP_XML);

        if (!verifyToken(resolved.getWebhookToken(), token)) {
            log.warn("plivo answer/outbound: token mismatch corr={}", corr);
            return xml(HANGUP_XML);
        }

        // The counsellor's (parent) leg was answered — advance the row + push to SSE.
        try {
            NormalizedCallEvent answered = NormalizedCallEvent.builder()
                    .correlationId(corr)
                    .status(CallStatus.COUNSELLOR_ANSWERED)
                    .build();
            callLogService.applyEvent(row, answered);
            eventBus.publish(corr, answered);
        } catch (Exception e) {
            log.warn("plivo answer/outbound: could not record COUNSELLOR_ANSWERED for {}", corr, e);
        }

        boolean record = Boolean.TRUE.equals(resolved.getConfig().getRecordCalls());
        String statusBase = buildStatusUrl(ProviderType.PLIVO, resolved.getWebhookToken(), corr);
        return xml(buildDialXml(row.getCallerId(), row.getToNumber(), statusBase, record));
    }

    /**
     * Inbound entry. Plivo's Application answer_url for the institute's DID hits this:
     * resolve the institute by the dialled number, log an INBOUND call, then play the
     * institute's IVR menu (or fall back to the routing chain when no IVR is authored).
     * All subsequent callbacks echo {@code corr} (the call-log id) so recording + hangup
     * flow through the existing webhook pipeline.
     */
    @RequestMapping(value = "/answer/inbound",
            method = { RequestMethod.POST, RequestMethod.GET },
            produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> answerInbound(HttpServletRequest req) {
        String from = firstNonBlank(req.getParameter("From"), req.getParameter("CallerNumber"));
        String to = req.getParameter("To");
        String callUuid = req.getParameter("CallUUID");
        if (to == null || to.isBlank()) {
            return xml(HANGUP_XML);
        }

        InboundRoutingService.RoutedInbound routed = inboundRoutingService.route(
                ProviderType.PLIVO, from, to, callUuid);
        if (!routed.isRouted()) {
            log.warn("plivo answer/inbound: could not attribute institute for To={}", to);
            return xml(HANGUP_XML);
        }
        String instituteId = routed.getInstituteId();
        String corr = routed.getCallLogId();

        TelephonyConfigCache.Resolved resolved = configCache.get(instituteId).orElse(null);
        boolean record = resolved != null && Boolean.TRUE.equals(resolved.getConfig().getRecordCalls());
        String token = resolved == null ? null : resolved.getWebhookToken();

        // Multi-level IVR: the dialled number's own menu first (managed per number
        // on the Numbers card), else the DID-specific / default menu.
        String preferredMenuId = numberRepo.findEnabledByPhoneNumber(to.trim()).stream()
                .findFirst().map(TelephonyProviderNumber::getInboundIvrMenuId).orElse(null);
        IvrMenu menu = ivrMenuService.resolveMenu(instituteId, to, preferredMenuId).orElse(null);
        if (menu != null && menu.getRootNodeId() != null) {
            IvrNode root = ivrMenuService.getNode(menu.getRootNodeId()).orElse(null);
            if (root != null) {
                return xml(ivrRenderer.render(root, corr, record, token));
            }
        }
        // No IVR authored — route straight to a counsellor / voicemail leg.
        Object body = inboundResponseRenderer.render(routed.getDecision(), to);
        return xml(body == null ? HANGUP_XML : body.toString());
    }

    /**
     * IVR digit handler. A GATHER node's {@code <GetDigits>} action points here; we look
     * up the pressed digit in the node's digit map and render the next node — or replay
     * the current menu on an invalid press.
     */
    @RequestMapping(value = "/dtmf",
            method = { RequestMethod.POST, RequestMethod.GET },
            produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> dtmf(
            @RequestParam("menuId") String menuId,
            @RequestParam("nodeId") String nodeId,
            @RequestParam("corr") String corr,
            @RequestParam(value = "token", required = false) String token,
            HttpServletRequest req) {

        TelephonyCallLog row = callLogRepo.findById(corr).orElse(null);
        if (row == null) return xml(HANGUP_XML);
        TelephonyConfigCache.Resolved resolved = configCache.get(row.getInstituteId()).orElse(null);
        if (resolved == null) return xml(HANGUP_XML);
        if (!verifyToken(resolved.getWebhookToken(), token)) return xml(HANGUP_XML);

        IvrNode current = ivrMenuService.getNode(nodeId).orElse(null);
        if (current == null) return xml(HANGUP_XML);

        boolean record = Boolean.TRUE.equals(resolved.getConfig().getRecordCalls());
        String digits = firstNonBlank(req.getParameter("Digits"), req.getParameter("digits"));
        Map<String, String> digitMap = ivrMenuService.digitMap(current);
        String nextId = digits == null ? null : digitMap.get(digits.trim());
        IvrNode next = (nextId == null) ? null : ivrMenuService.getNode(nextId).orElse(null);

        // Invalid / no match → replay the current menu so the caller can retry.
        IvrNode toRender = next != null ? next : current;
        return xml(ivrRenderer.render(toRender, corr, record, resolved.getWebhookToken()));
    }

    private static String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank()) return a;
        if (b != null && !b.isBlank()) return b;
        return null;
    }

    private String buildDialXml(String callerId, String leadNumber, String statusBase, boolean record) {
        String recordAttrs = record
                ? " record=\"true\" recordCallbackUrl=\"" + esc(statusBase + "&plivoEvent=record")
                  + "\" recordCallbackMethod=\"POST\""
                : "";
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                + "<Response>"
                + "<Dial callerId=\"" + esc(callerId) + "\""
                + " callbackUrl=\"" + esc(statusBase + "&plivoEvent=dial_callback") + "\" callbackMethod=\"POST\""
                + " action=\"" + esc(statusBase + "&plivoEvent=dial_action") + "\" method=\"POST\""
                + recordAttrs + ">"
                + "<Number>" + esc(leadNumber) + "</Number>"
                + "</Dial>"
                + "</Response>";
    }

    private String buildStatusUrl(String providerType, String token, String corr) {
        String base = (webhookBase == null || webhookBase.isBlank())
                ? "https://api.vacademy.io" : webhookBase;
        StringBuilder url = new StringBuilder(base)
                .append("/admin-core-service/v1/telephony/webhook/status")
                .append("?provider=").append(providerType)
                .append("&corr=").append(corr);
        if (token != null && !token.isBlank()) {
            url.append("&token=").append(token);
        }
        return url.toString();
    }

    private static boolean verifyToken(String stored, String presented) {
        if (stored == null || stored.isBlank()) return true; // open mode
        if (presented == null) return false;
        return MessageDigest.isEqual(
                presented.getBytes(StandardCharsets.UTF_8),
                stored.getBytes(StandardCharsets.UTF_8));
    }

    private static ResponseEntity<String> xml(String body) {
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_XML).body(body);
    }

    /** XML-escape attribute/text values (the URLs carry &, which must be &amp; in XML). */
    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }
}
