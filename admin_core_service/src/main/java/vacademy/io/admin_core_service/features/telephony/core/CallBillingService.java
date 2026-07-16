package vacademy.io.admin_core_service.features.telephony.core;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.credits.client.CreditClient;
import vacademy.io.admin_core_service.features.telephony.core.dto.VoiceCallingSettingsPojo;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * Per-minute credit metering for phone calls — the "P4" seam the telephony
 * package always planned ({@link VoiceCallingSettingsPojo.BillingConfig}).
 *
 * <p>Two independent meters can fire for one physical call:
 * <ul>
 *   <li><b>Voice leg</b> ({@code voice_call_out} / {@code voice_call_in}) — the
 *       telephony minutes of calls carried on VACADEMY-PROVIDED trunks: provider
 *       {@code PLIVO} (Vacademy Voice) and {@code VACADEMY_AI} (our AI dials on the
 *       same Plivo subaccounts). Airtel/Exotel/Vonage calls ride the INSTITUTE'S own
 *       carrier account, and MANUAL/MOCK aren't real carried calls — never billed.</li>
 *   <li><b>AI leg</b> ({@code ai_call_out} / {@code ai_call_in}) — the AI-conversation
 *       minutes (STT+LLM+TTS) of a completed AI call, billed off the verified
 *       ai_call_result. Fires for VACADEMY_AI and AAVTAAR, never MOCK. An outbound
 *       Vacademy-AI call therefore pays voice + AI; an inbound IVR call answered by a
 *       human pays voice only; the same inbound handled by the AI agent pays both.</li>
 * </ul>
 *
 * <p><b>Rates</b>: per-institute override first ({@code VOICE_CALLING_SETTING.billing}
 * in institutes.setting_json — manually editable in the DB), then the global
 * {@code credit_pricing} row ({@code token_rate} = credits per minute,
 * {@code minimum_charge} = per-call floor; seeded in V378). A rate of 0 disables
 * that meter; a missing pricing row skips billing with a warn (never a default).
 *
 * <p><b>Cost</b> = max(minimum_charge, ceil(duration/60) × perMinute) — same shape as
 * call_intelligence. The wallet write goes through ai_service ({@link CreditClient}
 * → POST /credits/v1/deduct) with {@code precomputed_credits} (so ai_service's
 * token-math never reinterprets our rate), {@code allow_negative=true} (the call
 * already happened — post-paid, balance may go negative like transcription does)
 * and an idempotency key ({@code voice_call:{callLogId}} / {@code ai_call:{callLogId}})
 * enforced by the V243 partial unique index — webhook retries and event replays
 * can invoke this any number of times and charge exactly once.
 *
 * <p>Async + best-effort: never blocks or fails a webhook. A dropped HTTP call is
 * healed by the next webhook replay for the same row (same idempotency key).
 */
@Service
public class CallBillingService {

    private static final Logger log = LoggerFactory.getLogger(CallBillingService.class);

    /** Providers whose telephony minutes ride Vacademy-paid trunks. */
    private static final List<String> VOICE_BILLABLE_PROVIDERS =
            List.of(ProviderType.PLIVO, ProviderType.VACADEMY_AI);
    /** AI providers whose conversation minutes we meter (MOCK excluded). */
    private static final List<String> AI_BILLABLE_PROVIDERS =
            List.of(ProviderType.VACADEMY_AI, ProviderType.AAVTAAR);

    public static final String RT_VOICE_OUT = "voice_call_out";
    public static final String RT_VOICE_IN = "voice_call_in";
    public static final String RT_AI_OUT = "ai_call_out";
    public static final String RT_AI_IN = "ai_call_in";

    @Autowired private CreditClient creditClient;
    @Autowired private VoiceCallingSettingsService voiceSettings;
    @PersistenceContext private EntityManager entityManager;

    public boolean isVoiceBillableProvider(String providerType) {
        return providerType != null && VOICE_BILLABLE_PROVIDERS.contains(providerType);
    }

    public boolean isAiBillableProvider(String provider) {
        return provider != null && AI_BILLABLE_PROVIDERS.contains(provider);
    }

    /** Telephony-minutes meter. Call only for COMPLETED rows with duration > 0. */
    @Async
    public void billVoiceLeg(String callLogId, String instituteId, String providerType,
                             String direction, int durationSeconds) {
        try {
            String requestType = "INBOUND".equalsIgnoreCase(direction) ? RT_VOICE_IN : RT_VOICE_OUT;
            bill(callLogId, instituteId, requestType, durationSeconds,
                    "voice_call:" + callLogId,
                    "Call minutes (" + providerType + " " + direction + ")");
        } catch (Exception e) {
            log.error("call-billing: voice leg failed call={} inst={}: {}",
                    callLogId, instituteId, e.getMessage());
        }
    }

