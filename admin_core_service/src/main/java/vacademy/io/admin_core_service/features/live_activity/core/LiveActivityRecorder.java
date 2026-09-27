package vacademy.io.admin_core_service.features.live_activity.core;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import vacademy.io.admin_core_service.features.live_activity.config.LiveActivityProperties;
import vacademy.io.admin_core_service.features.live_activity.dto.LiveActivityEvent;

import java.util.concurrent.Executor;

/**
 * The single entry point producers use to write a live activity event.
 *
 * <p><b>It never breaks a business call.</b> Every failure is caught and logged. This is the
 * same hard rule the audit aspect follows: a feed problem must not fail a customer payment,
 * an enrolment or a call. The actual write lives in {@link LiveActivityTxOps} so its
 * REQUIRES_NEW is honoured by the Spring proxy rather than silently skipped, which also
 * means a feed failure can never mark the caller transaction rollback-only.
 *
 * <p>Unlike the Auditable aspect this needs no request context, so webhook threads and
 * scheduled jobs can record freely.
 */
@Service
public class LiveActivityRecorder {

    private static final Logger log = LoggerFactory.getLogger(LiveActivityRecorder.class);

    private final LiveActivityTxOps txOps;
    private final LiveActivityProperties properties;
    private final LiveActivityBus bus;
    private final LiveActivityListener listener;
    private final Executor executor;

    /**
     * The listener is injected lazily only so a future change making it reach back into the
     * recorder cannot become a startup-time context failure. Today the graph is acyclic:
     * recorder depends on listener and bus, listener depends on bus.
     */
    @Autowired
    public LiveActivityRecorder(LiveActivityTxOps txOps,
                                LiveActivityProperties properties,
                                LiveActivityBus bus,
                                @Lazy LiveActivityListener listener,
                                @Qualifier("taskExecutor") Executor executor) {
        this.txOps = txOps;
        this.properties = properties;
        this.bus = bus;
        this.listener = listener;
        this.executor = executor;
    }

    /**
     * Record and fan out immediately.
     *
     * <p>Callers already inside a business transaction should prefer
     * {@link #recordAfterCommit(LiveActivityEvent)} so the feed never shows something that
     * subsequently rolled back.
     */
    public void record(LiveActivityEvent event) {
        if (!properties.isEnabled() || event == null) {
            return;
        }
        // Off the caller's thread, deliberately.
        //
        // The write runs in REQUIRES_NEW, and callers reach this from an afterCommit
        // callback -- a point where Spring has committed the business transaction but has
        // NOT yet released its connection. Writing inline there means one thread holding
        // two pooled connections at once, against a pool of 8 in production. Under a burst
        // (a call storm, a payment reconciliation, eWay polling on every replica) that
        // starves the pool for unrelated requests. Handing the work to the shared executor
        // lets the caller return and release its connection first.
        //
        // This also removes the 2-5ms the insert and notify were adding to every payment,
        // enrolment, call transition and lead submission.
        //
        // taskExecutor is bounded (8/16, queue 2000) with CallerRunsPolicy, so a genuine
        // flood degrades to running inline -- slower, but never unbounded thread growth.
        // Qualified by name on purpose: several Executor beans exist here, so an
        // unqualified @Async or injection silently falls through to an UNBOUNDED
        // SimpleAsyncTaskExecutor (see DefaultAsyncConfig).
        executor.execute(() -> persist(event));
    }

    private void persist(LiveActivityEvent event) {
        try {
            LiveActivityEvent stamped = txOps.insertAndNotify(event);
            if (stamped == null) {
                // A duplicate. Another replica, a webhook retry, or a provider sibling event
                // already recorded this moment and already notified for it.
                return;
            }
            // With the listener running, the notification reaches every replica including
            // this one, so publishing here as well would double-deliver to whichever replica
            // happened to serve the request. Only fan out locally when nothing else will.
            if (!listener.isActive()) {
                bus.publishLocal(stamped);
            }
        } catch (Exception e) {
            // Deliberately swallowed. Losing a feed row is always preferable to failing the
            // payment, enrolment or call that produced it.
            log.warn("live activity record failed for dedupeKey={}: {}",
                    event.getDedupeKey(), e.getMessage());
        }
    }

    /**
     * Defer until the caller transaction commits. Falls back to recording immediately when
     * no transaction is active, so webhook and job callers can use this freely.
     */
    public void recordAfterCommit(LiveActivityEvent event) {
        if (!properties.isEnabled() || event == null) {
            return;
        }
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            record(event);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                record(event);
            }
        });
    }
}
