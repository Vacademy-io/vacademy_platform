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
import vacademy.io.admin_core_service.features.telephony.persistence.repository.AiCallResultRepository;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyCallLogRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;

/**
 * Per-minute credit metering for phone calls — the "P4" seam the telephony
 * package always planned ({@link VoiceCallingSettingsPojo.BillingConfig}).
 *
 * <p>Two independent meters can fire for one physical call:
 * <ul>
 *   <li><b>Voice leg</b> ({@code voice_call_out} / {@code voice_call_in}) — telephony
 *       minutes of calls carried on VACADEMY-PROVIDED trunks: provider {@code PLIVO}
 *       (Vacademy Voice) and {@code VACADEMY_AI} (our AI dials on the same Plivo
 *       subaccounts). Airtel/Exotel/Vonage ride the INSTITUTE'S own carrier account,
 *       and MANUAL/MOCK aren't real carried calls — never billed.</li>
 *   <li><b>AI leg</b> ({@code ai_call_out} / {@code ai_call_in}) — AI-conversation
 *       minutes (STT+LLM+TTS) of a completed AI call, billed off the VERIFIED
 *       ai_call_result (providers VACADEMY_AI and AAVTAAR, never MOCK). An outbound
 *       Vacademy-AI call pays voice + AI; an inbound IVR call answered by a human
 *       pays voice only; the same inbound handled by the AI agent pays both.</li>
 * </ul>
 *
 * <p><b>Rates</b>: per-institute override first ({@code VOICE_CALLING_SETTING.billing}
 * — ops-managed via manual DB edit; the tenant settings endpoint refuses to persist
 * it, see VoiceConfigController), then the global {@code credit_pricing} row
 * ({@code token_rate} = credits/minute, {@code minimum_charge} = per-call floor;
 * seeded in V378). A 0 rate disables that meter; a missing row skips with a warn.
 *
 * <p><b>Cost</b> = max(minimum_charge, ceil(duration/60) × perMinute). The wallet
 * write goes through ai_service ({@link CreditClient#deductPrecomputed} → the
 * internal-token-gated POST /credits/v1/deduct) with {@code precomputed_credits},
 * {@code allow_negative=true} (post-paid — the call already happened) and an
 * idempotency key enforced by the V243 partial unique index, so any number of
 * attempts charge exactly once.
 *
 * <p><b>At-least-once</b>: on an acknowledged deduction the source row is STAMPED
 * ({@code credits_billed_at}); unstamped completed rows are re-attempted by
 * {@link CallBillingReconciliationJob}, so a lost HTTP call (ai_service restart)
 * is healed instead of silently leaking revenue. Async + never blocks a webhook.
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

    /**
     * Engine assumed when an agent cannot be resolved. MUST match the voice bot's
     * own fallback for a missing tts_model (voice_bot_service/app/config.py,
     * TTS_MODEL default) — see {@link #resolveEngine}.
     */
    private static final String ENGINE_FALLBACK = "sarvam";

    @Autowired private CreditClient creditClient;
    @Autowired private VoiceCallingSettingsService voiceSettings;
    @Autowired private TelephonyCallLogRepository callLogRepo;
    @Autowired private AiCallResultRepository aiCallResultRepo;
    @PersistenceContext private EntityManager entityManager;

    public boolean isVoiceBillableProvider(String providerType) {
        return providerType != null && VOICE_BILLABLE_PROVIDERS.contains(providerType);
    }

    public boolean isAiBillableProvider(String provider) {
        return provider != null && AI_BILLABLE_PROVIDERS.contains(provider);
    }

    /**
     * Stable dedup identity for the AI-minutes charge of one PHYSICAL call — or null
     * when no safe identity exists (then DO NOT bill: an unbindable report with no
     * provider call id mints a brand-new ai_call_result + call-log row on every
     * webhook re-delivery, so any row-derived key would charge once per delivery).
     * Preference: the provider's own call id (re-POSTs with the same call_uuid upsert
     * in place → stable) → the call-log id, but ONLY when the row provably pre-dates
     * the report (correlationId = the id we minted at dial/answer time, or the report
     * bound to an existing row) — never the id of a row the promotion itself created.
     */
    public static String aiIdempotencyKey(String provider, String callUuid,
                                          String correlationId, String boundCallLogId) {
        if (callUuid != null && !callUuid.isBlank()) {
            return "ai_call:uuid:" + provider + ":" + callUuid.trim();
        }
        if (boundCallLogId != null && correlationId != null && !correlationId.isBlank()) {
            return "ai_call:" + boundCallLogId;
        }
        return null;
    }

    /** Telephony-minutes meter. Call only for COMPLETED rows with duration > 0. */
    @Async("callBillingExecutor")
    public void billVoiceLeg(String callLogId, String instituteId, String providerType,
                             String direction, int durationSeconds) {
        try {
            String requestType = "INBOUND".equalsIgnoreCase(direction) ? RT_VOICE_IN : RT_VOICE_OUT;
            boolean ok = bill(callLogId, instituteId, requestType, durationSeconds,
                    "voice_call:" + callLogId,
                    "Call minutes (" + providerType + " " + direction + ")");
            if (ok) callLogRepo.markCreditsBilled(callLogId, Instant.now());
        } catch (Exception e) {
            log.error("call-billing: voice leg failed call={} inst={}: {}",
                    callLogId, instituteId, e.getMessage());
        }
    }

    /**
     * AI-conversation-minutes meter. {@code idempotencyKey} MUST come from
     * {@link #aiIdempotencyKey}; {@code aiCallResultId} is stamped on success so the
     * reconciliation sweep stops re-attempting.
     */
    @Async("callBillingExecutor")
    public void billAiLeg(String idempotencyKey, String aiCallResultId, String instituteId,
                          String provider, String direction, int durationSeconds,
                          String agentId) {
        try {
            String requestType = "INBOUND".equalsIgnoreCase(direction) ? RT_AI_IN : RT_AI_OUT;
            String engine = resolveEngine(provider, agentId);
            BigDecimal surcharge = resolveEngineSurcharge(engine);
            boolean ok = bill(aiCallResultId, instituteId, requestType, durationSeconds,
                    idempotencyKey,
                    "AI call minutes (" + provider + " " + direction
                            + (engine != null ? " · " + engine : "") + ")",
                    surcharge);
            if (ok) aiCallResultRepo.markCreditsBilled(aiCallResultId, Instant.now());
        } catch (Exception e) {
            log.error("call-billing: ai leg failed result={} inst={}: {}",
                    aiCallResultId, instituteId, e.getMessage());
        }
    }

    /** @return true when ai_service acknowledged the charge (or its idempotent replay). */
    private boolean bill(String refId, String instituteId, String requestType,
                         int durationSeconds, String idempotencyKey, String description) {
        return bill(refId, instituteId, requestType, durationSeconds, idempotencyKey,
                description, BigDecimal.ZERO);
    }

    private boolean bill(String refId, String instituteId, String requestType,
                         int durationSeconds, String idempotencyKey, String description,
                         BigDecimal engineSurcharge) {
        if (instituteId == null || instituteId.isBlank() || durationSeconds <= 0) return false;

        Rate rate = resolveRate(instituteId, requestType);
        if (rate == null) {
            log.warn("call-billing: no rate for {} (no override, no credit_pricing row) — skipping ref={}",
                    requestType, refId);
            return false;
        }
        BigDecimal perMinute = rate.perMinute();
        if (engineSurcharge != null && engineSurcharge.signum() > 0) {
            if (rate.negotiated()) {
                // A per-institute override is an AGREED all-in price. Silently adding
                // a surcharge on top would break a negotiated number that somebody
                // quoted in writing, so the override always wins outright.
                log.info("call-billing: institute {} has a negotiated {} rate — engine surcharge {} not applied",
                        instituteId, requestType, engineSurcharge);
            } else {
                perMinute = perMinute.add(engineSurcharge);
            }
        }
        long minutes = (durationSeconds + 59) / 60; // ceil, min 1 for any >0 duration
        BigDecimal cost = perMinute.multiply(BigDecimal.valueOf(minutes))
                .max(rate.minimum())
                .setScale(4, RoundingMode.HALF_UP);
        if (cost.signum() <= 0) {
            // 0-rate = metering disabled (globally or per-institute): report success so
            // the caller stamps the row and the sweeper doesn't retry forever.
            return true;
        }

        boolean ok = creditClient.deductPrecomputed(
                instituteId, requestType, description + " · " + minutes + " min",
                cost, idempotencyKey);
        log.info("call-billing: {} ref={} inst={} mins={} credits={} ok={}",
                requestType, refId, instituteId, minutes, cost, ok);
        return ok;
    }

    /** @param negotiated true when this came from a per-institute override, i.e. an
     *  agreed all-in price that engine surcharges must not be stacked onto. */
    private record Rate(BigDecimal perMinute, BigDecimal minimum, boolean negotiated) {}

    /**
     * Per-institute override → global credit_pricing. Overrides live in
     * VOICE_CALLING_SETTING.billing (institutes.setting_json), which is OPS-ONLY: the
     * tenant-facing voice-config save endpoint preserves the stored billing block
     * (a tenant zeroing their own rates = free calls), so writes happen via manual DB
     * update today and a root-admin surface later. The legacy blanket
     * perMinuteCreditOverride applies to the VOICE meters only.
     */
    /**
     * Which TTS engine this call is PRICED against.
     *
     * <p>Deliberately the agent's CONFIGURED engine, not the engine that actually
     * spoke (which the voice bot records separately in the call diagnostics). The
     * institute agreed a price for the engine they chose; if our own infrastructure
     * falls back to the other one — a missing API key, a vendor outage — that is our
     * problem, and letting it move the customer's bill either way would make their
     * per-minute price depend on our incidents. The diagnostics field is the audit
     * trail for spotting the mismatch.
     *
     * <p>Only VACADEMY_AI calls run through our TTS at all. AAVTAAR brings its own,
     * so there is nothing of ours to surcharge.
     *
     * <p>An unresolvable agent (no id, deleted row, or the built-in fallback persona,
     * which has no row) resolves to 'sarvam' — matching the voice bot's OWN fallback
     * for a missing tts_model. These two defaults must stay in lockstep: if they ever
     * disagree we would serve one engine and charge for the other.
     */
    private String resolveEngine(String provider, String agentId) {
        if (!ProviderType.VACADEMY_AI.equals(provider)) return null;
        if (agentId == null || agentId.isBlank()) return ENGINE_FALLBACK;
        try {
            List<?> rows = entityManager.createNativeQuery(
                    "SELECT tts_model FROM ai_agent WHERE id = :id")
                    .setParameter("id", agentId)
                    .getResultList();
            if (rows.isEmpty()) return ENGINE_FALLBACK;
            Object v = rows.get(0);
            String m = v == null ? null : String.valueOf(v).trim().toLowerCase();
            return (m == null || m.isEmpty() || "null".equals(m)) ? ENGINE_FALLBACK : m;
        } catch (Exception e) {
            log.error("call-billing: tts_model lookup failed for agent {}: {}", agentId, e.getMessage());
            return ENGINE_FALLBACK;
        }
    }

    /**
     * Per-minute credit surcharge for an engine, from ai_tts_model_pricing (V421).
     *
     * <p>Returns ZERO on a missing row and logs it loudly. That is a deliberate
     * choice to UNDER-bill rather than skip the charge entirely: dropping the whole
     * AI-minutes charge because a pricing row is absent would lose the base revenue
     * too, and the reconciliation sweeper would then retry it forever.
     */
    private BigDecimal resolveEngineSurcharge(String engine) {
        if (engine == null || engine.isBlank()) return BigDecimal.ZERO;
        try {
            List<?> rows = entityManager.createNativeQuery(
                    "SELECT surcharge_credits_per_min FROM ai_tts_model_pricing "
                    + "WHERE model = :m AND is_active = TRUE")
                    .setParameter("m", engine)
                    .getResultList();
            if (rows.isEmpty()) {
                log.error("call-billing: no ai_tts_model_pricing row for engine '{}' — billing base rate only", engine);
                return BigDecimal.ZERO;
            }
            return toDecimal(rows.get(0));
        } catch (Exception e) {
            log.error("call-billing: engine surcharge lookup failed for '{}': {}", engine, e.getMessage());
            return BigDecimal.ZERO;
        }
    }

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
                return new Rate(BigDecimal.valueOf(override), BigDecimal.ZERO, true);
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
            return new Rate(toDecimal(row[0]), toDecimal(row[1]), false);
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
