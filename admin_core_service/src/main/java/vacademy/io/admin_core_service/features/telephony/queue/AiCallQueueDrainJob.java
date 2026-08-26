package vacademy.io.admin_core_service.features.telephony.queue;

import lombok.RequiredArgsConstructor;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.core.AiCallService;
import vacademy.io.admin_core_service.features.telephony.core.AiCallingSettingsService;
import vacademy.io.admin_core_service.features.telephony.core.CallingWindowUtil;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallRequestDTO;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallResponseDTO;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallingSettingsPojo;
import vacademy.io.admin_core_service.features.telephony.enums.CallStatus;
import vacademy.io.admin_core_service.features.telephony.enums.CallTrigger;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.queue.entity.AiCallQueueItem;
import vacademy.io.admin_core_service.features.telephony.queue.repository.AiCallLaneRepository;
import vacademy.io.admin_core_service.features.telephony.queue.repository.AiCallQueueItemRepository;
import vacademy.io.common.exceptions.ConflictException;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * The only thing in the platform that places an AI call.
 *
 * <p>Every producer — the CALL_AI workflow node, a bulk campaign, a counsellor's click
 * — writes a row to {@code ai_call_queue}. This job is what turns those rows into
 * dials, and because it is the single dialler the fleet-wide concurrency limit is
 * exact: there is no distributed counting to get wrong, no per-replica share to
 * rebalance when the deployment scales.
 *
 * <h3>Why one drainer is safe with 2-4 replicas</h3>
 * {@code @SchedulerLock} means only one pod runs a tick. That lock can still lapse
 * ({@code lockAtMostFor}) and let two ticks overlap, so send-once does NOT rest on it:
 * every dispatch first wins a conditional {@code QUEUED -> DISPATCHING} update, and
 * only the winner dials.
 *
 * <h3>Order</h3>
 * Strict FIFO on {@code (priority DESC, created_at)}. The scan SKIPS an item whose
 * institute is already at its lane cap, which is what stops one institute's 500-lead
 * upload from owning every slot — a latecomer with five leads takes the next free line
 * instead of waiting out the backlog. See {@code AiCallCapacityService} for the cap.
 *
 * <h3>Guards</h3>
 * The job calls {@code AiCallService.placeCall} unmodified, so every pre-dial guard
 * (credits, daily cap, already-assigned, deleted lead, duplicate window) is
 * re-evaluated against the world at DIAL time rather than at enqueue time. That
 * matters: an item can wait hours, during which the lead may be assigned to a human or
 * the institute may run out of credits.
 */
@Component
@RequiredArgsConstructor
public class AiCallQueueDrainJob {

    private static final Logger log = LoggerFactory.getLogger(AiCallQueueDrainJob.class);

    /**
     * Substrings of the two {@code ConflictException} messages {@code placeCall}
     * throws, which need opposite handling: an out-of-credits institute should keep its
     * queue and retry later, a deleted lead must never be dialled again.
     *
     * <p>Matching on message text is a coupling, so the DEFAULT is the safe one — an
     * unrecognised conflict re-queues with backoff rather than destroying the call.
     * Only an explicit "deleted" match cancels.
     */
    private static final String CONFLICT_LEAD_DELETED = "deleted";

    /** Statuses {@code placeCall} returns with {@code dispatched=false}. */
    private static final String SKIPPED_ASSIGNED = "SKIPPED_ASSIGNED";
    private static final String SKIPPED_DAILY_CAP = "SKIPPED_DAILY_CAP";
    private static final String SKIPPED_DUPLICATE = "SKIPPED_DUPLICATE";

    /** Give up on an item after this many dial attempts. */
    private static final int MAX_ATTEMPTS = 3;

    /** A claim older than this belongs to a drainer that died mid-tick. */
    private static final Duration CLAIM_GRACE = Duration.ofMinutes(5);

    /** Backoff after a transient failure, indexed by attempt number. */
    private static final Duration[] RETRY_BACKOFF = {
            Duration.ofMinutes(1), Duration.ofMinutes(5), Duration.ofMinutes(15)
    };

    /** How long an institute that just hit its daily cap is left alone. */
    private static final Duration DAILY_CAP_BACKOFF = Duration.ofHours(1);

