package vacademy.io.admin_core_service.features.telephony.providers.plivo;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.core.UserMobileResolver;
import vacademy.io.admin_core_service.features.telephony.enums.IvrNodeType;
import vacademy.io.admin_core_service.features.telephony.ivr.IvrMenuService;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.IvrNode;
import vacademy.io.admin_core_service.features.telephony.providers.vacademy_ai.VacademyAiAnswerUrls;

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
    private final VacademyAiAnswerUrls aiAnswerUrls;

    @Value("${telephony.webhook.callback-base:}")
    private String webhookBase;

    public PlivoIvrRenderer(IvrMenuService ivrMenuService, UserMobileResolver userMobileResolver,
                            VacademyAiAnswerUrls aiAnswerUrls) {
        this.ivrMenuService = ivrMenuService;
        this.userMobileResolver = userMobileResolver;
        this.aiAnswerUrls = aiAnswerUrls;
    }

    /** Full {@code <Response>} for an inbound call positioned at {@code start}. */
    public String render(IvrNode start, String callLogId, String instituteId,
                         boolean record, String webhookToken) {
        StringBuilder body = new StringBuilder();
        appendNode(body, start, callLogId, instituteId, record, webhookToken, 0);
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response>" + body + "</Response>";
    }

    private void appendNode(StringBuilder b, IvrNode node, String corr, String instituteId,
                            boolean record, String token, int depth) {
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
                if (next != null) appendNode(b, next, corr, instituteId, record, token, depth + 1);
                else b.append("<Hangup/>");
            }
            case GATHER -> {
                String action = dtmfUrl(node.getMenuId(), node.getId(), corr, token);
                // Plivo's GetDigits timeout counts from when the element STARTS — it runs
                // CONCURRENTLY with the nested prompt, it does NOT wait for the prompt to
                // finish. So a short timeout on a long menu prompt fires "no input" partway
                // through the prompt (before the caller has even heard the options), which
                // is exactly the "waited a few seconds → Sorry, we did not receive your
                // response" symptom. Size the wait to cover the prompt's spoken length PLUS
                // the configured post-prompt window to press. Barge-in still works — pressing
                // a digit during the prompt submits immediately.
                int postPromptWait = node.getTimeoutSeconds() == null ? 6 : node.getTimeoutSeconds();
                int timeout = Math.min(120, estimateSpeechSeconds(node.getPromptText()) + postPromptWait);
                b.append("<GetDigits action=\"").append(esc(action))
                        .append("\" method=\"POST\" numDigits=\"1\" timeout=\"")
                        .append(timeout)
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
                    // Plivo/carrier rejects '+'-prefixed numbers.
                    b.append("<Number>").append(esc(stripPlus(t))).append("</Number>");
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
            case AI_AGENT -> {
                // Hand the live call to a Vacademy AI agent: redirect Plivo to the
                // voice-bot's /answer, which serves the same
                // [<Record recordSession>]<Stream>wss…</Stream><Redirect>/plivo/ai-next</Redirect>
                // XML the outbound AI path uses — recording, mid-call human handoff
                // and the end-of-call report pipeline all behave identically.
                if (!aiAnswerUrls.isConfigured() || isBlank(node.getAiAgentId())) {
                    speak(b, node);
                    b.append("<Speak>Sorry, our assistant is unavailable right now. ")
                            .append("Please call back later.</Speak><Hangup/>");
                    return;
                }
                speak(b, node); // optional bridge prompt ("Connecting you to our assistant…")
                String answerUrl = aiAnswerUrls.answerUrl(
                        corr, node.getAiAgentId(), instituteId, token, record);
                b.append("<Redirect method=\"POST\">").append(esc(answerUrl)).append("</Redirect>");
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
            // Voice the institute-authored prompt in our natural Sarvam voice (same as
            // the AI agent) via the bot's cached /tts endpoint — Plivo's built-in
            // <Speak> reads Hindi/Hinglish with a foreign accent. Fall back to Plivo's
            // Hindi Polly voice when the bot isn't configured (still better than default).
            if (aiAnswerUrls.isConfigured()) {
                b.append("<Play>").append(esc(aiAnswerUrls.ttsUrl(node.getPromptText(), "hi-IN")))
                        .append("</Play>");
            } else {
                b.append("<Speak voice=\"Polly.Aditi\" language=\"hi-IN\">")
                        .append(esc(node.getPromptText())).append("</Speak>");
            }
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

    /**
     * Rough spoken duration (seconds) of a prompt, used to size the GetDigits wait so
     * a long menu prompt isn't cut off by Plivo's timeout (which runs concurrently with
     * playback). ~10 chars/sec deliberately UNDER-rates the pace so we over-estimate the
     * duration and never clip — measured: a 603-char Hindi prompt ≈ 46s (~13 ch/s), so
     * 10 leaves headroom across TTS voices/paces. Floor 3s; blank prompt ⇒ 0.
     */
    private static int estimateSpeechSeconds(String text) {
        if (text == null || text.isBlank()) return 0;
        return Math.max(3, (int) Math.ceil(text.length() / 10.0));
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    private static String stripPlus(String s) {
        return s != null && s.startsWith("+") ? s.substring(1) : s;
    }
}
