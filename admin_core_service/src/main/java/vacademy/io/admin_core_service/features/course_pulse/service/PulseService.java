package vacademy.io.admin_core_service.features.course_pulse.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.course_pulse.dto.ContentMapResponse;
import vacademy.io.admin_core_service.features.course_pulse.dto.ContentMapSlideProjection;
import vacademy.io.admin_core_service.features.course_pulse.dto.FeedEventProjection;
import vacademy.io.admin_core_service.features.course_pulse.dto.PulseFeedResponse;
import vacademy.io.admin_core_service.features.course_pulse.dto.PulseRosterRow;
import vacademy.io.admin_core_service.features.course_pulse.dto.PulseRosterRowProjection;
import vacademy.io.admin_core_service.features.course_pulse.dto.PulseSummaryResponse;
import vacademy.io.admin_core_service.features.course_pulse.repository.PulseRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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
    private final PulseCache pulseCache;

    /** last_seen within this window => ACTIVE. ~2x the 60s write cadence. */
    @Value("${pulse.active-window-seconds:120}")
    private long activeWindowSeconds;

    /** last_seen older than this => OFFLINE (excluded from the live set). Tightened to 5 min so a
     *  learner who closed a slide drops off quickly; the presence heartbeat keeps genuinely-present
     *  learners (incl. paused media) writing every ~60s so they don't fall into this by mistake. */
    @Value("${pulse.offline-window-seconds:300}")
    private long offlineWindowSeconds;

    /** wrong question/quiz answers on the current slide at/above this => needs help. */
    @Value("${pulse.wrong-attempt-threshold:3}")
    private long wrongAttemptThreshold;

    /** failing code submissions on the current slide at/above this => needs help. */
    @Value("${pulse.failed-code-threshold:2}")
    private long failedCodeThreshold;

    /** default roster row cap when the caller does not specify one. */
    @Value("${pulse.roster-limit-default:50}")
    private int defaultRosterLimit;

    /** hard ceiling so a caller cannot request an unbounded roster. */
    @Value("${pulse.roster-limit-max:200}")
    private int maxRosterLimit;

    /** default Live Feed lookback window. */
    @Value("${pulse.feed-window-minutes-default:15}")
    private int defaultFeedWindowMinutes;

    /** hard ceiling on the Live Feed lookback window. */
    @Value("${pulse.feed-window-minutes-max:60}")
    private int maxFeedWindowMinutes;

    /** Live Feed row cap. */
    @Value("${pulse.feed-limit:50}")
    private int feedLimit;

    /** TTL for the shared per-batch read cache; 0 disables it. */
    @Value("${pulse.cache-ttl-seconds:8}")
    private long cacheTtlSeconds;

    public PulseSummaryResponse getSummary(String batchId, Integer limit, CustomUserDetails user) {
        int rowLimit = resolveLimit(limit);
        return pulseCache.get("summary:" + batchId + ":" + rowLimit, cacheTtlSeconds * 1000L,
                () -> computeSummary(batchId, rowLimit));
    }

    private PulseSummaryResponse computeSummary(String batchId, int rowLimit) {
        Instant offlineCutoff = Instant.now().minusSeconds(offlineWindowSeconds);
        List<PulseRosterRowProjection> learners = pulseRepository.getActiveLearners(batchId, offlineCutoff);
        long enrolled = pulseRepository.countEnrolled(batchId);

        // Derive state, KPI counts, ordering and the cap in Java over the bounded active set.
        long active = 0, idle = 0, needHelp = 0;
        List<PulseRosterRow> rows = new ArrayList<>(learners.size());
        for (PulseRosterRowProjection p : learners) {
            long lastSeenAgo = nz(p.getLastSeenAgoSeconds());
            long onSlide = nz(p.getOnSlideSeconds());
            boolean struggling = nz(p.getWrongCount()) >= wrongAttemptThreshold
                    || nz(p.getFailedCodeCount()) >= failedCodeThreshold;

            String state;
            if (lastSeenAgo > activeWindowSeconds) {
                state = "IDLE";
                idle++;
            } else {
                active++;
                if (struggling) {
                    state = "NEEDS_HELP";
                    needHelp++;
                } else {
                    state = "ACTIVE";
                }
            }

            rows.add(PulseRosterRow.builder()
                    .userId(p.getUserId())
                    .fullName(p.getFullName())
                    .slideId(p.getSlideId())
                    .slideTitle(p.getSlideTitle())
                    .slideType(p.getSlideType())
                    .chapterId(p.getChapterId())
                    .onSlideSeconds(onSlide)
                    .state(state)
                    .build());
        }

        // Needs-attention order: NEEDS_HELP, then IDLE, then ACTIVE; longest-on-slide first within each.
        rows.sort(Comparator.comparingInt((PulseRosterRow r) -> stateRank(r.getState()))
                .thenComparing(Comparator.comparingLong(PulseRosterRow::getOnSlideSeconds).reversed()));

        List<PulseRosterRow> capped = rows.size() > rowLimit
                ? new ArrayList<>(rows.subList(0, rowLimit))
                : rows;
        long present = active + idle;

        PulseSummaryResponse.Counts summaryCounts = PulseSummaryResponse.Counts.builder()
                .active(active)
                .idle(idle)
                .needHelp(needHelp)
                .enrolled(enrolled)
                .offline(Math.max(0, enrolled - present))
                .build();

        return PulseSummaryResponse.builder()
                .counts(summaryCounts)
                .roster(capped)
                .returned(capped.size())
                .totalPresent((int) present)
                .build();
    }

    private static int stateRank(String state) {
        return switch (state) {
            case "NEEDS_HELP" -> 0;
            case "IDLE" -> 1;
            default -> 2;
        };
    }

    public ContentMapResponse getContentMap(String batchId, CustomUserDetails user) {
        return pulseCache.get("contentmap:" + batchId, cacheTtlSeconds * 1000L,
                () -> computeContentMap(batchId));
    }

    private ContentMapResponse computeContentMap(String batchId) {
        Instant offlineCutoff = Instant.now().minusSeconds(offlineWindowSeconds);
        List<ContentMapSlideProjection> rows = pulseRepository.getContentMap(batchId, offlineCutoff);

        // Assemble the subject -> module -> chapter -> slide tree, keeping only active
        // branches and rolling head counts up. Each learner is on exactly one slide, so
        // a node's head count is the exact sum of its descendant slide heads.
        Map<String, ContentMapResponse.SubjectNode> subjects = new LinkedHashMap<>();
        Map<String, ContentMapResponse.ModuleNode> modules = new LinkedHashMap<>();
        Map<String, ContentMapResponse.ChapterNode> chapters = new LinkedHashMap<>();
        int totalHeads = 0;

        for (ContentMapSlideProjection r : rows) {
            int heads = (int) nz(r.getHeadsNow());
            totalHeads += heads;

            ContentMapResponse.SubjectNode subject = subjects.computeIfAbsent(r.getSubjectId(), id ->
                    ContentMapResponse.SubjectNode.builder()
                            .id(id).name(r.getSubjectName()).headsNow(0)
                            .modules(new ArrayList<>()).build());

            String moduleKey = r.getSubjectId() + "|" + r.getModuleId();
            ContentMapResponse.ModuleNode module = modules.computeIfAbsent(moduleKey, k -> {
                ContentMapResponse.ModuleNode m = ContentMapResponse.ModuleNode.builder()
                        .id(r.getModuleId()).name(r.getModuleName()).headsNow(0)
                        .chapters(new ArrayList<>()).build();
                subject.getModules().add(m);
                return m;
            });

            String chapterKey = moduleKey + "|" + r.getChapterId();
            ContentMapResponse.ChapterNode chapter = chapters.computeIfAbsent(chapterKey, k -> {
                ContentMapResponse.ChapterNode c = ContentMapResponse.ChapterNode.builder()
                        .id(r.getChapterId()).name(r.getChapterName()).headsNow(0)
                        .slides(new ArrayList<>()).build();
                module.getChapters().add(c);
                return c;
            });

            chapter.getSlides().add(ContentMapResponse.SlideNode.builder()
                    .id(r.getSlideId())
                    .title(r.getSlideTitle())
                    .slideType(r.getSlideType())
                    .headsNow(heads)
                    .avgOnSlideSeconds(nz(r.getAvgOnSlideSeconds()))
                    .friction(false)
                    .baselineMedianSeconds(null)
                    .build());

            subject.setHeadsNow(subject.getHeadsNow() + heads);
            module.setHeadsNow(module.getHeadsNow() + heads);
            chapter.setHeadsNow(chapter.getHeadsNow() + heads);
        }

        // Sort every level by heat (most learners first) so hotspots surface at the top.
        List<ContentMapResponse.SubjectNode> subjectList = new ArrayList<>(subjects.values());
        for (ContentMapResponse.SubjectNode s : subjectList) {
            for (ContentMapResponse.ModuleNode m : s.getModules()) {
                for (ContentMapResponse.ChapterNode c : m.getChapters()) {
                    c.getSlides().sort(Comparator.comparingInt(ContentMapResponse.SlideNode::getHeadsNow).reversed());
                }
                m.getChapters().sort(Comparator.comparingInt(ContentMapResponse.ChapterNode::getHeadsNow).reversed());
            }
            s.getModules().sort(Comparator.comparingInt(ContentMapResponse.ModuleNode::getHeadsNow).reversed());
        }
        subjectList.sort(Comparator.comparingInt(ContentMapResponse.SubjectNode::getHeadsNow).reversed());

        return ContentMapResponse.builder()
                .subjects(subjectList)
                .totalHeads(totalHeads)
                .build();
    }

    public PulseFeedResponse getFeed(String batchId, Integer windowMinutes, CustomUserDetails user) {
        int window = (windowMinutes == null || windowMinutes <= 0)
                ? defaultFeedWindowMinutes
                : Math.min(windowMinutes, maxFeedWindowMinutes);
        return pulseCache.get("feed:" + batchId + ":" + window, cacheTtlSeconds * 1000L,
                () -> computeFeed(batchId, window));
    }

    private PulseFeedResponse computeFeed(String batchId, int window) {
        Instant sinceCutoff = Instant.now().minusSeconds(window * 60L);

        List<PulseFeedResponse.FeedEvent> events = pulseRepository.getFeed(batchId, sinceCutoff, feedLimit)
                .stream()
                .map(this::toEvent)
                .toList();

        return PulseFeedResponse.builder()
                .events(events)
                .windowMinutes(window)
                .build();
    }

    private PulseFeedResponse.FeedEvent toEvent(FeedEventProjection e) {
        return PulseFeedResponse.FeedEvent.builder()
                .occurredAtEpoch(nz(e.getOccurredAtEpoch()))
                .userId(e.getUserId())
                .fullName(e.getFullName())
                .slideId(e.getSlideId())
                .slideTitle(e.getSlideTitle())
                .slideType(e.getSlideType())
                .eventType(e.getEventType())
                .detail(e.getDetail())
                .build();
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