    /** How long an institute with no credits is left alone. */
    private static final Duration NO_CREDITS_BACKOFF = Duration.ofMinutes(15);

    private final AiCallQueueItemRepository repository;
    private final AiCallLaneRepository laneRepository;
    private final AiCallCapacityService capacityService;
    private final AiCallQueueService queueService;
    private final AiCallingSettingsService settingsService;

    /**
     * {@code @Lazy} for the same reason {@code CallAiNodeHandler} needs it: the AI call
     * path reaches the workflow engine (a dial resumes paused runs through the outcome
     * processor), and a scheduled bean wired eagerly into that graph reintroduces the
     * startup cycle that {@code @Autowired @Lazy} exists to break here.
     */
    @Autowired
    @Lazy
    private AiCallService aiCallService;

    @Scheduled(fixedDelayString = "${telephony.ai.queue.drain-delay-ms:2000}")
    @SchedulerLock(name = "AiCallQueueDrain", lockAtMostFor = "PT5M", lockAtLeastFor = "PT1S")
    public void drain() {
        try {
            drainOnce();
        } catch (Exception e) {
            // A scheduled method that throws is silently dropped by Spring's scheduler
            // and, worse, keeps its schedule — so a recurring failure would look exactly
            // like an idle queue. Log it loudly instead.
            log.error("ai-call queue: drain tick failed", e);
        }
    }

    private void drainOnce() {
        Instant now = Instant.now();

        int expired = repository.expireOverdue(now);
        if (expired > 0) {
            log.info("ai-call queue: expired {} item(s) that waited past their time limit", expired);
        }
        int released = repository.releaseStuckClaims(now.minus(CLAIM_GRACE));
        if (released > 0) {
            log.warn("ai-call queue: released {} claim(s) left behind by an interrupted drain", released);
        }

        AiCallCapacityService.Snapshot snap = capacityService.snapshot();
        int reserved = capacityService.reservedInteractiveSlots();

        // Enough rows per lane that a lane could fill the whole fleet on its own, and no
        // more — the point of the per-lane fetch is coverage of every waiting institute,
        // not depth within one. Combined with the LATERAL this keeps the candidate set at
        // roughly (lanes x fleet capacity) rows however deep the queue gets, so a
        // two-second tick over a 5,000-item backlog still reads a handful of rows.
        int perLane = Math.max(1, Math.min(50, snap.capacityFor(ProviderType.VACADEMY_AI)));
        List<AiCallQueueItem> candidates =
                repository.findDrainCandidates(now, perLane, capacityService.drainBatch());
        if (candidates.isEmpty()) return;

        // Institutes taken out of play for the rest of this tick: paused, out of
        // credits, or at their daily cap. Without this, an institute with 400 queued
        // items would re-run the same failing guard 400 times per tick.
        Set<String> blockedInstitutes = new HashSet<>();
        Map<String, AiCallingSettingsPojo> settingsCache = new HashMap<>();

        int dialled = 0, skipped = 0;
        for (AiCallQueueItem item : candidates) {
            String instituteId = item.getInstituteId();
            String provider = item.getProvider();

            if (blockedInstitutes.contains(instituteId)) continue;
            if (snap.isPaused(instituteId)) {
                blockedInstitutes.add(instituteId);
                continue;
            }

            CallTrigger trigger = parseTrigger(item.getCallTrigger());

            // Fleet capacity for THIS provider. Reserved slots are held back from
            // automation only, so a human's click can still get a line when the fleet is
            // otherwise full. Defaults to 0 reserved, i.e. manual queues like everything
            // else, which is the configured behaviour.
            int providerCapacity = snap.capacityFor(provider);
            if (trigger != CallTrigger.MANUAL) providerCapacity = Math.max(0, providerCapacity - reserved);
            if (snap.inFlightFor(provider) >= providerCapacity) {
                skipped++;
                continue;
            }

            // The lane cap. THIS is the fairness mechanism: FIFO order is preserved, but
            // an institute already holding its share is stepped over so the next
            // institute in line gets the slot.
            int laneCapacity = snap.laneCapacityFor(instituteId, provider);
            if (snap.inFlightForLane(instituteId) >= laneCapacity) {
                skipped++;
                continue;
            }

            // Calling window, re-checked at dispatch — the settings may have changed, or
            // the shift may simply have closed while this item waited. MANUAL is exempt:
            // it never had a window before the queue existed and must not gain one.
            if (trigger != CallTrigger.MANUAL) {
                AiCallingSettingsPojo settings = settingsCache.computeIfAbsent(
                        instituteId, settingsService::get);
                ZoneId tz = CallingWindowUtil.resolveZone(settings.getTimezone());
                if (!CallingWindowUtil.withinAnyShift(now, settings.getCallingShifts(), tz)) {
                    Instant nextOpen = CallingWindowUtil.nextShiftOpen(
                            now, settings.getCallingShifts(), tz);
                    // Lane-wide: the whole institute is out of hours, not just this call.
                    repository.deferLane(instituteId,
                            nextOpen != null ? nextOpen : now.plus(Duration.ofMinutes(30)),
                            "Outside this institute's calling hours.");
                    blockedInstitutes.add(instituteId);
                    continue;
                }
            }

            // Send-once. Losing this race is normal under an overlapping tick.
            if (repository.claimForDispatch(item.getId()) == 0) continue;
            // The claim incremented attempts in the DATABASE; mirror it onto the detached
            // copy we are holding. Without this every later save() writes the pre-claim
            // value back and the counter never advances — an item that keeps failing
            // would retry for ever instead of giving up after MAX_ATTEMPTS.
            item.setAttempts(item.getAttempts() + 1);

            DispatchOutcome outcome = dispatch(item, trigger, false);
            if (outcome == DispatchOutcome.DIALLED) {
                snap.reserve(instituteId, provider);
                laneRepository.touchDispatched(instituteId, Instant.now());
                dialled++;
            } else {
                if (outcome == DispatchOutcome.INSTITUTE_BLOCKED) blockedInstitutes.add(instituteId);
                skipped++;
            }
        }

        if (dialled > 0 || !blockedInstitutes.isEmpty()) {
            log.info("ai-call queue: dialled {}, skipped {} of {} candidate(s); {} lane(s) with work, "
                            + "{} institute(s) held back this tick",
                    dialled, skipped, candidates.size(), snap.lanesWithWork(), blockedInstitutes.size());
        }
    }

