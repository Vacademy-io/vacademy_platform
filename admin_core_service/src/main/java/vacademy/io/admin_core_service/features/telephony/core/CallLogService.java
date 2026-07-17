package vacademy.io.admin_core_service.features.telephony.core;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import vacademy.io.admin_core_service.features.telephony.enums.CallStatus;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyCallLog;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyCallLogRepository;
import vacademy.io.admin_core_service.features.telephony.spi.dto.NormalizedCallEvent;

/**
 * Single-responsibility persistence for call-log row updates. Idempotent —
 * webhook retries don't double-write, and out-of-order callbacks (Exotel
 * sometimes redelivers earlier events) don't move the status backwards.
 *
 * Transition rule:
 *   - Only apply the incoming status if its {@link CallStatus#rank()} is
 *     >= the row's current rank. This prevents a delayed RINGING from
 *     overwriting a live IN_PROGRESS, and a stray QUEUED redelivery from
 *     clobbering a terminal state.
 *   - Terminal states all share rank 100, so the FIRST terminal received
 *     wins. Subsequent terminals (provider retries on the same call) don't
 *     change the row.
 */
@Service
public class CallLogService {

    private static final Logger log = LoggerFactory.getLogger(CallLogService.class);

    @Autowired
    private TelephonyCallLogRepository repo;

    @Autowired
    private CallBillingService billingService;

    @Transactional
    public TelephonyCallLog applyEvent(TelephonyCallLog row, NormalizedCallEvent ev) {
        return applyEvent(row, ev, true);
    }

    /**
     * @param voiceBillable false suppresses the voice-minutes meter for this apply —
     *        used by the AI-report promotion path when it MINTED the row itself: a
     *        promotion-created row is a bookkeeping artifact of the report (no telephony
     *        webhook will ever reference it), and metering it would voice-bill the same
     *        physical call twice (the real inbound row already bills off the Plivo
     *        hangup) or bill a row fabricated from a forged-but-authenticated report.
     */
    @Transactional
    public TelephonyCallLog applyEvent(TelephonyCallLog row, NormalizedCallEvent ev,
                                       boolean voiceBillable) {
        if (ev.getProviderCallId() != null && row.getProviderCallId() == null) {
            row.setProviderCallId(ev.getProviderCallId());
        }

        if (ev.getStatus() != null) {
            CallStatus current = CallStatus.parseOrDefault(row.getStatus());
            CallStatus incoming = ev.getStatus();
            // Apply only forward transitions. == lets us still update other
            // fields (duration, recordingUrl) without bumping status — EXCEPT
            // once terminal: all terminals share rank 100, so the first one
            // received wins (the documented invariant). Matters for VACADEMY_AI,
            // where the hangup callback, the recordSession callback (mapped
            // COMPLETED whenever a RecordUrl is present) and the bot report race;
            // without stickiness a late COMPLETED overwrote a real NO_ANSWER.
            boolean apply = current.isTerminal()
                    ? incoming.rank() > current.rank()
                    : incoming.rank() >= current.rank();
            if (apply) {
                row.setStatus(incoming.name());
            } else {
                log.debug("ignoring non-forward status {} → {} for call {}",
                        current, incoming, row.getId());
            }
        }

        if (ev.getStartTime() != null && row.getStartTime() == null)
            row.setStartTime(ev.getStartTime());
        if (ev.getAnswerTime() != null && row.getAnswerTime() == null)
            row.setAnswerTime(ev.getAnswerTime());
        if (ev.getEndTime() != null && row.getEndTime() == null)
            row.setEndTime(ev.getEndTime());
        if (ev.getDurationSeconds() != null && row.getDurationSeconds() == null)
            row.setDurationSeconds(ev.getDurationSeconds());
        if (ev.getTerminationReason() != null && row.getTerminationReason() == null)
            row.setTerminationReason(ev.getTerminationReason());
        if (ev.getPrice() != null && row.getPrice() == null)
            row.setPrice(new java.math.BigDecimal(ev.getPrice()));
        if (ev.getRecordingUrl() != null && row.getRecordingUrl() == null)
            row.setRecordingUrl(ev.getRecordingUrl());
        if (ev.getRawPayload() != null) row.setRawPayloadJson(ev.getRawPayload());

        TelephonyCallLog saved = repo.save(row);
        if (voiceBillable) maybeBillVoiceLeg(saved, ev);
        return saved;
    }

    /**
     * Voice-minutes metering (CallBillingService). applyEvent is the single funnel every
     * status webhook flows through, so this is the one place a call's end is observable.
     * Constraints baked in (see the explore notes on this seam):
     * <ul>
     *   <li>Terminal can arrive BEFORE duration (Plivo's record callback maps to COMPLETED
     *       with no duration; the hangup fills duration later while status is already
     *       sticky-terminal) — so gate on the ROW being complete (COMPLETED + duration),
     *       not on "this event was terminal".</li>
     *   <li>NO_ANSWER/BUSY rows can still carry a-leg duration (counsellor ring time) —
     *       bill only status COMPLETED.</li>
     *   <li>Webhook retries re-enter applyEvent — the attempt is bounded to events that
     *       actually carried a terminal status or a duration, and the charge itself is
     *       idempotent (voice_call:{id}) so repeats are no-ops.</li>
     *   <li>Dispatch AFTER COMMIT so the async biller never races an uncommitted row and
     *       never fires for a rolled-back transition.</li>
     * </ul>
     */
    private void maybeBillVoiceLeg(TelephonyCallLog saved, NormalizedCallEvent ev) {
        boolean eventContributed = (ev.getStatus() != null && ev.getStatus().isTerminal())
                || ev.getDurationSeconds() != null;
        if (!eventContributed) return;
        if (saved.getCreditsBilledAt() != null) return; // already charged (stamped on success)
        if (!billingService.isVoiceBillableProvider(saved.getProviderType())) return;
        if (!CallStatus.COMPLETED.name().equals(saved.getStatus())) return;
        Integer duration = saved.getDurationSeconds();
        if (duration == null || duration <= 0) return;

        final String id = saved.getId();
        final String inst = saved.getInstituteId();
        final String provider = saved.getProviderType();
        final String direction = saved.getDirection();
        final int secs = duration;
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    billingService.billVoiceLeg(id, inst, provider, direction, secs);
                }
            });
        } else {
            billingService.billVoiceLeg(id, inst, provider, direction, secs);
        }
    }
}
