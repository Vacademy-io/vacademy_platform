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
import vacademy.io.admin_core_service.features.telephony.enums.IvrNodeType;
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

    /** Max DIAL-fallback legs before we stop and take a message — bounds a mis-configured
     *  fallback cycle (A→B→A) from ringing forever. */
    private static final int MAX_DIAL_HOPS = 5;

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

        // Plivo echoes URL query params into its POST body — Spring then joins the
        // duplicates with a comma. Normalize before any lookup (all endpoints here).
        corr = firstValue(corr);
        token = firstValue(token);

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
                return xml(ivrRenderer.render(root, corr, instituteId, record, token));
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

        menuId = firstValue(menuId);
        nodeId = firstValue(nodeId);
        corr = firstValue(corr);
        token = firstValue(token);

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

        // Record the caller's menu choice on the call log (e.g. "1 · Shivir Info") so the
        // team sees the category on the Call Log and can call back accordingly. Only on a
        // valid press; best-effort — never blocks routing.
        if (next != null && digits != null) {
            try {
                callLogRepo.updateIvrSelection(corr, ivrSelectionLabel(digits.trim(), next));
            } catch (Exception e) {
                log.warn("plivo dtmf: could not record IVR selection for corr={}: {}", corr, e.getMessage());
            }
        }

        // Invalid / no match → replay the current menu so the caller can retry.
        IvrNode toRender = next != null ? next : current;
        return xml(ivrRenderer.render(toRender, corr, row.getInstituteId(), record,
                resolved.getWebhookToken()));
    }

    /**
     * Continuation point after a Vacademy AI bot stream ends. The bot's answer XML
     * is {@code <Stream>…</Stream><Redirect>THIS</Redirect>}: when the WebSocket
     * closes, Plivo falls through here. If the bot registered a human-handoff
     * target (V354 {@code ai_handoff_target}, set via the internal handoff
     * endpoint), we bridge the caller to that person; otherwise the conversation
     * is over — hang up. Auth: unguessable {@code ?corr=} + optional {@code ?token=}.
     */
    @RequestMapping(value = "/ai-next",
            method = { RequestMethod.POST, RequestMethod.GET },
            produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> aiNext(
            @RequestParam("corr") String corr,
            @RequestParam(value = "token", required = false) String token) {

        corr = firstValue(corr);
        token = firstValue(token);

        TelephonyCallLog row = callLogRepo.findById(corr).orElse(null);
        if (row == null) return xml(HANGUP_XML);
        TelephonyConfigCache.Resolved resolved = configCache.get(row.getInstituteId()).orElse(null);
        if (resolved == null) return xml(HANGUP_XML);
        if (!verifyToken(resolved.getWebhookToken(), token)) return xml(HANGUP_XML);

        String target = parseHandoffNumber(row.getAiHandoffTarget());
        if (target == null) {
            return xml(HANGUP_XML);
        }
        // Caller-ID: inbound rows carry the dialled DID; outbound AI rows have no
        // caller_id, so fall back to the institute's first enabled Voice number.
        String callerId = firstNonBlank(row.getCallerId(),
                resolved.getEnabledNumbers().stream()
                        .filter(n -> Boolean.TRUE.equals(n.getEnabled()))
                        .findFirst().map(n -> n.getPhoneNumber()).orElse(null));
        String statusBase = buildStatusUrl(ProviderType.PLIVO, resolved.getWebhookToken(), corr);
        log.info("plivo ai-next: corr={} handing off to {}", corr, target);
        // record=false: the whole session is already captured by the bot's
        // <Record recordSession> — a second recording would double-store audio.
        return xml(buildDialXml(callerId, target, statusBase, false));
    }

    /**
     * Post-dial continuation for an IVR DIAL node — the Dial's {@code action} URL. Plivo
     * hits this once the ring finishes: if the call was ANSWERED we're done → hang up; if
     * NOBODY answered (no-answer / busy / failed) we follow the DIAL node's fallback
     * ({@code next_node_id} → another DIAL to try the next person, or a Voicemail to take a
     * message), so a missed redirect doesn't just drop the caller. No fallback configured →
     * a short "we'll call you back" message. Auth: unguessable {@code ?corr=} + optional token.
     */
    @RequestMapping(value = "/dial-next",
            method = { RequestMethod.POST, RequestMethod.GET },
            produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> dialNext(
            @RequestParam("corr") String corr,
            @RequestParam("nodeId") String nodeId,
            @RequestParam(value = "token", required = false) String token,
            @RequestParam(value = "hop", required = false) String hopRaw,
            HttpServletRequest req) {

        corr = firstValue(corr);
        nodeId = firstValue(nodeId);
        token = firstValue(token);

        TelephonyCallLog row = callLogRepo.findById(corr).orElse(null);
        if (row == null) return xml(HANGUP_XML);
        TelephonyConfigCache.Resolved resolved = configCache.get(row.getInstituteId()).orElse(null);
        if (resolved == null) return xml(HANGUP_XML);
        if (!verifyToken(resolved.getWebhookToken(), token)) return xml(HANGUP_XML);

        // Answered ONLY on a real connect: the b-leg had talk time, or DialStatus=="completed"
        // (someone picked up, then it ended). NEVER substring-match "answer" — Plivo's ring-out
        // value is "no-answer", which contains "answer" and would wrongly skip the fallback.
        String dialStatus = lower(firstNonBlank(req.getParameter("DialStatus"), req.getParameter("DialBLegStatus")));
        boolean answered = parsePositive(req.getParameter("DialBLegDuration"))
                || "completed".equals(dialStatus);
        if (answered) return xml(HANGUP_XML);

        // Nobody answered → follow the DIAL node's fallback (next person / voicemail), bounded
        // by a hop cap so a mis-configured cycle (A→B→A) can't ring forever.
        int hop = parseIntOr(firstValue(hopRaw), 0);
        IvrNode node = ivrMenuService.getNode(nodeId).orElse(null);
        String fallbackId = node == null ? null : node.getNextNodeId();
        IvrNode fallback = (fallbackId == null || fallbackId.isBlank())
                ? null : ivrMenuService.getNode(fallbackId).orElse(null);

        if (fallback == null || hop >= MAX_DIAL_HOPS) {
            // Chain exhausted — definitively nobody in the redirect picked up (we only get
            // here when no leg connected, else we'd have hung up above). Label the row so
            // "which redirects weren't answered" is answerable on the Call Log, then sign off.
            // applyEvent is rank-ordered, so it never regresses a genuine terminal already set.
            try {
                callLogService.applyEvent(row, NormalizedCallEvent.builder()
                        .correlationId(corr).status(mapDialMiss(dialStatus)).build());
            } catch (Exception e) {
                log.warn("plivo dial-next: could not record dial miss for corr={}: {}", corr, e.getMessage());
            }
            return xml("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response>"
                    + "<Speak>Sorry, no one is available right now. Our team will call you back shortly.</Speak>"
                    + "<Hangup/></Response>");
        }
        boolean record = Boolean.TRUE.equals(resolved.getConfig().getRecordCalls());
        log.info("plivo dial-next: corr={} dialStatus={} hop={} → fallback node {}",
                corr, dialStatus, hop, fallback.getId());
        return xml(ivrRenderer.render(fallback, corr, row.getInstituteId(), record,
                resolved.getWebhookToken(), hop + 1));
    }

    private static String lower(String s) {
        return s == null ? null : s.toLowerCase();
    }

    private static boolean parsePositive(String s) {
        if (s == null || s.isBlank()) return false;
        try {
            return Integer.parseInt(s.trim()) > 0;
        } catch (Exception e) {
            return false;
        }
    }

    private static int parseIntOr(String s, int fallback) {
        if (s == null || s.isBlank()) return fallback;
        try {
            return Integer.parseInt(s.trim());
        } catch (Exception e) {
            return fallback;
        }
    }

    /** Terminal status for an unanswered redirect leg, from Plivo's DialStatus. */
    private static CallStatus mapDialMiss(String dialStatus) {
        String s = dialStatus == null ? "" : dialStatus;
        if (s.contains("busy")) return CallStatus.BUSY;
        if (s.contains("fail") || s.contains("error")) return CallStatus.FAILED;
        return CallStatus.NO_ANSWER; // no-answer / timeout / cancel / unknown
    }

    private static String parseHandoffNumber(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            com.fasterxml.jackson.databind.JsonNode n =
                    new com.fasterxml.jackson.databind.ObjectMapper().readTree(json);
            String number = n.path("number").asText(null);
            return (number == null || number.isBlank()) ? null : number.trim();
        } catch (Exception e) {
            return null;
        }
    }

    private static String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank()) return a;
        if (b != null && !b.isBlank()) return b;
        return null;
    }

    /** Human-readable IVR selection for the call log: "{digit} · {node label or type}". */
    private static String ivrSelectionLabel(String digit, IvrNode target) {
        String label = target.getLabel();
        if (label == null || label.isBlank()) label = friendlyType(IvrNodeType.parseOrNull(target.getNodeType()));
        String s = digit + " · " + label;
        return s.length() > 160 ? s.substring(0, 160) : s;
    }

    private static String friendlyType(IvrNodeType t) {
        if (t == null) return "Option";
        return switch (t) {
            case AI_AGENT -> "AI Assistant";
            case DIAL -> "Call team";
            case VOICEMAIL -> "Voicemail";
            case GATHER -> "Submenu";
            case PLAY -> "Message";
            case HANGUP -> "End call";
        };
    }

    /** First value of a possibly comma-joined duplicated request param (Plivo
     *  echoes URL query params into its POST body; Spring joins the duplicates). */
    private static String firstValue(String s) {
        if (s == null) return null;
        int i = s.indexOf(',');
        return (i < 0 ? s : s.substring(0, i)).trim();
    }

    private String buildDialXml(String callerId, String leadNumber, String statusBase, boolean record) {
        String recordAttrs = record
                ? " record=\"true\" recordCallbackUrl=\"" + esc(statusBase + "&plivoEvent=record")
                  + "\" recordCallbackMethod=\"POST\""
                : "";
        // Plivo/carrier rejects '+'-prefixed numbers ("Internal Error From Carrier").
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                + "<Response>"
                + "<Dial callerId=\"" + esc(stripPlus(callerId)) + "\""
                + " callbackUrl=\"" + esc(statusBase + "&plivoEvent=dial_callback") + "\" callbackMethod=\"POST\""
                + " action=\"" + esc(statusBase + "&plivoEvent=dial_action") + "\" method=\"POST\""
                + recordAttrs + ">"
                + "<Number>" + esc(stripPlus(leadNumber)) + "</Number>"
                + "</Dial>"
                + "</Response>";
    }

    private static String stripPlus(String s) {
        return s != null && s.startsWith("+") ? s.substring(1) : s;
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