    /** AI-conversation-minutes meter. Call only for verified, completed AI results. */
    @Async
    public void billAiLeg(String callLogId, String instituteId, String provider,
                          String direction, int durationSeconds) {
        try {
            String requestType = "INBOUND".equalsIgnoreCase(direction) ? RT_AI_IN : RT_AI_OUT;
            bill(callLogId, instituteId, requestType, durationSeconds,
                    "ai_call:" + callLogId,
                    "AI call minutes (" + provider + " " + direction + ")");
        } catch (Exception e) {
            log.error("call-billing: ai leg failed call={} inst={}: {}",
                    callLogId, instituteId, e.getMessage());
        }
    }

    private void bill(String callLogId, String instituteId, String requestType,
                      int durationSeconds, String idempotencyKey, String description) {
        if (instituteId == null || instituteId.isBlank() || durationSeconds <= 0) return;

        Rate rate = resolveRate(instituteId, requestType);
        if (rate == null) {
            log.warn("call-billing: no rate for {} (no override, no credit_pricing row) — skipping call={}",
                    requestType, callLogId);
            return;
        }
        if (rate.perMinute().signum() <= 0 && rate.minimum().signum() <= 0) {
            return; // 0-rate = metering disabled for this key/institute
        }

        long minutes = (durationSeconds + 59) / 60; // ceil, min 1 for any >0 duration
        BigDecimal cost = rate.perMinute().multiply(BigDecimal.valueOf(minutes))
                .max(rate.minimum())
                .setScale(4, RoundingMode.HALF_UP);
        if (cost.signum() <= 0) return;

        boolean ok = creditClient.deductPrecomputed(
                instituteId, requestType, description + " · " + minutes + " min",
                cost, idempotencyKey);
        log.info("call-billing: {} call={} inst={} mins={} credits={} ok={}",
                requestType, callLogId, instituteId, minutes, cost, ok);
    }

    private record Rate(BigDecimal perMinute, BigDecimal minimum) {}

    /**
     * Per-institute override → global credit_pricing. Overrides live in
     * VOICE_CALLING_SETTING.billing (institutes.setting_json) so ops can set them with a
     * manual DB update today and a settings UI later; the legacy blanket
     * perMinuteCreditOverride (pre-dates per-key fields) applies to the VOICE meters only.
     */
    private Rate resolveRate(String instituteId, String requestType) {
        VoiceCallingSettingsPojo.BillingConfig billing = null;
        try {
            VoiceCallingSettingsPojo pojo = voiceSettings.get(instituteId);
            billing = pojo == null ? null : pojo.getBilling();
        } catch (Exception e) {
            log.debug("call-billing: settings load failed for {} — using global rates", instituteId);
        }
        if (billing != null) {
            Double override = switch (requestType) {
                case RT_VOICE_OUT -> billing.getVoiceCallOutPerMinuteCredits() != null
                        ? billing.getVoiceCallOutPerMinuteCredits() : billing.getPerMinuteCreditOverride();
                case RT_VOICE_IN -> billing.getVoiceCallInPerMinuteCredits() != null
                        ? billing.getVoiceCallInPerMinuteCredits() : billing.getPerMinuteCreditOverride();
                case RT_AI_OUT -> billing.getAiCallOutPerMinuteCredits();
                case RT_AI_IN -> billing.getAiCallInPerMinuteCredits();
                default -> null;
            };
            if (override != null) {
                return new Rate(BigDecimal.valueOf(override), BigDecimal.ZERO);
            }
        }

        // Global default from credit_pricing (same DB): token_rate = credits/minute.
        try {
            @SuppressWarnings("unchecked")
            List<Object[]> rows = entityManager.createNativeQuery(
                    "SELECT token_rate, minimum_charge FROM credit_pricing " +
                    "WHERE request_type = :rt AND is_active = TRUE")
                    .setParameter("rt", requestType)
                    .getResultList();
            if (rows.isEmpty()) return null;
            Object[] row = rows.get(0);
            return new Rate(toDecimal(row[0]), toDecimal(row[1]));
        } catch (Exception e) {
            log.error("call-billing: credit_pricing lookup failed for {}: {}", requestType, e.getMessage());
            return null;
        }
    }

    private static BigDecimal toDecimal(Object o) {
        if (o == null) return BigDecimal.ZERO;
        if (o instanceof BigDecimal bd) return bd;
        return new BigDecimal(o.toString());
    }
}