    /**
     * Dial one queued call RIGHT NOW if a line is genuinely free, instead of waiting for
     * the next tick.
     *
     * <p>This exists for the manual click. Queuing it is correct — a counsellor takes
     * their turn like everyone else — but when the fleet is idle "their turn" is two
     * seconds away, and returning {@code QUEUED} for a call that rings immediately
     * afterwards makes working calling look broken. So: if this item is at the head of
     * its own lane and there is a free slot, it goes out on the request thread and the
     * caller gets the same answer they have always got.
     *
     * <p>It cannot jump the line. {@code countAheadInLane == 0} means nothing in this
     * institute's lane is waiting; the lane cap still applies, so a busy institute's
     * click queues normally. And the claim is the same CAS the drainer uses, so this and
     * a concurrent tick can never both dial the item.
     *
     * <p>Two drainers on two replicas can still both read a free slot in the same
     * instant and briefly put the fleet one call over capacity. That is bounded by how
     * fast humans click, and the alternative — locking the fleet on every click — costs
     * more than the occasional extra call.
     *
     * @return the dial result when a call actually went out, else empty (the item stays
     *         queued and the drainer will take it).
     */
    public Optional<AiCallResponseDTO> dispatchNowIfLineFree(String queueItemId) {
        AiCallQueueItem item = repository.findById(queueItemId).orElse(null);
        if (item == null || !AiCallQueueStatus.QUEUED.name().equals(item.getStatus())) {
            return Optional.empty();
        }
        Instant now = Instant.now();
        if (item.getNotBefore() != null && item.getNotBefore().isAfter(now)) {
            return Optional.empty();
        }

        AiCallCapacityService.Snapshot snap = capacityService.snapshot();
        String instituteId = item.getInstituteId();
        String provider = item.getProvider();
        if (snap.isPaused(instituteId)) return Optional.empty();
        if (snap.inFlightFor(provider) >= snap.capacityFor(provider)) return Optional.empty();
        if (snap.inFlightForLane(instituteId) >= snap.laneCapacityFor(instituteId, provider)) {
            return Optional.empty();
        }
        // Strict FIFO still holds: only the head of the lane may take the fast path.
        if (repository.countAheadInLane(instituteId, item.getPriority(), item.getCreatedAt()) > 0) {
            return Optional.empty();
        }

        if (repository.claimForDispatch(item.getId()) == 0) return Optional.empty();
        item.setAttempts(item.getAttempts() + 1);

        DispatchOutcome outcome = dispatch(item, parseTrigger(item.getCallTrigger()), true);
        if (outcome != DispatchOutcome.DIALLED) return Optional.empty();

        laneRepository.touchDispatched(instituteId, Instant.now());
        return Optional.of(AiCallResponseDTO.builder()
                .callLogId(item.getCallLogId())
                .status(CallStatus.QUEUED.name())
                .dispatched(true)
                .providerMessage("Calling now.")
                .queueItemId(item.getId())
                .queuePosition(0L)
                .queueEtaMinutes(0L)
                .build());
    }

