package vacademy.io.admin_core_service.features.telephony.providers.vacademy_ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.core.TelephonyConfigCache;
import vacademy.io.admin_core_service.features.telephony.core.VoiceCallingSettingsService;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.providers.plivo.PlivoHttpClient;
import vacademy.io.admin_core_service.features.telephony.spi.AiOutboundCaller;
import vacademy.io.admin_core_service.features.telephony.spi.dto.AiCallHandle;
import vacademy.io.admin_core_service.features.telephony.spi.dto.AiCallSpec;
import vacademy.io.common.exceptions.VacademyException;

import java.nio.charset.StandardCharsets;
import java.net.URLEncoder;
import java.util.Map;

/**
 * Vacademy AI Agent outbound dial: places a Plivo call on the institute's
 * Vacademy Voice subaccount whose {@code answer_url} is our own voice-bot
 * service. When the lead answers, the bot returns
 * {@code <Stream>wss://bot/ws?corr=..</Stream><Redirect>/plivo/ai-next</Redirect>}
 * and the conversation runs over the WebSocket. The end-of-call report comes
 * back through the generic {@code /webhook/ai-voice/VACADEMY_AI} receiver, so
 * the whole existing outcome pipeline (classify → assign/stop/retry → workflow
 * resume) is reused unchanged.
 *
 * <p>Requires the institute's telephony provider to be PLIVO (Vacademy Voice) —
 * the AI agent is part of that product and dials on its subaccount + caller-ID.
 */
@Component
public class VacademyAiOutboundCaller implements AiOutboundCaller {

    private static final Logger log = LoggerFactory.getLogger(VacademyAiOutboundCaller.class);

    @Autowired private PlivoHttpClient plivoHttpClient;
    @Autowired private TelephonyConfigCache configCache;
    @Autowired private VoiceCallingSettingsService voiceSettings;

    /** Public HTTPS base of the voice-bot service (ap-south-1), e.g. https://voice-bot.vacademy.io */
    @Value("${telephony.vacademy-ai.bot-base-url:}")
    private String botBaseUrl;

    @Value("${telephony.webhook.callback-base:}")
    private String webhookBase;

    @Override
    public String providerType() {
        return ProviderType.VACADEMY_AI;
    }

    @Override
    public AiCallHandle placeCall(AiCallSpec spec) {
        if (botBaseUrl == null || botBaseUrl.isBlank()) {
            throw new VacademyException(
                    "Vacademy AI is not configured on this server (telephony.vacademy-ai.bot-base-url)");
        }
        TelephonyConfigCache.Resolved resolved = configCache.get(spec.getInstituteId())
                .filter(r -> Boolean.TRUE.equals(r.getConfig().getEnabled()))
                .orElseThrow(() -> new VacademyException(
                        "Calling is not configured for this institute"));
        if (!ProviderType.PLIVO.equals(resolved.getConfig().getProviderType())) {
            throw new VacademyException(
                    "Vacademy AI calling needs the Vacademy Voice (Plivo) provider to be active for this institute");
        }

        String callerId = resolveCallerId(spec.getInstituteId(), resolved);
        if (callerId == null || callerId.isBlank()) {
            throw new VacademyException("No Vacademy Voice number is configured for this institute");
        }

        // Terminal + recording events flow through the standard status webhook; the
        // institute's telephony config is PLIVO so its handler parses them, and the
        // row is matched by corr. Full-session recording is requested by the BOT's
        // answer XML (<Record recordSession="true">) — Plivo's Call-create API has
        // no reliable record param — so we hand the bot the exact callback URL (rcb).
        String statusBase = statusBase(resolved.getWebhookToken(), spec.getCorrelationId());
        boolean record = Boolean.TRUE.equals(resolved.getConfig().getRecordCalls());
        // nxt = where Plivo goes when the bot's stream ends (handoff <Dial> or hangup).
        // Built HERE (with the webhook token) so the bot's /answer stays stateless.
        String base = (webhookBase == null || webhookBase.isBlank())
                ? "https://api.vacademy.io" : webhookBase.trim().replaceAll("/$", "");
        String nextUrl = base + "/admin-core-service/v1/telephony/plivo/ai-next?corr=" + enc(spec.getCorrelationId())
                + (resolved.getWebhookToken() != null && !resolved.getWebhookToken().isBlank()
                        ? "&token=" + enc(resolved.getWebhookToken()) : "");
        String answerUrl = botBase() + "/answer"
                + "?corr=" + enc(spec.getCorrelationId())
                + "&agent=" + enc(spec.getCampaignId() == null ? "default" : spec.getCampaignId())
                + "&inst=" + enc(spec.getInstituteId())
                + "&nxt=" + enc(nextUrl)
                + (record ? "&rcb=" + enc(statusBase + "&plivoEvent=record") : "");
        String hangupUrl = statusBase + "&plivoEvent=hangup";

        Map<String, Object> resp = plivoHttpClient.createCall(
                resolved.getCredentials(), callerId, spec.getPhoneNumber(),
                answerUrl, hangupUrl, null,
                /* recording via the bot's answer XML, not the create API */ false,
                "40");

        String requestUuid = resp == null ? null : asString(resp.get("request_uuid"));
        log.info("vacademy-ai: dialed corr={} inst={} agent={} requestUuid={}",
                spec.getCorrelationId(), spec.getInstituteId(), spec.getCampaignId(), requestUuid);
        return AiCallHandle.builder()
                .providerCallId(requestUuid)
                .accepted(true)
                .message("queued")
                .build();
    }

    private String resolveCallerId(String instituteId, TelephonyConfigCache.Resolved resolved) {
        String fromSettings = voiceSettings.get(instituteId).getDefaultCallerId();
        if (fromSettings != null && !fromSettings.isBlank()) return fromSettings.trim();
        return resolved.getEnabledNumbers().stream()
                .filter(n -> Boolean.TRUE.equals(n.getEnabled()))
                .findFirst()
                .map(n -> n.getPhoneNumber())
                .orElse(null);
    }

    private String botBase() {
        return botBaseUrl.trim().replaceAll("/$", "");
    }

    private String statusBase(String token, String corr) {
        String base = (webhookBase == null || webhookBase.isBlank())
                ? "https://api.vacademy.io" : webhookBase.trim().replaceAll("/$", "");
        StringBuilder url = new StringBuilder(base)
                .append("/admin-core-service/v1/telephony/webhook/status")
                .append("?provider=").append(ProviderType.PLIVO)
                .append("&corr=").append(corr);
        if (token != null && !token.isBlank()) url.append("&token=").append(token);
        return url.toString();
    }

    private static String enc(String s) {
        return URLEncoder.encode(s == null ? "" : s, StandardCharsets.UTF_8);
    }

    private static String asString(Object o) {
        return o == null ? null : o.toString();
    }
}
