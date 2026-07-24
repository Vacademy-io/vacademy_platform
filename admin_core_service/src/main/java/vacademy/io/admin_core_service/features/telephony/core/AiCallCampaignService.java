package vacademy.io.admin_core_service.features.telephony.core;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;
import vacademy.io.admin_core_service.features.audience.repository.AudienceRepository;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallRequestDTO;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallingSettingsPojo;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;
import vacademy.io.admin_core_service.features.telephony.enums.CallStatus;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;

/**
 * "AI calls first for an audience list." Places an AI call for every eligible lead
 * in an audience; each call's outcome (and the counsellor assignment that follows)
 * is driven by the end-of-call webhook + {@link AiCallOutcomeProcessor}.
 *
 * <p>Dispatch is <b>async + paced</b>: validation + counting run on the request
 * thread (so the caller gets an immediate "queued N" answer), then the per-lead
 * click-to-calls run on a bounded background pool ({@code aiCallDispatchExecutor})
 * with a small gap between calls so we don't burst Aavtaar's rate limit. Phone
 * numbers are resolved per lead at call time ({@code parent_mobile} → user profile),
 * so a lead with only a profile number still gets called.
 *
 * <p>For very large lists the scalable alternative is Aavtaar's native
 * {@code /upload-contacts} (push the whole list, they dial) — pending vendor
 * confirmation of how an uploaded list actually starts dialing. This loop is the
 * proven path and dials for certain.
 */
@Service
@RequiredArgsConstructor
public class AiCallCampaignService {

    private static final Logger log = LoggerFactory.getLogger(AiCallCampaignService.class);

    private final AudienceResponseRepository audienceResponseRepository;
    private final AudienceRepository audienceRepository;
    private final AiCallingSettingsService settingsService;
    private final AiCallService aiCallService;
    private final vacademy.io.admin_core_service.features.telephony.persistence.repository
            .TelephonyCallLogRepository callLogRepo;

    // Field-injected (not via @RequiredArgsConstructor) because there are multiple
    // Executor beans and this project's lombok.config doesn't copy @Qualifier onto
    // the generated constructor — by-type injection would be ambiguous.
    @Autowired
    @Qualifier("aiCallDispatchExecutor")
    private Executor dispatchExecutor;

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    /** Gap between consecutive calls in a bulk run, to stay under Aavtaar's rate limit. */
    @Value("${aavtaar.bulk.pace-ms:800}")
    private long paceMs;

    /** A bulk run for the same audience is refused within this window (idempotency —
     *  prevents a re-fire of the same list from double-dialing every lead). */
    @Value("${aavtaar.bulk.cooldown-sec:300}")
    private long bulkCooldownSec;

    public record StartResult(int total, int eligible, boolean dispatched, String message) {}

    /** UI cap for calls-in-parallel. Bounded by the Mumbai voice box (1 vCPU — ~5
     *  concurrent clean) and the bot's global MAX_CONCURRENT_CALLS=10 shared across
     *  ALL institutes: one campaign must not starve everyone else's calls. */
    public static final int MAX_PARALLEL = 3;

