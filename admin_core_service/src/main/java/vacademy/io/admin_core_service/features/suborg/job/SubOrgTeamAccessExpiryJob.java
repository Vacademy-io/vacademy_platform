package vacademy.io.admin_core_service.features.suborg.job;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.faculty.repository.FacultySubjectPackageSessionMappingRepository;

import java.sql.Timestamp;
import java.time.Instant;

/**
 * Nightly sweep that enforces SOFT sub-org removals. A member removed with mode=SOFT
 * stays ACTIVE with an {@code access_till_date} in the future; once that date passes,
 * this job flips them to INACTIVE — the same end state a HARD removal reaches
 * immediately.
 *
 * <p>ShedLock guards against the multi-replica prod topology running the sweep more
 * than once per window.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SubOrgTeamAccessExpiryJob {

    private final FacultySubjectPackageSessionMappingRepository facultyMappingRepository;

    /** Runs at 02:30 UTC daily. */
    @Scheduled(cron = "0 30 2 * * *", zone = "UTC")
    @SchedulerLock(name = "SubOrgTeamAccessExpiryJob", lockAtMostFor = "PT15M", lockAtLeastFor = "PT1M")
    public void run() {
        runOnce();
    }

    /** Exposed so it can be triggered manually (tests / actuator). */
    @Transactional
    public int runOnce() {
        int expired = facultyMappingRepository
                .deactivateExpiredSoftRemovals(Timestamp.from(Instant.now()));
        if (expired > 0) {
            log.info("Sub-org team access expiry sweep deactivated {} soft-removed member mapping(s)", expired);
        }
        return expired;
    }
}
