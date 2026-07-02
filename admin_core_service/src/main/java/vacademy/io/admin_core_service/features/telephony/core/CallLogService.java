package vacademy.io.admin_core_service.features.telephony.core;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
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

    @Transactional
    public TelephonyCallLog applyEvent(TelephonyCallLog row, NormalizedCallEvent ev) {
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

        return repo.save(row);
    }
}
