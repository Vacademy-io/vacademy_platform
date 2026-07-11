package vacademy.io.admin_core_service.features.telephony.core;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;
import vacademy.io.admin_core_service.features.audience.entity.UserLeadProfile;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.audience.repository.UserLeadProfileRepository;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallRequestDTO;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallResponseDTO;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallingSettingsPojo;
import vacademy.io.admin_core_service.features.telephony.enums.CallDirection;
import vacademy.io.admin_core_service.features.telephony.enums.CallStatus;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.AiCallResult;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyCallLog;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.AiCallResultRepository;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyCallLogRepository;
import vacademy.io.admin_core_service.features.telephony.spi.dto.AiCallHandle;
import vacademy.io.admin_core_service.features.telephony.spi.dto.AiCallSpec;
import vacademy.io.admin_core_service.features.telephony.spi.dto.CallSubjectType;
import vacademy.io.common.exceptions.VacademyException;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * "Click to AI call" — places one AI call for a lead through the
 * {@code AiOutboundCaller} port (resolved by provider from
 * {@link AiVoiceProviderRegistry}). Provider-neutral: a new AI provider needs no
 * change here.
 *
 * The caller may pass only the {@code responseId} (the lead-row button + the
 * CALL_AI workflow node do): this resolves the lead's phone + user id from the
 * audience_response, and the campaignId from the institute's AI_CALLING_SETTING,
 * when they're blank — so callers don't need to know either.
 *
 * Single-leg by nature, so it does NOT use the counsellor-bridge
 * {@code CallOrchestrator}/{@code OutboundCallInitiator}. It mirrors that phased
 * shape (no DB tx across the HTTP hop): persist INITIATED → dispatch → QUEUED/FAILED.
 */
@Service
@RequiredArgsConstructor
public class AiCallService {

    private static final Logger log = LoggerFactory.getLogger(AiCallService.class);

    private final TelephonyCallLogRepository callLogRepo;
    private final AiVoiceProviderRegistry registry;
    private final AudienceResponseRepository audienceResponseRepository;
    private final AiCallingSettingsService settingsService;
    private final UserMobileResolver userMobileResolver;
    private final UserLeadProfileRepository userLeadProfileRepository;
    private final AiCallResultRepository aiCallResultRepo;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Window in which a second AI dial for the same lead is treated as a duplicate of
     * the first and skipped. Must stay below the smallest legitimate retry gap
     * (retryGapMinutes, min 1 min = 60s) so real retries are never suppressed; the
     * duplicate we're collapsing is placed milliseconds apart.
     */
    @org.springframework.beans.factory.annotation.Value("${aavtaar.dispatch.dedup-window-sec:30}")
    private long dedupWindowSec;

    /**
     * Server-wide fallback daily AI-call cap per institute+provider, used when the
     * institute hasn't set its own {@code maxCallsPerDay}. A finite default means a
     * runaway campaign is bounded out of the box; 0 disables the fleet-wide cap.
     */
    @org.springframework.beans.factory.annotation.Value("${telephony.ai.max-calls-per-day-default:500}")
    private int globalMaxCallsPerDay;

    /**
     * Striped per-lead locks so the dedup check + INITIATED insert are atomic for a
     * given lead WITHIN this replica (the duplicate dispatch originates on one replica
     * — same workflow run / scheduler tick / bulk pool). Bounded (no per-lead growth);
     * the time-window check is the cross-replica backstop.
     */
    private final Object[] dispatchLocks = newLockStripes(64);

    private static Object[] newLockStripes(int n) {
        Object[] a = new Object[n];
        for (int i = 0; i < n; i++) a[i] = new Object();
        return a;
    }

    private Object lockFor(String key) {
        return dispatchLocks[Math.floorMod(key.hashCode(), dispatchLocks.length)];
    }

    /**
     * @Lazy field (not constructor) for the MOCK path only: AiCallService synthesizes a
     * result and runs it through the outcome processor. Lazy keeps construction order
     * flexible and avoids any future cycle if the processor grows a dependency back here.
     */
    @Autowired
    @Lazy
    private AiCallOutcomeProcessor aiCallOutcomeProcessor;

