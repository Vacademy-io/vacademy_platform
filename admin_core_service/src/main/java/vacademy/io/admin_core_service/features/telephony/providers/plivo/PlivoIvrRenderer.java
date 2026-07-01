package vacademy.io.admin_core_service.features.telephony.providers.plivo;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.core.UserMobileResolver;
import vacademy.io.admin_core_service.features.telephony.enums.IvrNodeType;
import vacademy.io.admin_core_service.features.telephony.ivr.IvrMenuService;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.IvrNode;

import java.util.ArrayList;
import java.util.List;

/**
 * Renders an IVR node (and the PLAY chain after it) into Plivo Answer-XML.
 * GATHER → {@code <GetDigits>} pointing back at our {@code /plivo/dtmf} endpoint;
 * DIAL → {@code <Dial>} of the target numbers (recording + lead-leg callbacks wired
 * to the status webhook by {@code corr}); VOICEMAIL → {@code <Record>}; HANGUP →
 * {@code <Hangup/>}.
 *
 * <p>All callbacks echo {@code corr} (the inbound call-log id) so the existing
 * webhook controller updates the row + attaches the recording with no inbound-
 * specific plumbing.
 */
@Component
public class PlivoIvrRenderer {

    private final IvrMenuService ivrMenuService;
    private final UserMobileResolver userMobileResolver;

    @Value("${telephony.webhook.callback-base:}")
    private String webhookBase;

    public PlivoIvrRenderer(IvrMenuService ivrMenuService, UserMobileResolver userMobileResolver) {
        this.ivrMenuService = ivrMenuService;
        this.userMobileResolver = userMobileResolver;
    }

    /** Full {@code <Response>} for an inbound call positioned at {@code start}. */
    public String render(IvrNode start, String callLogId, boolean record, String webhookToken) {
        StringBuilder body = new StringBuilder();
        appendNode(body, start, callLogId, record, webhookToken, 0);
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response>" + body + "</Response>";
    }

    private void appendNode(StringBuilder b, IvrNode node, String corr, boolean record,
                            String token, int depth) {
        if (node == null || depth > 12) {
            b.append("<Hangup/>");
            return;
        }
        IvrNodeType type = IvrNodeType.parseOrNull(node.getNodeType());
        if (type == null) {
            b.append("<Hangup/>");
            return;
        }
        switch (type) {
            case PLAY -> {
                speak(b, node);
                IvrNode next = node.getNextNodeId() == null ? null
                        : ivrMenuService.getNode(node.getNextNodeId()).orElse(null);
                if (next != null) appendNode(b, next, corr, record, token, depth + 1);
                else b.append("<Hangup/>");
            }
            case GATHER -> {
                String action = dtmfUrl(node.getMenuId(), node.getId(), corr, token);
                b.append("<GetDigits action=\"").append(esc(action))
                        .append("\" method=\"POST\" numDigits=\"1\" timeout=\"")
                        .append(node.getTimeoutSeconds() == null ? 6 : node.getTimeoutSeconds())
                        .append("\" retries=\"1\" redirect=\"true\">");
                speak(b, node);
                b.append("</GetDigits>");
                // No input collected → brief sign-off and hang up.
                b.append("<Speak>Sorry, we did not receive your response. Goodbye.</Speak><Hangup/>");
            }
            case DIAL -> {
                // Ring explicit numbers plus any chosen team members (resolved to
                // their mobiles at call time).
                List<String> targets = new ArrayList<>(ivrMenuService.dialTargets(node));
                for (String userId : ivrMenuService.dialUserIds(node)) {
                    userMobileResolver.findMobile(userId).ifPresent(targets::add);
                }
                if (targets.isEmpty()) {
                    speak(b, node);
                    b.append("<Hangup/>");
                    return;
                }
                speak(b, node); // optional pre-dial prompt ("Connecting you now…")
                String statusBase = statusUrl(corr, token);
                String recordAttrs = record
                        ? " record=\"true\" recordCallbackUrl=\"" + esc(statusBase + "&plivoEvent=record")
                          + "\" recordCallbackMethod=\"POST\""
                        : "";
                b.append("<Dial action=\"").append(esc(statusBase + "&plivoEvent=dial_action"))
                        .append("\" method=\"POST\" callbackUrl=\"").append(esc(statusBase + "&plivoEvent=dial_callback"))
                        .append("\" callbackMethod=\"POST\" timeout=\"30\"").append(recordAttrs).append(">");
                for (String t : targets) {
                    b.append("<Number>").append(esc(t)).append("</Number>");
                }
                b.append("</Dial>");
            }
            case VOICEMAIL -> {
                if (isBlank(node.getPromptText()) && isBlank(node.getPromptAudioId())) {
                    b.append("<Speak>Please leave a message after the tone.</Speak>");
                } else {
                    speak(b, node);
                }
                String statusBase = statusUrl(corr, token);
                b.append("<Record action=\"").append(esc(statusBase + "&plivoEvent=record"))
                        .append("\" method=\"POST\" maxLength=\"120\" finishOnKey=\"#\" playBeep=\"true\"")
                        .append(" recordSession=\"false\" redirect=\"false\"/>");
                b.append("<Hangup/>");
            }
            case HANGUP -> {
                speak(b, node);
                b.append("<Hangup/>");
            }
        }
    }

    /** Emit a prompt — a recorded audio {@code <Play>} if set, else a TTS {@code <Speak>}. */
    private void speak(StringBuilder b, IvrNode node) {
        if (!isBlank(node.getPromptAudioId())) {
            // The audio id resolves to a media_service URL at provisioning/admin time;
            // for now treat promptAudioId as a directly-playable URL if it looks like one.
            String audio = node.getPromptAudioId();
            if (audio.startsWith("http")) {
                b.append("<Play>").append(esc(audio)).append("</Play>");
                return;
            }
        }
        if (!isBlank(node.getPromptText())) {
            b.append("<Speak>").append(esc(node.getPromptText())).append("</Speak>");
        }
    }

    private String statusUrl(String corr, String token) {
        StringBuilder url = new StringBuilder(base())
                .append("/admin-core-service/v1/telephony/webhook/status?provider=PLIVO&corr=").append(corr);
        if (token != null && !token.isBlank()) url.append("&token=").append(token);
        return url.toString();
    }

    private String dtmfUrl(String menuId, String nodeId, String corr, String token) {
        StringBuilder url = new StringBuilder(base())
                .append("/admin-core-service/v1/telephony/plivo/dtmf?menuId=").append(menuId)
                .append("&nodeId=").append(nodeId)
                .append("&corr=").append(corr);
        if (token != null && !token.isBlank()) url.append("&token=").append(token);
        return url.toString();
    }

    private String base() {
        return (webhookBase == null || webhookBase.isBlank()) ? "https://api.vacademy.io" : webhookBase;
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }
}