    private enum DispatchOutcome {
        /** A call went out and is occupying a slot. */
        DIALLED,
        /** This item is done or re-queued; other items for the institute may still dial. */
        ITEM_HANDLED,
        /** The whole institute is out of play for this tick (credits, daily cap). */
        INSTITUTE_BLOCKED
    }

    /**
     * Place one queued call through the normal {@code AiCallService} path, and record
     * what came back. Nothing here re-implements a guard — the point of routing through
     * {@code placeCall} is that the queue inherits all of them, evaluated now.
     */
    private DispatchOutcome dispatch(AiCallQueueItem item, CallTrigger trigger,
                                     boolean surfaceConflicts) {
        AiCallRequestDTO req = toRequest(item);
        try {
            AiCallResponseDTO resp = aiCallService.placeCall(req, item.getActorUserId(), trigger);
            if (resp == null) {
                return failOrRetry(item, "The dialler returned no result.");
            }
            if (resp.isDispatched()) {
                item.setStatus(AiCallQueueStatus.DIALED.name());
                item.setCallLogId(resp.getCallLogId());
                item.setDispatchedAt(Instant.now());
                item.setStatusReason(null);
                repository.save(item);
                return DispatchOutcome.DIALLED;
            }

            String status = resp.getStatus() == null ? "" : resp.getStatus();
            switch (status) {
                case SKIPPED_ASSIGNED -> {
                    // The lead picked up a counsellor while this sat in the queue. The
                    // bot's job ends once a human owns the lead, so this is a clean
                    // cancel, not a failure.
                    finish(item, AiCallQueueStatus.CANCELLED,
                            "A counsellor took this lead over while the call was queued.");
                    return DispatchOutcome.ITEM_HANDLED;
                }
                case SKIPPED_DUPLICATE -> {
                    finish(item, AiCallQueueStatus.CANCELLED,
                            "This lead was called by another path moments ago.");
                    return DispatchOutcome.ITEM_HANDLED;
                }
                case SKIPPED_DAILY_CAP -> {
                    // Institute-wide, so hold the whole lane rather than burning through
                    // its remaining items one refused dial at a time.
                    String reason = "This institute has hit its daily AI-call limit.";
                    Instant until = Instant.now().plus(DAILY_CAP_BACKOFF);
                    deferItem(item, until, reason);
                    repository.deferLane(item.getInstituteId(), until, reason);
                    return DispatchOutcome.INSTITUTE_BLOCKED;
                }
                default -> {
                    // Includes a provider rejection (FAILED with a call-log row).
                    return failOrRetry(item, resp.getProviderMessage() == null
                            ? "The provider refused the call." : resp.getProviderMessage());
                }
            }
        } catch (ConflictException e) {
            String message = e.getMessage() == null ? "" : e.getMessage();
            DispatchOutcome outcome;
            if (message.toLowerCase().contains(CONFLICT_LEAD_DELETED)) {
                finish(item, AiCallQueueStatus.CANCELLED, "This lead was deleted.");
                outcome = DispatchOutcome.ITEM_HANDLED;
            } else {
                // Everything else — chiefly credit exhaustion — is a condition that
                // clears on its own AND applies to the whole institute. Hold the lane and
                // try again later rather than throwing away calls an admin can rescue
                // with a top-up.
                Instant until = Instant.now().plus(NO_CREDITS_BACKOFF);
                deferItem(item, until, message);
                repository.deferLane(item.getInstituteId(), until, truncate(message));
                outcome = DispatchOutcome.INSTITUTE_BLOCKED;
            }
            // A person is waiting on the other end of the interactive path, so "you are
            // out of credits" and "this lead was deleted" must reach them as the errors
            // they always were rather than becoming a silent deferral. The queue state
            // above is recorded either way.
            if (surfaceConflicts) throw e;
            return outcome;
        } catch (Exception e) {
            log.warn("ai-call queue: dial failed for item {} (lead {}): {}",
                    item.getId(), item.getUserId(), e.getMessage());
            return failOrRetry(item, e.getMessage());
        }
    }

