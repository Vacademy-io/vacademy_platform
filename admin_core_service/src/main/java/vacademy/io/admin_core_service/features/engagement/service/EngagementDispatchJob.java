package vacademy.io.admin_core_service.features.engagement.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.credits.client.CreditClient;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementAction;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementEngine;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementActionRepository;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementEngineRepository;
import vacademy.io.common.exceptions.VacademyException;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Phase 2 — the autonomous dispatcher. The decision service creates a {@code kind=SEND} action when
 * an engine has graduated to autonomy; THIS job fires it when due. Decoupling decision from dispatch
 * is what lets the brain schedule a send for later (and lets us re-check the kill switch + credits
 * with FRESH state at send time, not stale decision-time state).
 *
 * Order per send (all guards fail SAFE — a doubtful send becomes a copilot task, never a wrong send):
 *   1. re-check engine liveness + kill switch + channel `auto` intent → demote to TASK if revoked
 *   2. affordability (real balance, fail-CLOSED) → demote to TASK if unaffordable/unreachable
 *   3. claimForDispatch CAS (send-once) → dispatchClaimed → SENT/FAILED
 *   4. on SENT: charge one credit (idempotency = action id) and stamp billed
 * A separate reconciliation pass re-charges any SENT send whose deduct HTTP call was lost.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class EngagementDispatchJob {

    private static final String ACTOR = "ENGAGEMENT_ENGINE";
    private static final String CREDIT_REQUEST_TYPE = "engagement_message";

    private final EngagementActionRepository actionRepository;
    private final EngagementEngineRepository engineRepository;
    private final EngagementDispatcher dispatcher;
    private final CreditClient creditClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${engagement.dispatch.batch:100}")
    private int batch;

    @Value("${engagement.credits.per-message:1.0}")
    private BigDecimal perMessageCredits;

    /** Circuit breaker: if an institute has this many UNBILLED-but-SENT messages recently, its charge
     *  path is failing — stop auto-sending for it (demote to copilot) until reconciliation clears them. */
    @Value("${engagement.credits.max-unbilled:25}")
    private int maxUnbilled;

    @Value("${engagement.credits.unbilled-window-hours:6}")
    private int unbilledWindowHours;

    @Scheduled(fixedDelayString = "${engagement.dispatch.delay-ms:120000}")
    @SchedulerLock(name = "EngagementAutoDispatch", lockAtMostFor = "PT15M", lockAtLeastFor = "PT10S")
    public void dispatch() {
        Instant now = Instant.now();
        List<EngagementAction> due = actionRepository.findDueAutoSends(now, batch);
        int sent = 0;
        for (EngagementAction action : due) {
            try {
                if (dispatchOne(action, now)) sent++;
            } catch (Exception e) {
                log.error("Auto-dispatch failed for action {}: {}", action.getId(), e.getMessage());
            }
        }
        int reconciled = reconcileBilling(now);
        if (sent > 0 || reconciled > 0) {
            log.info("Auto-dispatch: {} sent, {} unbilled sends reconciled", sent, reconciled);
        }
    }

    private boolean dispatchOne(EngagementAction action, Instant now) {
        String instituteId = action.getInstituteId();
        EngagementEngine engine = engineRepository.findById(action.getEngineId()).orElse(null);

        // 1. Autonomy still granted? A mid-flight kill / channel-auto-off / non-live engine demotes
        // this to a human copilot task (never a wrong autonomous send). A paused/archived engine is
        // left OPEN to be re-evaluated on resume or expired by the reaper.
        if (engine == null) {
            return false; // engine vanished; the expiry reaper cleans up the orphan SEND
        }
        if (!"ACTIVE".equals(engine.getStatus())) {
            return false; // paused/archived/dry-run — leave OPEN; reaper expires if it goes stale
        }
        if (Boolean.TRUE.equals(engine.getAutoSendKilled())
                || !channelAutoEnabled(engine, action.getChannel())) {
            actionRepository.demoteSendToTask(action.getId(),
                    "Autonomy off for this channel — sent to the inbox for review.", now);
            return false;
        }

        // 2a. Circuit breaker on CHARGE failure. The balance read (plain) and the deduct (internal-
        // token-gated) are different endpoints, so /deduct can fail persistently while /balance still
        // reads > 0 — the affordability gate below can't see that. A pile of recently-SENT-but-UNBILLED
        // messages IS that signal: stop auto-sending for this institute (demote to copilot) so a broken
        // charge path can't silently bleed unbounded unbilled sends. Reconciliation clears the backlog.
        long unbilled = actionRepository.countUnbilledSentForInstitute(
                instituteId, now.minus(Duration.ofHours(unbilledWindowHours)));
        if (unbilled >= maxUnbilled) {
            actionRepository.demoteSendToTask(action.getId(),
                    "Billing is failing for this institute — auto-send paused; sent to the inbox for review.", now);
            return false;
        }

        // 2b. Affordability — fail CLOSED (hasActiveCredits returns false when the balance can't be
        // read), so an unreachable credits service never lets an autonomous send slip through unpriced.
        boolean affordable;
        try {
            affordable = creditClient.hasActiveCredits(instituteId);
        } catch (Exception e) {
            affordable = false;
        }
        if (!affordable) {
            actionRepository.demoteSendToTask(action.getId(),
                    "Out of credits — sent to the inbox so you can top up or send manually.", now);
            return false;
        }

        // 3. Send-once claim, then dispatch.
        if (actionRepository.claimForDispatch(action.getId(), instituteId, now) != 1) {
            return false; // another replica grabbed it
        }
        EngagementAction claimed = actionRepository.findById(action.getId()).orElse(action);
        EngagementAction result;
        try {
            result = dispatcher.dispatchClaimed(claimed, null, ACTOR);
        } catch (VacademyException rejected) {
            // Pre-send rejection (no phone/email on file, AI_CALL is task-only, window closed): nothing
            // was sent and the dispatcher reset the row to OPEN. Left alone it would churn every tick for
            // the full 72h expiry — and since findDueAutoSends is global + ordered by scheduled_for, a
            // pile of stuck rejects would starve every institute's legitimate sends. Demote to a visible
            // copilot TASK so a human can fix the contact and send manually. This condition won't
            // self-resolve, so retrying is pointless.
            actionRepository.demoteSendToTask(action.getId(),
                    "Couldn't auto-send: " + rejected.getMessage(), now);
            return false;
        } catch (Exception e) {
            // Unknown outcome — the dispatcher already settled the row to FAILED (visible in the inbox's
            // Failed filter, reopenable), never re-selected by findDueAutoSends (status != OPEN).
            log.warn("Auto-send dispatch for action {} did not complete: {}", action.getId(), e.getMessage());
            return false;
        }

        // 4. Charge only an actually-SENT message (a FAILED send is never charged).
        if ("SENT".equals(result.getStatus())) {
            charge(instituteId, action, now);
            return true;
        }
        return false;
    }

    /** Charge one credit for a sent message; stamp billed on success. Idempotency key = action id. */
    private void charge(String instituteId, EngagementAction action, Instant now) {
        try {
            boolean ok = creditClient.deductPrecomputed(
                    instituteId, CREDIT_REQUEST_TYPE,
                    "Engagement Engine autonomous " + action.getChannel() + " send",
                    perMessageCredits, action.getId());
            if (ok) {
                actionRepository.markBilled(action.getId(), now);
            } else {
                log.warn("Credit charge NOT acked for sent action {} — reconciliation will retry", action.getId());
            }
        } catch (Exception e) {
            // The message already went out; leave credits_billed_at NULL so reconciliation re-charges.
            log.warn("Credit charge threw for sent action {} — reconciliation will retry: {}",
                    action.getId(), e.getMessage());
        }
    }

    /** Re-charge SENT autonomous sends whose deduct call was lost (idempotent via action id). */
    private int reconcileBilling(Instant now) {
        List<EngagementAction> unbilled =
                actionRepository.findUnbilledSent(now.minus(Duration.ofDays(2)), batch);
        int fixed = 0;
        for (EngagementAction a : unbilled) {
            try {
                if (creditClient.deductPrecomputed(a.getInstituteId(), CREDIT_REQUEST_TYPE,
                        "Engagement Engine autonomous " + a.getChannel() + " send (reconciled)",
                        perMessageCredits, a.getId())) {
                    actionRepository.markBilled(a.getId(), now);
                    fixed++;
                }
            } catch (Exception e) {
                log.warn("Billing reconciliation retry failed for action {}: {}", a.getId(), e.getMessage());
            }
        }
        return fixed;
    }

    private boolean channelAutoEnabled(EngagementEngine engine, String channel) {
        if (channel == null) return false;
        try {
            return objectMapper.readTree(engine.getChannels()).path(channel).path("auto").asBoolean(false);
        } catch (Exception e) {
            return false;
        }
    }
}
