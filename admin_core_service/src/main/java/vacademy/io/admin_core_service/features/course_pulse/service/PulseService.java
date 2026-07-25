package vacademy.io.admin_core_service.features.course_pulse.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.course_pulse.dto.PulseCountsProjection;
import vacademy.io.admin_core_service.features.course_pulse.dto.PulseRosterRow;
import vacademy.io.admin_core_service.features.course_pulse.dto.PulseRosterRowProjection;
import vacademy.io.admin_core_service.features.course_pulse.dto.PulseSummaryResponse;
import vacademy.io.admin_core_service.features.course_pulse.repository.PulseRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.time.Instant;
import java.util.List;

/**
 * Builds the live Roster payload from the presence columns on activity_log.
 * Presence state is derived here (not stored): the two windows and the stuck
 * threshold are config-tunable because they are coupled to the learner app's
 * ~60s write cadence (see V403 migration notes).
 */
@Service
@RequiredArgsConstructor
public class PulseService {

    private final PulseRepository pulseRepository;

    /** last_seen within this window => ACTIVE. ~2x the 60s write cadence. */
    @Value("${pulse.active-window-seconds:120}")
    private long activeWindowSeconds;

    /** last_seen older than this => OFFLINE (excluded from the live set). */
    @Value("${pulse.offline-window-seconds:600}")
    private long offlineWindowSeconds;

    /** active AND on one slide longer than this => v1 "needs help" proxy. */
    @Value("${pulse.stuck-threshold-seconds:1500}")
    private long stuckThresholdSeconds;

    /** default roster row cap when the caller does not specify one. */
    @Value("${pulse.roster-limit-default:50}")
    private int defaultRosterLimit;

    /** hard ceiling so a caller cannot request an unbounded roster. */
    @Value("${pulse.roster-limit-max:200}")
    private int maxRosterLimit;

    public PulseSummaryResponse getSummary(String batchId, Integer limit, CustomUserDetails user) {
        int rowLimit = resolveLimit(limit);
        Instant offlineCutoff = Instant.now().minusSeconds(offlineWindowSeconds);

        PulseCountsProjection counts = pulseRepository.getCounts(
                batchId, offlineCutoff, activeWindowSeconds, stuckThresholdSeconds);
        long enrolled = pulseRepository.countEnrolled(batchId);

        List<PulseRosterRowProjection> raw = pulseRepository.getRoster(
                batchId, offlineCutoff, activeWindowSeconds, stuckThresholdSeconds, rowLimit);

        List<PulseRosterRow> roster = raw.stream().map(this::toRow).toList();

        long active = nz(counts.getActiveCount());
        long idle = nz(counts.getIdleCount());
        long present = active + idle;

        PulseSummaryResponse.Counts summaryCounts = PulseSummaryResponse.Counts.builder()
                .active(active)
                .idle(idle)
                .needHelp(nz(counts.getNeedHelpCount()))
                .enrolled(enrolled)
                .offline(Math.max(0, enrolled - present))
                .build();

        return PulseSummaryResponse.builder()
                .counts(summaryCounts)
                .roster(roster)
                .returned(roster.size())
                .totalPresent((int) present)
                .build();
    }

    private PulseRosterRow toRow(PulseRosterRowProjection p) {
        long onSlide = nz(p.getOnSlideSeconds());
        long lastSeenAgo = nz(p.getLastSeenAgoSeconds());
        return PulseRosterRow.builder()
                .userId(p.getUserId())
                .fullName(p.getFullName())
                .slideId(p.getSlideId())
                .slideTitle(p.getSlideTitle())
                .slideType(p.getSlideType())
                .chapterId(p.getChapterId())
                .onSlideSeconds(onSlide)
                .state(deriveState(lastSeenAgo, onSlide))
                .build();
    }

    private String deriveState(long lastSeenAgoSeconds, long onSlideSeconds) {
        if (lastSeenAgoSeconds > activeWindowSeconds) {
            return "IDLE";
        }
        if (onSlideSeconds >= stuckThresholdSeconds) {
            return "NEEDS_HELP";
        }
        return "ACTIVE";
    }

    private int resolveLimit(Integer requested) {
        if (requested == null || requested <= 0) {
            return defaultRosterLimit;
        }
        return Math.min(requested, maxRosterLimit);
    }

    private static long nz(Long v) {
        return v == null ? 0L : v;
    }
}
