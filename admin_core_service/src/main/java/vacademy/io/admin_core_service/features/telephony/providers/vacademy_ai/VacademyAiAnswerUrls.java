package vacademy.io.admin_core_service.features.telephony.providers.vacademy_ai;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * Builds the voice-bot {@code /answer} URL (and its embedded continuation +
 * record-callback URLs) for a Vacademy AI call. Shared by the outbound dialer
 * ({@link VacademyAiOutboundCaller}) and the inbound IVR AI_AGENT node — both
 * paths must hand Plivo byte-identical XML semantics: the bot's answer serves
 * {@code [<Record recordSession>]<Stream>wss…</Stream><Redirect>/plivo/ai-next</Redirect>}.
 */
@Component
public class VacademyAiAnswerUrls {

    /** Public HTTPS base of the voice-bot service, e.g. https://host/voice-bot-service */
    @Value("${telephony.vacademy-ai.bot-base-url:}")
    private String botBaseUrl;

    @Value("${telephony.webhook.callback-base:}")
    private String webhookBase;

    /** Optional override for the host that serves IVR prompt audio ({@code /tts.wav}).
     *  Blank → the webhook host's {@code /voice-bot-service} path (Cloudflare-proxied,
     *  reliably reachable by Plivo's media servers). */
    @Value("${telephony.ivr.tts-base-url:}")
    private String ivrTtsBaseUrl;

    public boolean isConfigured() {
        return botBaseUrl != null && !botBaseUrl.isBlank();
    }

    /**
     * The full bot answer URL: {@code {bot}/answer?corr&agent&inst&nxt[&rcb]}.
     * {@code nxt} (post-stream continuation) and {@code rcb} (record callback)
     * carry the webhook token so the bot's /answer stays stateless.
     */
    public String answerUrl(String corr, String agentId, String instituteId,
                            String webhookToken, boolean record) {
        String nextUrl = base() + "/admin-core-service/v1/telephony/plivo/ai-next?corr=" + enc(corr)
                + (webhookToken != null && !webhookToken.isBlank() ? "&token=" + enc(webhookToken) : "");
        StringBuilder url = new StringBuilder(botBase())
                .append("/answer")
                .append("?corr=").append(enc(corr))
                .append("&agent=").append(enc(agentId == null || agentId.isBlank() ? "default" : agentId))
                .append("&inst=").append(enc(instituteId))
                .append("&nxt=").append(enc(nextUrl));
        if (record) {
            url.append("&rcb=").append(enc(statusBase(webhookToken, corr) + "&plivoEvent=record"));
        }
        return url.toString();
    }

    /**
     * Natural-voice audio URL for an IVR prompt — Plivo {@code <Play>}s it. Renders
     * the text in the SAME Sarvam voice as the AI agent (so IVR menus stop sounding
     * like a foreign TTS reading Hindi), and the bot caches the audio to disk, so a
     * static menu prompt is synthesized once and replayed free on every call.
     */
    public String ttsUrl(String text, String lang) {
        // Serve IVR audio from the SAME Cloudflare-proxied host Plivo already fetches
        // the answer-XML from (the webhook base + /voice-bot-service ingress path), NOT
        // the voice-bot's direct base — Plivo's media servers reach the proxied host
        // reliably, and the bot behind that path serves+caches the same audio. Override
        // with telephony.ivr.tts-base-url. .wav path so Plivo keys it as a WAV file.
        String ttsBase = (ivrTtsBaseUrl != null && !ivrTtsBaseUrl.isBlank())
                ? ivrTtsBaseUrl.trim().replaceAll("/$", "")
                : base() + "/voice-bot-service";
        return ttsBase + "/tts.wav?text=" + enc(text)
                + (lang != null && !lang.isBlank() ? "&lang=" + enc(lang) : "");
    }

    /** Status-webhook base for this call: {@code …/webhook/status?provider=PLIVO&corr=…[&token=…]}. */
    public String statusBase(String webhookToken, String corr) {
        StringBuilder url = new StringBuilder(base())
                .append("/admin-core-service/v1/telephony/webhook/status")
                .append("?provider=").append(ProviderType.PLIVO)
                .append("&corr=").append(corr);
        if (webhookToken != null && !webhookToken.isBlank()) url.append("&token=").append(webhookToken);
        return url.toString();
    }

    private String base() {
        return (webhookBase == null || webhookBase.isBlank())
                ? "https://api.vacademy.io" : webhookBase.trim().replaceAll("/$", "");
    }

    private String botBase() {
        return botBaseUrl.trim().replaceAll("/$", "");
    }

    private static String enc(String s) {
        return URLEncoder.encode(s == null ? "" : s, StandardCharsets.UTF_8);
    }
}
