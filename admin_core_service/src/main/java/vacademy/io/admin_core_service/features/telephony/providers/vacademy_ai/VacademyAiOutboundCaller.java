package vacademy.io.admin_core_service.features.telephony.providers.vacademy_ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.core.TelephonyConfigCache;
import vacademy.io.admin_core_service.features.telephony.core.VoiceCallingSettingsService;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.providers.plivo.PlivoHttpClient;
import vacademy.io.admin_core_service.features.telephony.spi.AiOutboundCaller;
import vacademy.io.admin_core_service.features.telephony.spi.dto.AiCallHandle;
import vacademy.io.admin_core_service.features.telephony.spi.dto.AiCallSpec;
import vacademy.io.common.exceptions.VacademyException;

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
    @Autowired private VacademyAiAnswerUrls answerUrls;

    @Override
    public String providerType() {
        return ProviderType.VACADEMY_AI;
    }

    @Override
    public AiCallHandle placeCall(AiCallSpec spec) {
        if (!answerUrls.isConfigured()) {
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
        // no reliable record param — so the answer URL carries the callback (rcb),
        // and nxt (post-stream handoff <Dial> or hangup) carries the webhook token,
        // keeping the bot's /answer stateless. Shared with the IVR AI_AGENT node.
        boolean record = Boolean.TRUE.equals(resolved.getConfig().getRecordCalls());
        String answerUrl = answerUrls.answerUrl(spec.getCorrelationId(), spec.getCampaignId(),
                spec.getInstituteId(), resolved.getWebhookToken(), record);
        String hangupUrl = answerUrls.statusBase(resolved.getWebhookToken(), spec.getCorrelationId())
                + "&plivoEvent=hangup";

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
        // Lowest priority value wins — same convention as PlivoOriginationResolver.
        return resolved.getEnabledNumbers().stream()
                .filter(n -> Boolean.TRUE.equals(n.getEnabled()))
                .min(java.util.Comparator.comparingInt(
                        n -> n.getPriority() == null ? Integer.MAX_VALUE : n.getPriority()))
                .map(n -> n.getPhoneNumber())
                .orElse(null);
    }

    private static String asString(Object o) {
        return o == null ? null : o.toString();
    }
}
