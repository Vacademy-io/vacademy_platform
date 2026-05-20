package vacademy.io.admin_core_service.features.admin_activity_logs.async;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.admin_activity_logs.entity.AdminActivityLog;
import vacademy.io.admin_core_service.features.admin_activity_logs.repository.AdminActivityLogRepository;

/**
 * Off-thread persister used only when {@code @Auditable(async = true)}.
 * Runs on the dedicated {@code auditAsyncExecutor} pool and writes the row
 * in its own short transaction — independent of the business commit.
 */
@Component
public class AsyncAuditDispatcher {

    private static final Logger logger = LoggerFactory.getLogger(AsyncAuditDispatcher.class);

    @Autowired
    private AdminActivityLogRepository repository;

    @Async("auditAsyncExecutor")
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void dispatch(AdminActivityLog log) {
        try {
            repository.save(log);
        } catch (Exception e) {
            logger.error("Async audit write failed for entity_type={} entity_id={}",
                    log.getEntityType(), log.getEntityId(), e);
        }
    }
}
