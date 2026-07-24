package vacademy.io.admin_core_service.features.telephony.core;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * At-least-once safety net for call-credit metering. The live hooks
 * (CallLogService.maybeBillVoiceLeg / AiCallOutcomeProcessor) are fire-and-forget:
 * the webhook has already been ACKed 2xx, so if the ai_service deduct HTTP call is
 * lost (restart/timeout) NO provider retry will ever re-trigger it — and the AI leg's
 * PROCESSED short-circuit means even a provider re-POST skips the billing block.
 * This sweep re-attempts completed-but-unstamped rows; the per-call idempotency keys
 * make it double-charge-safe, and multiple pods sweeping concurrently just race to
 * the same idempotent no-op.
 *
 * <p>CUTOFF: never bill calls that predate the metering feature (V378) — the backlog
 * of historical completed calls must not produce a retroactive bill shock.
 */
@Component
public class CallBillingReconciliationJob {

    private static final Logger log = LoggerFactory.getLogger(CallBillingReconciliationJob.class);

    /** Feature go-live — rows created before this are never billed. */
    private static final String CUTOFF = "2026-07-16 00:00:00";
    private static final int BATCH = 100;

    @Autowired private CallBillingService billingService;
    @PersistenceContext private EntityManager entityManager;

    @Scheduled(initialDelayString = "PT2M", fixedDelayString = "PT10M")
    public void sweep() {
        try {
            sweepVoice();
        } catch (Exception e) {
            log.error("call-billing sweep (voice) failed: {}", e.getMessage());
        }
        try {
            sweepAi();
        } catch (Exception e) {
            log.error("call-billing sweep (ai) failed: {}", e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private void sweepVoice() {
        // updated_at grace: don't race the live hook on rows that just completed.
        List<Object[]> rows = entityManager.createNativeQuery(
                "SELECT id, institute_id, provider_type, direction, duration_seconds "
                + "FROM telephony_call_log "
                + "WHERE provider_type IN ('PLIVO','VACADEMY_AI') "
                + "AND status = 'COMPLETED' AND duration_seconds > 0 "
                + "AND credits_billed_at IS NULL "
                + "AND created_at >= :cutoff "
                + "AND updated_at < now() - interval '5 minutes' "
                + "ORDER BY created_at LIMIT " + BATCH)
                .setParameter("cutoff", java.sql.Timestamp.valueOf(CUTOFF))
                .getResultList();
        if (!rows.isEmpty()) log.info("call-billing sweep: {} unbilled voice rows", rows.size());
        for (Object[] r : rows) {
            billingService.billVoiceLeg((String) r[0], (String) r[1], (String) r[2],
                    (String) r[3], ((Number) r[4]).intValue());
        }
    }

    @SuppressWarnings("unchecked")
    private void sweepAi() {
        // Mirrors the live hook's gates: PROCESSED (i.e. passed the verification gate),
        // explicit completed status, and a STABLE identity — rows with neither a
        // provider call_uuid nor our pre-call correlation_id are excluded in SQL (no
        // safe dedup key exists; the hook already warned about them once).
        List<Object[]> rows = entityManager.createNativeQuery(
                "SELECT id, institute_id, provider, direction, duration_seconds, "
                + "call_uuid, correlation_id, call_log_id "
                + "FROM ai_call_result "
                + "WHERE provider IN ('VACADEMY_AI','AAVTAAR') "
                + "AND processing_status = 'PROCESSED' "
                + "AND lower(trim(coalesce(status,''))) IN ('completed','complete') "
                + "AND (duration_seconds IS NULL OR duration_seconds > 0) "
                + "AND credits_billed_at IS NULL "
                + "AND (call_uuid IS NOT NULL OR (correlation_id IS NOT NULL AND call_log_id IS NOT NULL)) "
                + "AND created_at >= :cutoff "
                + "AND updated_at < now() - interval '5 minutes' "
                + "ORDER BY created_at LIMIT " + BATCH)
                .setParameter("cutoff", java.sql.Timestamp.valueOf(CUTOFF))
                .getResultList();
        if (!rows.isEmpty()) log.info("call-billing sweep: {} unbilled ai rows", rows.size());
        for (Object[] r : rows) {
            String key = CallBillingService.aiIdempotencyKey(
                    (String) r[2], (String) r[5], (String) r[6], (String) r[7]);
            if (key == null) continue; // defensive — SQL already filters these out
            int secs = r[4] == null ? 60 : ((Number) r[4]).intValue();
            billingService.billAiLeg(key, (String) r[0], (String) r[1], (String) r[2],
                    (String) r[3], secs);
        }
    }
}
