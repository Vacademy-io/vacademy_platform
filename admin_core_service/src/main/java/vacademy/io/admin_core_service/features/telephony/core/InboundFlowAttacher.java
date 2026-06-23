package vacademy.io.admin_core_service.features.telephony.core;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyProviderNumber;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyProviderNumberRepository;
import vacademy.io.admin_core_service.features.telephony.spi.InboundFlowBinder;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;

/**
 * Provider-neutral entry point for "attach this ExoPhone to the institute's
 * inbound flow so callbacks ring through". Idempotent and safe to call
 * repeatedly; failures are persisted on the number row so the UI can show
 * status + offer a retry without re-asking for credentials.
 *
 * Today only Exotel is supported. A new provider plugs in by adding its own
 * attach method to its HTTP client and a branch here keyed on
 * {@link TelephonyProviderNumber#getProviderType()}.
 */
@Service
public class InboundFlowAttacher {

    private static final Logger log = LoggerFactory.getLogger(InboundFlowAttacher.class);

    /** Attachment status values, kept as constants so the UI's pill rendering
     *  doesn't drift from what the persister writes. */
    public static final class Status {
        public static final String ATTACHED = "ATTACHED";
        public static final String PENDING  = "PENDING";
        public static final String FAILED   = "FAILED";
        public static final String DETACHED = "DETACHED";
        private Status() {}
    }

    @Autowired private TelephonyConfigCache configCache;
    @Autowired private TelephonyProviderNumberRepository numberRepo;
    @Autowired private TelephonyProviderRegistry registry;
    @Autowired private AttachTxOps tx;

    /**
     * Attach a single number to the institute's configured flow. Marks the
     * row PENDING (no flow yet) / ATTACHED / FAILED accordingly via the
     * status-pill columns; callers re-read the row to see the outcome.
     *
     * Callers MUST tolerate this throwing — number CRUD already committed
     * before this is invoked, so the row exists either way.
     */
    public void attach(TelephonyProviderNumber row) {
        if (row == null) return;

        Optional<TelephonyConfigCache.Resolved> resolved =
                configCache.get(row.getInstituteId());
        if (resolved.isEmpty()) {
            tx.markPending(row.getId(), "Provider config not set up yet");
            return;
        }
        String flowSid = resolved.get().getConfig() == null ? null
                : resolved.get().getConfig().getFlowSid();
        if (flowSid == null || flowSid.isBlank()) {
            tx.markPending(row.getId(), "Flow id not configured");
            return;
        }
        if (row.getProviderResourceId() == null || row.getProviderResourceId().isBlank()) {
            tx.markPending(row.getId(),
                    "Exotel ExoPhone Sid missing — use Sync from Exotel");
            return;
        }

        String providerType = row.getProviderType();
        InboundFlowBinder binder = registry.flowBinder(providerType).orElse(null);
        if (binder == null) {
            // No binder registered = this provider routes inbound natively (no
            // per-number flow attach). Not an error — surface it as PENDING so
            // the UI is honest about there being nothing to attach.
            tx.markPending(row.getId(),
                    "Auto-attach not supported for " + providerType);
            return;
        }

        try {
            binder.attach(row.getProviderResourceId(), flowSid, resolved.get().getCredentials());
            tx.markAttached(row.getId());
            log.info("inbound flow attached: institute={} phone={} flow={}",
                    row.getInstituteId(), row.getPhoneNumber(), flowSid);
        } catch (Exception e) {
            String msg = friendly(e);
            tx.markFailed(row.getId(), msg);
            log.warn("inbound flow attach failed: institute={} phone={} flow={} err={}",
                    row.getInstituteId(), row.getPhoneNumber(), flowSid, msg);
        }
    }

    /** Retry attach for a number whose last attempt was PENDING or FAILED. */
    public void retry(String numberId) {
        numberRepo.findById(numberId).ifPresent(this::attach);
    }

    /** Best-effort detach used on number disable / delete. Failures are
     *  swallowed — losing the attachment to a deleted number is harmless
     *  (the flow still exists; Exotel will just route to a stale URL until
     *  the admin reassigns). */
    public void detachQuietly(TelephonyProviderNumber row) {
        if (row == null) return;
        try {
            // Exotel doesn't have an explicit "detach"; the documented way to
            // remove a flow association is to PUT an empty app_id. Skipped
            // entirely for now to avoid clobbering an admin-side reassignment
            // we don't know about — the row will be deleted from our side
            // and any future inbound on the number falls through harmlessly.
            tx.markDetached(row.getId());
        } catch (Exception e) {
            log.warn("inbound flow detach status update failed for {}", row.getId(), e);
        }
    }

    private static String friendly(Exception e) {
        // RestClientResponseException carries the server-side body in its
        // message, which is the most useful thing to surface in the UI.
        String m = e.getMessage();
        if (m == null) return "Attach failed — see server logs";
        // Truncate aggressive Spring wrappers (the full body can be huge).
        return m.length() > 800 ? m.substring(0, 800) + "…" : m;
    }

    /**
     * Per-row status writes live on a separate bean so Spring's AOP proxy
     * applies (self-invocation would skip the @Transactional). Same pattern
     * as CallLifecycleTxOps / InboundRoutingService.InboundCallLogPersister.
     */
    @Service
    public static class AttachTxOps {

        @Autowired private TelephonyProviderNumberRepository numberRepo;

        @Transactional(propagation = Propagation.REQUIRES_NEW)
        public void markAttached(String numberId) {
            numberRepo.findById(numberId).ifPresent(n -> {
                n.setFlowAttachStatus(Status.ATTACHED);
                n.setFlowAttachError(null);
                n.setFlowAttachedAt(Timestamp.from(Instant.now()));
                numberRepo.save(n);
            });
        }

        @Transactional(propagation = Propagation.REQUIRES_NEW)
        public void markPending(String numberId, String reason) {
            numberRepo.findById(numberId).ifPresent(n -> {
                n.setFlowAttachStatus(Status.PENDING);
                n.setFlowAttachError(reason);
                numberRepo.save(n);
            });
        }

        @Transactional(propagation = Propagation.REQUIRES_NEW)
        public void markFailed(String numberId, String message) {
            numberRepo.findById(numberId).ifPresent(n -> {
                n.setFlowAttachStatus(Status.FAILED);
                n.setFlowAttachError(message);
                numberRepo.save(n);
            });
        }

        @Transactional(propagation = Propagation.REQUIRES_NEW)
        public void markDetached(String numberId) {
            numberRepo.findById(numberId).ifPresent(n -> {
                n.setFlowAttachStatus(Status.DETACHED);
                n.setFlowAttachError(null);
                numberRepo.save(n);
            });
        }
    }
}