    public StartResult startForAudience(String instituteId, String audienceId, boolean dryRun,
                                        String campaignIdOverride, String preferredNumberId,
                                        List<String> responseIds, Integer parallelRequested) {
        AiCallingSettingsPojo settings = settingsService.get(instituteId);
        if (!settings.isEnabled()) {
            throw new VacademyException("AI calling is disabled for this institute.");
        }
        // Agent: an explicit chooser pick wins; else the institute default (resolved through the
        // settings resolver so a defaultCampaignId holding an agent NAME maps to the real id).
        String campaignId = !isBlank(campaignIdOverride) ? campaignIdOverride
                : settings.resolveCampaignId(settings.getProvider(), null);
        if (isBlank(campaignId)) {
            throw new VacademyException("No default Campaign ID set in AI Calling settings.");
        }

        // ACTIVE-only, hardcoded: a soft-deleted lead must never be dialled by a bulk campaign.
        List<AudienceResponse> leads = audienceResponseRepository.findActiveByAudienceId(audienceId);
        // Eligible = has a user id; the phone is resolved at call time (parent_mobile
        // first, then the user's profile number), so we don't pre-filter on phone.
        // Optional scope: only the leads the admin check-selected on the list page.
        // Filter SERVER-side against the audience's own rows — the client-sent ids are
        // never trusted to dial outside this audience/institute.
        Set<String> scope = (responseIds == null || responseIds.isEmpty())
                ? null : new HashSet<>(responseIds);
        List<LeadRef> refs = leads.stream()
                .filter(l -> !isBlank(l.getUserId()))
                .filter(l -> scope == null || scope.contains(l.getId()))
                .map(l -> new LeadRef(l.getId(), l.getUserId(), l.getParentMobile()))
                .toList();
        int parallel = Math.max(1, Math.min(MAX_PARALLEL,
                parallelRequested == null ? 1 : parallelRequested));

        if (refs.isEmpty()) {
            return new StartResult(leads.size(), 0, false, "No eligible leads (none have a user id).");
        }

        // Dry run: report the counts the confirm dialog needs, WITHOUT placing any calls.
        if (dryRun) {
            return new StartResult(leads.size(), refs.size(), false,
                    refs.size() + " eligible lead(s) will be called.");
        }

        // Idempotency: claim this audience for the cooldown window. The per-lead 30s
        // dedup can't catch a re-fire of the SAME list started minutes later (each lead
        // would be dialed a second time — double spend), so gate the whole run here. An
        // atomic conditional UPDATE, so two concurrent/re-fired starts can't both win.
        if (audienceRepository.tryClaimAiCampaign(audienceId, bulkCooldownSec) == 0) {
            throw new VacademyException(
                    "A bulk AI call for this list was started in the last few minutes — "
                    + "please wait before starting another.");
        }

        try {
            // The refs are plain records (snapshot) — safe to hand to another thread;
            // no managed JPA entities cross the boundary.
            dispatchExecutor.execute(() -> dispatch(instituteId, audienceId, campaignId,
                    preferredNumberId, refs, parallel));
        } catch (RejectedExecutionException rej) {
            throw new VacademyException("Too many AI bulk campaigns are running right now — try again shortly.");
        }

        log.info("ai-call bulk: audience={} total={} eligible={} dispatched async (pace={}ms)",
                audienceId, leads.size(), refs.size(), paceMs);
        return new StartResult(leads.size(), refs.size(), true,
                "Queued " + refs.size() + " AI calls; outcomes will arrive via the webhook.");
    }

    /** Grace before a never-terminal call stops occupying a parallel slot (webhook
     *  lost / provider never called back). Generous: max call is typically 6-10 min. */
    private static final long STUCK_CALL_MS = 12 * 60_000L;
    /** Small gap between dial-outs inside the window — avoids a Plivo CPS burst. */
    private static final long INTER_DIAL_GAP_MS = 3_000L;
    /** How often the runner re-checks in-flight calls for completion. */
    private static final long POLL_MS = 4_000L;