    public AiCallResponseDTO placeCall(AiCallRequestDTO req, String counsellorUserId) {
        if (req == null || isBlank(req.getInstituteId())) {
            throw new VacademyException("instituteId is required.");
        }
        // Provider + campaign default to the institute's AI_CALLING_SETTING, so swapping
        // the AI agent is a settings change, not a code change.
        AiCallingSettingsPojo settings = settingsService.get(req.getInstituteId());
        String provider = isBlank(req.getProvider()) ? settings.getProvider() : req.getProvider();
        if (isBlank(provider)) provider = ProviderType.AAVTAAR;

        String userId = req.getUserId();
        String phone = req.getPhoneNumber();
        // Resolve phone/userId from the lead when the caller supplied only a responseId.
        if ((isBlank(userId) || isBlank(phone)) && !isBlank(req.getResponseId())) {
            AudienceResponse ar = audienceResponseRepository.findById(req.getResponseId()).orElse(null);
            if (ar != null) {
                if (isBlank(userId)) userId = ar.getUserId();
                if (isBlank(phone)) phone = ar.getParentMobile();
            }
        }
        // Fall back to the user's mobile (auth_service) when the lead has no
        // parent_mobile — the same resolution the Exotel bridge path uses, since
        // the phone shown on the lead row often comes from the user's profile.
        if (isBlank(phone) && !isBlank(userId)) {
            phone = userMobileResolver.findMobile(userId).orElse(null);
        }

        // Campaign resolution (provider-agnostic): an explicit raw campaignId wins (back-
        // compat), else resolve the named agent for THIS provider from the campaigns
        // registry, else the institute default. So the node/scheduler can carry just a
        // provider-neutral agent name and still reach the right provider campaign id.
        String campaignId = isBlank(req.getCampaignId())
                ? settings.resolveCampaignId(provider, req.getCampaignName())
                : req.getCampaignId();

        // Subject envelope (LEAD default → subjectId = responseId, preserving the lead flow).
        String subjectType = isBlank(req.getSubjectType()) ? CallSubjectType.LEAD.name() : req.getSubjectType();
        String subjectId = isBlank(req.getSubjectId()) ? req.getResponseId() : req.getSubjectId();
        boolean isLead = CallSubjectType.fromString(subjectType) == CallSubjectType.LEAD;
        boolean mock = ProviderType.MOCK.equalsIgnoreCase(provider);

        if (isBlank(userId)) throw new VacademyException("Could not resolve the subject's user id for the call.");
        // A real dial needs a phone + campaign; a MOCK call never leaves the box, so it only
        // needs a user to attach the synthetic outcome to.
        if (!mock) {
            if (isBlank(phone)) throw new VacademyException("This subject has no phone number on file.");
            if (isBlank(campaignId)) {
                throw new VacademyException("No campaign configured — set a default Campaign ID in Settings → AI Calling.");
            }
        }

        // Don't re-call a LEAD that's already been handed to a counsellor (AI handoff or
        // manual assignment) — the bot's job ends once a human owns the lead. This guard is
        // lead-specific; non-lead subjects (e.g. student feedback) have their eligibility
        // decided by the caller/scheduler.
        if (isLead && leadAlreadyAssigned(userId, req.getInstituteId())) {
            log.info("AI call skipped: lead {} is already assigned to a counsellor", userId);
            return AiCallResponseDTO.builder()
                    .status("SKIPPED_ASSIGNED")
                    .dispatched(false)
                    .providerMessage("Lead is already assigned to a counsellor — AI call skipped.")
                    .build();
        }

        // Daily spend guardrail: bound the WHOLE institute's AI dials on this provider
        // in a rolling 24h window. Every dial path (CALL_AI node, bulk campaign, manual
        // click) funnels through here, so this one check covers all three. Real calls
        // only — MOCK never leaves the box. Per-institute setting wins; else the
        // server-wide default. Returns a distinct skip status the campaign loop can log.
        if (!mock) {
            int cap = settings.getMaxCallsPerDay() > 0 ? settings.getMaxCallsPerDay() : globalMaxCallsPerDay;
            if (cap > 0) {
                java.sql.Timestamp since = java.sql.Timestamp.from(Instant.now().minus(Duration.ofHours(24)));
                long placed = callLogRepo.countOutboundSince(req.getInstituteId(), provider, since);
                if (placed >= cap) {
                    log.warn("AI call skipped: institute {} hit the daily cap of {} {} calls ({} in the last 24h)",
                            req.getInstituteId(), cap, provider, placed);
                    return AiCallResponseDTO.builder()
                            .status("SKIPPED_DAILY_CAP")
                            .dispatched(false)
                            .providerMessage("Daily AI-call limit reached for this institute.")
                            .build();
                }
            }
        }

        // De-duplicate a near-simultaneous double dispatch for the SAME lead. Aavtaar
        // doesn't echo our correlation id, so two dials placed within milliseconds (the
        // CALL_AI node entered twice / a bulk run + the node) become two real calls — one
        // connects, the other gets BUSY — and two call-log rows. The per-lead lock makes
        // the check+insert atomic in this replica; the time window keeps it from ever
        // suppressing a legitimate retry (those are >= retryGapMinutes apart).
        String dedupKey = req.getInstituteId() + ":" + userId + ":" + provider;
        TelephonyCallLog row;
        synchronized (lockFor(dedupKey)) {
            java.sql.Timestamp since = java.sql.Timestamp.from(
                    Instant.now().minusSeconds(Math.max(1, dedupWindowSec)));
            if (callLogRepo.existsRecentByInstituteUserProvider(req.getInstituteId(), userId, provider, since)) {
                log.info("AI call de-duped: a {} call for lead {} was just placed (within {}s) — skipping duplicate dispatch",
                        provider, userId, dedupWindowSec);
                return AiCallResponseDTO.builder()
                        .status("SKIPPED_DUPLICATE")
                        .dispatched(false)
                        .providerMessage("A call for this lead was just placed — duplicate dispatch skipped.")
                        .build();
            }
            String callLogId = UUID.randomUUID().toString();
            row = TelephonyCallLog.builder()
                    .id(callLogId)
                    .instituteId(req.getInstituteId())
                    .providerType(provider)
                    .responseId(req.getResponseId())
                    .subjectType(subjectType)
                    .subjectId(subjectId)
                    .userId(userId)
                    .counsellorUserId(counsellorUserId)
                    .direction(CallDirection.OUTBOUND.name())
                    .toNumber(phone)
                    .status(CallStatus.INITIATED.name())
                    .recordingFetchAttempts(0)
                    .recordingLogged(false)
                    .build();
            row.markNew();
            callLogRepo.save(row); // auto-commits → visible to a concurrent duplicate's check
        }
        String callLogId = row.getId();

        // MOCK provider: don't dial. Fabricate a completed result (canned extracted Q&A) and
        // run it through the SAME outcome pipeline a real webhook would, so the full
        // cohort → call → outcome → action loop works with no provider credentials.
        if (mock) {
            return mockComplete(row, req, subjectType, campaignId, phone);
        }

        // Carry the subject in the metadata bag so it round-trips on the provider's
        // webhook → report for subject-aware outcome handling.
        Map<String, Object> metadata = new HashMap<>();
        if (req.getMetadata() != null) metadata.putAll(req.getMetadata());
        metadata.put("subjectType", subjectType);
        if (subjectId != null) metadata.put("subjectId", subjectId);

        AiCallSpec spec = AiCallSpec.builder()
                .instituteId(req.getInstituteId())
                .userId(userId)
                .responseId(req.getResponseId())
                .phoneNumber(phone)
                .campaignId(campaignId)
                .preferredNumberId(req.getPreferredNumberId())
                .customerName(req.getCustomerName())
                .customerEmail(req.getCustomerEmail())
                .correlationId(callLogId)
                .subjectType(subjectType)
                .subjectId(subjectId)
                .metadata(metadata)
                .build();

        try {
            AiCallHandle handle = registry.caller(provider).placeCall(spec);
            if (handle.getProviderCallId() != null) row.setProviderCallId(handle.getProviderCallId());
            row.setStatus(handle.isAccepted() ? CallStatus.QUEUED.name() : CallStatus.FAILED.name());
            if (!handle.isAccepted()) row.setTerminationReason("provider_rejected");
            callLogRepo.save(row);

            return AiCallResponseDTO.builder()
                    .callLogId(callLogId)
                    .status(row.getStatus())
                    .dispatched(handle.isAccepted())
                    .providerMessage(handle.getMessage())
                    .build();
        } catch (Exception e) {
            row.setStatus(CallStatus.FAILED.name());
            row.setTerminationReason("provider_initiate_failure");
            callLogRepo.save(row);
            log.error("AI call failed for lead {} (callLog {})", userId, callLogId, e);
            throw new VacademyException("AI call failed: " + e.getMessage());
        }
    }

