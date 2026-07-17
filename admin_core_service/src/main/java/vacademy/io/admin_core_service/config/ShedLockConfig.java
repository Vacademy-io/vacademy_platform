package vacademy.io.admin_core_service.config;

import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.provider.jdbctemplate.JdbcTemplateLockProvider;
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;

/**
 * Distributed locking for @Scheduled jobs (ShedLock).
 *
 * With 4 admin-core replicas and no leader election, every @Scheduled method fires
 * on all 4 pods each tick — 4x redundant work, and for the Meta lead poller 4
 * concurrent ingests of the same lead. ShedLock lets a job annotated with
 * {@code @SchedulerLock} acquire a shared DB lock so only ONE pod runs it per
 * schedule; the others skip that tick.
 *
 * Only annotated methods are locked — the other @Scheduled jobs keep their current
 * behaviour until they're annotated too, so this is non-breaking to add.
 */
@Configuration
@EnableSchedulerLock(defaultLockAtMostFor = "PT10M")
public class ShedLockConfig {

    /**
     * Lock provider on the MASTER datasource (locks are writes — must not hit the
     * read replica). usingDbTime() makes ShedLock compare lock times against the
     * database clock, not each pod's wall clock, so replica clock skew can't let two
     * pods think the lock is free at once.
     */
    @Bean
    public LockProvider lockProvider(@Qualifier("masterDataSource") DataSource dataSource) {
        return new JdbcTemplateLockProvider(
                JdbcTemplateLockProvider.Configuration.builder()
                        .withJdbcTemplate(new JdbcTemplate(dataSource))
                        .usingDbTime()
                        .build());
    }
}