    /**
     * Background worker: COMPLETION-AWARE sliding window. Keeps at most
     * {@code parallel} calls in flight; when one reaches a terminal status (polled
     * off telephony_call_log — the webhooks land regardless of this thread) the next
     * lead dials. The previous fixed-pace loop (800ms between dials) effectively
     * dialed the whole list near-simultaneously and let the voice box's busy-cap
     * shed the overflow — callers got "busy" instead of a queued call.
     */
    private void dispatch(String instituteId, String audienceId, String campaignId,
                          String preferredNumberId, List<LeadRef> refs, int parallel) {
        Deque<LeadRef> queue = new ArrayDeque<>(refs);
        Map<String, Long> inFlight = new LinkedHashMap<>(); // callLogId -> dialedAtMs
        int placed = 0, failed = 0;
        try {
            while (!queue.isEmpty() || !inFlight.isEmpty()) {
                // Reap finished/stuck calls to free window slots.
                if (!inFlight.isEmpty()) {
                    List<String> ids = new ArrayList<>(inFlight.keySet());
                    for (var row : callLogRepo.findAllById(ids)) {
                        if (CallStatus.parseOrDefault(row.getStatus()).isTerminal()) {
                            inFlight.remove(row.getId());
                        }
                    }
                    long now = System.currentTimeMillis();
                    inFlight.entrySet().removeIf(e -> {
                        boolean stuck = now - e.getValue() > STUCK_CALL_MS;
                        if (stuck) log.warn("ai-call bulk: call {} never went terminal — freeing its slot", e.getKey());
                        return stuck;
                    });
                }
                // Fill the window.
                while (inFlight.size() < parallel && !queue.isEmpty()) {
                    LeadRef ref = queue.poll();
                    AiCallRequestDTO req = new AiCallRequestDTO();
                    req.setInstituteId(instituteId);
                    req.setUserId(ref.userId());
                    req.setPhoneNumber(ref.phone());   // may be blank → placeCall resolves from profile
                    req.setResponseId(ref.responseId());
                    req.setCampaignId(campaignId);
                    req.setPreferredNumberId(preferredNumberId);
                    try {
                        var resp = aiCallService.placeCall(req, null);
                        placed++;
                        if (resp != null && !isBlank(resp.getCallLogId())) {
                            inFlight.put(resp.getCallLogId(), System.currentTimeMillis());
                        }
                    } catch (Exception e) {
                        failed++;
                        log.warn("ai-call bulk: failed for lead {} in audience {}: {}",
                                ref.responseId(), audienceId, e.getMessage());
                    }
                    if (!queue.isEmpty() && inFlight.size() < parallel) {
                        Thread.sleep(INTER_DIAL_GAP_MS);
                    }
                }
                if (queue.isEmpty() && inFlight.isEmpty()) break;
                Thread.sleep(POLL_MS);
            }
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            log.warn("ai-call bulk: interrupted for audience {} after {} placed", audienceId, placed);
        }
        log.info("ai-call bulk DONE: audience={} eligible={} placed={} failed={} parallel={}",
                audienceId, refs.size(), placed, failed, parallel);
    }

    /**
     * Live rows for the campaign progress dialog: every AI call placed for THIS
     * audience's leads since the run began, with the latest disposition when the
     * report has landed. Institute-scoped in SQL — the audience join means a caller
     * can never read another institute's calls even with a guessed audience id.
     */
    @SuppressWarnings("unchecked")
    public List<java.util.Map<String, Object>> campaignCallStatuses(
            String instituteId, String audienceId, long sinceEpochMs) {
        var rows = entityManager.createNativeQuery(
                "SELECT t.id, t.response_id, t.status, t.duration_seconds, "
                + "       t.created_at, "
                + "       (SELECT r.disposition FROM ai_call_result r "
                + "         WHERE r.call_log_id = t.id AND r.disposition IS NOT NULL "
                + "         ORDER BY r.created_at DESC LIMIT 1) AS disposition "
                + "FROM telephony_call_log t "
                + "JOIN audience_response ar ON ar.id = t.response_id "
                + "WHERE ar.audience_id = :audienceId "
                + "  AND t.institute_id = :instituteId "
                + "  AND t.created_at >= :since "
                + "ORDER BY t.created_at")
                .setParameter("audienceId", audienceId)
                .setParameter("instituteId", instituteId)
                .setParameter("since", new java.sql.Timestamp(sinceEpochMs))
                .getResultList();
        List<java.util.Map<String, Object>> out = new ArrayList<>();
        for (Object rowObj : (List<Object[]>) rows) {
            Object[] r = (Object[]) rowObj;
            java.util.Map<String, Object> m = new LinkedHashMap<>();
            m.put("callLogId", r[0]);
            m.put("responseId", r[1]);
            m.put("status", r[2]);
            m.put("durationSeconds", r[3]);
            m.put("createdAt", r[4] == null ? null : r[4].toString());
            m.put("disposition", r[5]);
            out.add(m);
        }
        return out;
    }

    private record LeadRef(String responseId, String userId, String phone) {}

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