    /** True if the lead's user already has a counsellor on their lead profile. */
    private boolean leadAlreadyAssigned(String userId, String instituteId) {
        if (isBlank(userId) || isBlank(instituteId)) return false;
        return userLeadProfileRepository.findByUserIdAndInstituteId(userId, instituteId)
                .map(UserLeadProfile::getAssignedCounselorId)
                .filter(id -> id != null && !id.isBlank())
                .isPresent();
    }

    /**
     * MOCK provider path: fabricate a completed AiCallResult and run it through the real
     * outcome pipeline (synchronously). The downstream processor branches on the call log's
     * subject_type — lead subjects get the lead actions, package/live-session subjects get
     * feedback capture — so this exercises the whole loop with no provider integration.
     */
    private AiCallResponseDTO mockComplete(TelephonyCallLog row, AiCallRequestDTO req,
                                           String subjectType, String campaignId, String phone) {
        Map<String, Object> qa = mockExtractedQa(subjectType, row.getUserId());
        String raw;
        try {
            raw = objectMapper.writeValueAsString(Map.of(
                    "mock", true, "subjectType", subjectType, "extractedQa", qa));
        } catch (Exception e) {
            raw = "{\"mock\":true}";
        }
        boolean isLead = CallSubjectType.fromString(subjectType) == CallSubjectType.LEAD;
        AiCallResult result = AiCallResult.builder()
                .provider(ProviderType.MOCK)
                .callUuid("mock-" + row.getId())
                .instituteId(req.getInstituteId())
                .correlationId(row.getId())
                .direction(CallDirection.OUTBOUND.name())
                .campaignId(campaignId)
                .phoneNumber(phone)
                .customerName(req.getCustomerName())
                .status("completed")
                .disposition(isLead ? "Interested" : "Completed")
                .durationSeconds(60 + Math.floorMod(row.getId().hashCode(), 120))
                .callStart(Instant.now())
                .extractedQa(qa)
                .rawPayload(raw)
                .processingStatus("RECEIVED")
                .build();
        aiCallResultRepo.save(result);
        aiCallOutcomeProcessor.process(result.getId());
        log.info("AI call (MOCK) synthesized + processed: callLog={} subject={}", row.getId(), subjectType);
        return AiCallResponseDTO.builder()
                .callLogId(row.getId())
                .status("MOCK_PROCESSED")
                .dispatched(true)
                .providerMessage("Mock AI call synthesized and run through the outcome pipeline.")
                .build();
    }

    /**
     * Canned, deterministically-varied feedback Q&A — no provider, no data file. A cohort
     * produces a spread of ratings/comments (seeded on the user id) so the downstream
     * feedback capture has realistic-looking data. Lead mocks just carry an interest flag.
     */
    private Map<String, Object> mockExtractedQa(String subjectType, String seedKey) {
        Map<String, Object> qa = new HashMap<>();
        qa.put("mock", true);
        if (CallSubjectType.fromString(subjectType) == CallSubjectType.LEAD) {
            qa.put("interest", "Interested");
            return qa;
        }
        int seed = seedKey == null ? 0 : Math.floorMod(seedKey.hashCode(), 1000);
        String[] comments = {
                "Found the session clear and well paced.",
                "Good content; would like more practice problems.",
                "Pacing was a bit fast in the second half.",
                "Very helpful — the examples made it click.",
        };
        qa.put("feedbackRating", 3 + (seed % 3));        // 3..5
        qa.put("comments", comments[seed % comments.length]);
        qa.put("wouldRecommend", seed % 4 != 0);
        return qa;
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
