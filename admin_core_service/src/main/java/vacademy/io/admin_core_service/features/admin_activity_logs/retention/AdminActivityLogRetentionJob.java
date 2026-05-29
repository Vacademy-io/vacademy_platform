package vacademy.io.admin_core_service.features.admin_activity_logs.retention;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.admin_activity_logs.config.AuditProperties;
import vacademy.io.admin_core_service.features.admin_activity_logs.repository.AdminActivityLogRepository;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * Nightly retention sweep. Runs at 03:00 UTC and chunk-deletes rows older
 * than {@code audit.retention.days}. The chunked DELETE pattern (see the
 * repository) keeps row-locks short — no table-level locking, no live
 * traffic impact.
 */
@Component
public class AdminActivityLogRetentionJob {

    private static final Logger logger = LoggerFactory.getLogger(AdminActivityLogRetentionJob.class);

    @Autowired
    private AdminActivityLogRepository repository;

    @Autowired
    private AuditProperties properties;

    @Scheduled(cron = "0 0 3 * * *", zone = "UTC")
    public void run() {
        runOnce();
    }

    /** Exposed so it can be triggered manually in tests / via an actuator if needed. */
    @Transactional
    public long runOnce() {
        int retentionDays = properties.getRetention().getDays();
        int batchSize = properties.getRetention().getBatchSize();
        Timestamp cutoff = Timestamp.from(
                Instant.now().minus(retentionDays, ChronoUnit.DAYS));

        long total = 0;
        int deleted;
        long startMillis = System.currentTimeMillis();
        do {
            deleted = repository.deleteOlderThan(cutoff, batchSize);
            total += deleted;
            // Guard against runaway loops if the table is enormous on first run.
            if (System.currentTimeMillis() - startMillis > 30 * 60 * 1000L) {
                logger.warn("Audit retention exceeded 30m wall time; deferring rest to next run (deleted={})",
                        total);
                break;
            }
        } while (deleted > 0);

        logger.info("Audit retention sweep finished: deleted={} rows older than {}", total, cutoff);
        return total;
    }
}
