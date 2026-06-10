package vacademy.io.admin_core_service.features.counsellor_rating.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Nightly job: at 02:00 IST recompute every counsellor rating for every
 * institute that has a strategy configured (or any leads at all — the
 * compute service handles "no strategy" via defaults).
 *
 * We don't rely on counsellor_rating_strategy rows existing for every
 * institute; we iterate institutes-with-any-lead-history. That makes the
 * job idempotent: institutes that haven't set a strategy still get the
 * default STRATEGY_BASED scores written, so leaderboards aren't empty.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CounsellorRatingScheduler {

    private final CounsellorRatingComputeService computeService;
    private final JdbcTemplate jdbc;

    // 02:00 IST = 20:30 UTC. Cron is parsed in server TZ; we explicitly target IST.
    @Scheduled(cron = "0 0 2 * * *", zone = "Asia/Kolkata")
    public void nightlyRecompute() {
        long started = System.currentTimeMillis();
        List<String> instituteIds = jdbc.queryForList(
                "SELECT DISTINCT institute_id FROM user_lead_profile WHERE assigned_counselor_id IS NOT NULL",
                String.class);
        int totalCounsellors = 0;
        for (String inst : instituteIds) {
            try {
                totalCounsellors += computeService.recomputeAll(inst);
            } catch (Exception e) {
                log.warn("Nightly rating recompute failed for institute={}: {}", inst, e.getMessage());
            }
        }
        log.info("Counsellor rating nightly run: institutes={}, counsellors_recomputed={}, elapsed_ms={}",
                instituteIds.size(), totalCounsellors, System.currentTimeMillis() - started);
    }
}
