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

    // Field-injected (not via @RequiredArgsConstructor) because there are multiple
    // Executor beans and this project's lombok.config doesn't copy @Qualifier onto
    // the generated constructor — by-type injection would be ambiguous.
    @Autowired
    @Qualifier("aiCallDispatchExecutor")
    private Executor dispatchExecutor;

    /** Gap between consecutive calls in a bulk run, to stay under Aavtaar's rate limit. */
    @Value("${aavtaar.bulk.pace-ms:800}")
    private long paceMs;

    /** A bulk run for the same audience is refused within this window (idempotency —
     *  prevents a re-fire of the same list from double-dialing every lead). */
    @Value("${aavtaar.bulk.cooldown-sec:300}")
    private long bulkCooldownSec;

    public record StartResult(int total, int eligible, boolean dispatched, String message) {}

    public StartResult startForAudience(String instituteId, String audienceId, boolean dryRun,
                                        String campaignIdOverride, String preferredNumberId) {
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
        List<LeadRef> refs = leads.stream()
                .filter(l -> !isBlank(l.getUserId()))
                .map(l -> new LeadRef(l.getId(), l.getUserId(), l.getParentMobile()))
                .toList();

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
            dispatchExecutor.execute(() -> dispatch(instituteId, audienceId, campaignId, preferredNumberId, refs));
        } catch (RejectedExecutionException rej) {
            throw new VacademyException("Too many AI bulk campaigns are running right now — try again shortly.");
        }

        log.info("ai-call bulk: audience={} total={} eligible={} dispatched async (pace={}ms)",
                audienceId, leads.size(), refs.size(), paceMs);
        return new StartResult(leads.size(), refs.size(), true,
                "Queued " + refs.size() + " AI calls; outcomes will arrive via the webhook.");
    }

    /** Background worker: places one paced AI call per eligible lead. */
    private void dispatch(String instituteId, String audienceId, String campaignId,
                          String preferredNumberId, List<LeadRef> refs) {
        int placed = 0, failed = 0;
        for (LeadRef ref : refs) {
            AiCallRequestDTO req = new AiCallRequestDTO();
            req.setInstituteId(instituteId);
            req.setUserId(ref.userId());
            req.setPhoneNumber(ref.phone());   // may be blank → placeCall resolves from profile
            req.setResponseId(ref.responseId());
            req.setCampaignId(campaignId);
            req.setPreferredNumberId(preferredNumberId);
            try {
                aiCallService.placeCall(req, null);
                placed++;
            } catch (Exception e) {
                failed++;
                log.warn("ai-call bulk: failed for lead {} in audience {}: {}",
                        ref.responseId(), audienceId, e.getMessage());
            }
            if (paceMs > 0) {
                try {
                    Thread.sleep(paceMs);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    log.warn("ai-call bulk: interrupted for audience {} after {} placed", audienceId, placed);
                    break;
                }
            }
        }
        log.info("ai-call bulk DONE: audience={} eligible={} placed={} failed={}",
                audienceId, refs.size(), placed, failed);
    }

    private record LeadRef(String responseId, String userId, String phone) {}

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