    /**
     * Re-queue with backoff, or give up. {@code attempts} was already incremented by the
     * claim, so it counts dials tried rather than dials planned.
     */
    private DispatchOutcome failOrRetry(AiCallQueueItem item, String error) {
        item.setLastError(truncate(error));
        if (item.getAttempts() >= MAX_ATTEMPTS) {
            finish(item, AiCallQueueStatus.FAILED,
                    "Could not be placed after " + item.getAttempts() + " attempts.");
            return DispatchOutcome.ITEM_HANDLED;
        }
        Duration backoff = RETRY_BACKOFF[Math.min(RETRY_BACKOFF.length - 1,
                Math.max(0, item.getAttempts() - 1))];
        item.setStatus(AiCallQueueStatus.QUEUED.name());
        item.setNotBefore(Instant.now().plus(backoff));
        item.setStatusReason("Retrying after a failed attempt.");
        repository.save(item);
        return DispatchOutcome.ITEM_HANDLED;
    }

    /**
     * Put a CLAIMED item back in the queue, eligible again at {@code notBefore}.
     *
     * <p>The attempt the claim charged is handed back: being out of credits or behind a
     * daily cap is not a failed dial, and must not eat an item's retry budget — a lead
     * queued overnight would otherwise exhaust itself before dawn.
     *
     * <p>Callers pair this with {@code deferLane} when the condition is institute-wide,
     * so the rest of the backlog moves with it.
     */
    private void deferItem(AiCallQueueItem item, Instant notBefore, String reason) {
        if (item.getAttempts() > 0) item.setAttempts(item.getAttempts() - 1);
        item.setStatus(AiCallQueueStatus.QUEUED.name());
        item.setNotBefore(notBefore);
        item.setStatusReason(truncate(reason));
        repository.save(item);
    }

    private void finish(AiCallQueueItem item, AiCallQueueStatus status, String reason) {
        item.setStatus(status.name());
        item.setStatusReason(truncate(reason));
        repository.save(item);
    }

    private AiCallRequestDTO toRequest(AiCallQueueItem item) {
        AiCallRequestDTO req = new AiCallRequestDTO();
        req.setInstituteId(item.getInstituteId());
        req.setProvider(item.getProvider());
        req.setUserId(item.getUserId());
        req.setPhoneNumber(item.getPhoneNumber());
        req.setResponseId(item.getResponseId());
        req.setCampaignId(item.getCampaignId());
        req.setCampaignName(item.getCampaignName());
        req.setPreferredNumberId(item.getPreferredNumberId());
        req.setSubjectType(item.getSubjectType());
        req.setSubjectId(item.getSubjectId());
        req.setCustomerName(item.getCustomerName());
        req.setCustomerEmail(item.getCustomerEmail());
        req.setMetadata(queueService.readMetadata(item.getMetadata()));
        return req;
    }

    private static CallTrigger parseTrigger(String value) {
        if (value == null) return CallTrigger.AUTOMATION;
        try {
            return CallTrigger.valueOf(value);
        } catch (IllegalArgumentException e) {
            return CallTrigger.AUTOMATION;
        }
    }

    /** status_reason / last_error are bounded columns; a provider stack trace is not. */
    private static String truncate(String s) {
        if (s == null) return null;
        return s.length() <= 240 ? s : s.substring(0, 240);
    }
}
