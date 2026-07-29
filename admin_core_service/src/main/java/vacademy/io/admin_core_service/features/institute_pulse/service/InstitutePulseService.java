package vacademy.io.admin_core_service.features.institute_pulse.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.course_pulse.service.PulseCache;
import vacademy.io.admin_core_service.features.institute_pulse.dto.InstituteContentMapProjection;
import vacademy.io.admin_core_service.features.institute_pulse.dto.InstituteContentMapResponse;
import vacademy.io.admin_core_service.features.institute_pulse.dto.InstituteFeedEventProjection;
import vacademy.io.admin_core_service.features.institute_pulse.dto.InstituteLiveClassesResponse;
import vacademy.io.admin_core_service.features.institute_pulse.dto.InstitutePulseFeedResponse;
import vacademy.io.admin_core_service.features.institute_pulse.dto.InstitutePulseSummaryResponse;
import vacademy.io.admin_core_service.features.institute_pulse.dto.InstituteRosterRowProjection;
import vacademy.io.admin_core_service.features.institute_pulse.dto.LiveClassProjection;
import vacademy.io.admin_core_service.features.institute_pulse.dto.BbbRunningMeetingDTO;
import vacademy.io.admin_core_service.features.institute_pulse.dto.LiveClassTotalsProjection;
import vacademy.io.admin_core_service.features.institute_pulse.dto.LiveRoomEvent;
import vacademy.io.admin_core_service.features.institute_pulse.repository.InstitutePulseRepository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Institute-wide Pulse. Mirrors {@code PulseService} but tunes independently — the windows are
 * coupled to the learner app's ~60s presence write cadence, while the caps and cache TTLs are
 * coupled to institute-scale volumes, which are an order of magnitude larger.
 *
 * <p>Reuses {@code PulseCache} rather than introducing a second cache class: it is a generic
 * string-keyed TTL holder with no batch-specific logic, and institute keys are namespaced.
 */
@Service
@RequiredArgsConstructor
public class InstitutePulseService {

    private final InstitutePulseRepository repository;
    private final PulseCache cache;
    private final BbbLiveMeetingCache bbbLive;

    /** last_seen within this window => ACTIVE. ~2x the 60s write cadence. */
    @Value("${institute-pulse.active-window-seconds:120}")
    private long activeWindowSeconds;

    /** last_seen older than this => OFFLINE (excluded from the live set). */
    @Value("${institute-pulse.offline-window-seconds:300}")
    private long offlineWindowSeconds;

    @Value("${institute-pulse.wrong-attempt-threshold:3}")
    private long wrongAttemptThreshold;

    @Value("${institute-pulse.failed-code-threshold:2}")
    private long failedCodeThreshold;

    /** Learners per roster page. Small by default — the tail is a click away. */
    @Value("${institute-pulse.roster-limit-default:10}")
    private int defaultRosterLimit;

    @Value("${institute-pulse.roster-limit-max:200}")
    private int maxRosterLimit;

    @Value("${institute-pulse.feed-window-minutes-default:15}")
    private int defaultFeedWindowMinutes;

    @Value("${institute-pulse.feed-window-minutes-max:60}")
    private int maxFeedWindowMinutes;

    /** Feed events per request. Grows on "show more" rather than paging. */
    @Value("${institute-pulse.feed-limit:10}")
    private int feedLimit;

    @Value("${institute-pulse.feed-limit-max:100}")
    private int maxFeedLimit;

    /** Live-class cards per page. */
    @Value("${institute-pulse.live-class-page-size:10}")
    private int liveClassPageSize;

    /**
     * How long past its scheduled end a class keeps showing as on air. DEFAULT 0 — disabled.
     *
     * <p>{@code last_entry_time} IS the scheduled end time (the app derives class duration from
     * {@code Duration.between(start_time, last_entry_time)}), so a grace window means "keep
     * showing classes past their scheduled end because they might still be running".
     *
     * <p>Tried at 45 and switched off: teachers confirmed the classes it surfaced had already
     * finished. The schedule cannot tell us whether a meeting is actually running — it is a plan,
     * not an observation — and guessing in that direction produces confident false positives.
     * Guessing the other way is just as wrong: BBB showed a class live while its schedule still
     * said "starts in 60 minutes", because the teacher opened it early.
     *
     * <p>The real fix is to read the provider's running-meeting list. Until then this stays 0 and
     * the tab shows exactly what the timetable claims, no more.
     */
    @Value("${institute-pulse.overrun-grace-minutes:0}")
    private int overrunGraceMinutes;

    /** Lookahead for the "next N minutes" strip. */
    @Value("${institute-pulse.upcoming-lookahead-minutes:60}")
    private int upcomingLookaheadMinutes;

    /** TTL for the shared per-institute read cache; 0 disables it. */
    @Value("${institute-pulse.cache-ttl-seconds:10}")
    private long cacheTtlSeconds;

    /**
     * The enrolled denominator changes on enrolment, not on activity, so it is cached far longer
     * than the live payloads — a COUNT over every active enrolment in the institute is not worth
     * repeating every 10 seconds.
     */
    @Value("${institute-pulse.enrolled-cache-ttl-seconds:300}")
    private long enrolledCacheTtlSeconds;

    /** Providers whose attendance only lands via a post-hoc sync, not at join time. */
    private static final Set<String> SYNCED_PROVIDERS = Set.of("ZOOM", "GOOGLE", "GOOGLE_MEET");

    // ---------------------------------------------------------------- summary

    public InstitutePulseSummaryResponse getSummary(String instituteId, String packageSessionId,
                                                    Integer page, Integer limit) {
        int pageIndex = (page == null || page < 0) ? 0 : page;
        int rowLimit = resolveLimit(limit);
        String batch = scope(packageSessionId);
        // Page is part of the key: page 0 stays hot and shared across every admin watching this
        // institute, while deeper pages are rare and cheap to miss.
        return cache.get("inst:summary:" + instituteId + ":" + batch + ":" + pageIndex + ":" + rowLimit,
                cacheTtlSeconds * 1000L,
                () -> computeSummary(instituteId, batch, pageIndex, rowLimit));
    }

    private InstitutePulseSummaryResponse computeSummary(String instituteId, String batch,
                                                         int page, int rowLimit) {
        Instant offlineCutoff = Instant.now().minusSeconds(offlineWindowSeconds);
        List<InstituteRosterRowProjection> learners = repository.getRosterPage(
                instituteId, batch, offlineCutoff, activeWindowSeconds,
                wrongAttemptThreshold, failedCodeThreshold, rowLimit, page * rowLimit);

        // Denominator follows the scope, so "offline" means offline WITHIN the selected batch.
        long enrolled = cache.get("inst:enrolled:" + instituteId + ":" + batch,
                enrolledCacheTtlSeconds * 1000L,
                () -> repository.countEnrolled(instituteId, batch));

        // State, ordering and the KPI counts all come from SQL now. The counts are window
        // aggregates over the whole active set, so they are identical on every row and stay
        // correct regardless of which page this is.
        InstituteRosterRowProjection anyRow = learners.isEmpty() ? null : learners.get(0);
        long present  = anyRow == null ? 0 : nz(anyRow.getTotalPresent());
        long active   = anyRow == null ? 0 : nz(anyRow.getActiveCount());
        long idle     = anyRow == null ? 0 : nz(anyRow.getIdleCount());
        long needHelp = anyRow == null ? 0 : nz(anyRow.getNeedHelpCount());

        List<InstitutePulseSummaryResponse.RosterRow> rows = new ArrayList<>(learners.size());
        for (InstituteRosterRowProjection p : learners) {
            rows.add(InstitutePulseSummaryResponse.RosterRow.builder()
                    .userId(p.getUserId())
                    .fullName(p.getFullName())
                    .slideId(p.getSlideId())
                    .slideTitle(p.getSlideTitle())
                    .slideType(p.getSlideType())
                    .onSlideSeconds(nz(p.getOnSlideSeconds()))
                    .state(p.getState())
                    .build());
        }

        return InstitutePulseSummaryResponse.builder()
                .counts(InstitutePulseSummaryResponse.Counts.builder()
                        .active(active)
                        .idle(idle)
                        .needHelp(needHelp)
                        .enrolled(enrolled)
                        .offline(Math.max(0, enrolled - present))
                        .build())
                .roster(rows)
                .returned(rows.size())
                .totalPresent((int) present)
                .page(page)
                .hasMore((long) page * rowLimit + rows.size() < present)
                .build();
    }

    // ------------------------------------------------------------ content map

    public InstituteContentMapResponse getContentMap(String instituteId, String packageSessionId) {
        String batch = scope(packageSessionId);
        return cache.get("inst:contentmap:" + instituteId + ":" + batch, cacheTtlSeconds * 1000L,
                () -> computeContentMap(instituteId, batch));
    }

    private InstituteContentMapResponse computeContentMap(String instituteId, String batch) {
        Instant offlineCutoff = Instant.now().minusSeconds(offlineWindowSeconds);
        List<InstituteContentMapProjection> rows =
                repository.getContentMap(instituteId, batch, offlineCutoff);

        Map<String, InstituteContentMapResponse.CourseNode> courses = new LinkedHashMap<>();
        Map<String, InstituteContentMapResponse.SubjectNode> subjects = new LinkedHashMap<>();
        Map<String, InstituteContentMapResponse.ModuleNode> modules = new LinkedHashMap<>();
        Map<String, InstituteContentMapResponse.ChapterNode> chapters = new LinkedHashMap<>();
        int totalHeads = 0;

        for (InstituteContentMapProjection r : rows) {
            int heads = (int) nz(r.getHeadsNow());
            totalHeads += heads;

            InstituteContentMapResponse.CourseNode course = courses.computeIfAbsent(
                    r.getCourseId(), id -> InstituteContentMapResponse.CourseNode.builder()
                            .id(id).name(r.getCourseName()).headsNow(0)
                            .subjects(new ArrayList<>()).build());

            String subjectKey = r.getCourseId() + "|" + r.getSubjectId();
            InstituteContentMapResponse.SubjectNode subject = subjects.computeIfAbsent(subjectKey, k -> {
                InstituteContentMapResponse.SubjectNode s = InstituteContentMapResponse.SubjectNode.builder()
                        .id(r.getSubjectId()).name(r.getSubjectName()).headsNow(0)
                        .modules(new ArrayList<>()).build();
                course.getSubjects().add(s);
                return s;
            });

            String moduleKey = subjectKey + "|" + r.getModuleId();
            InstituteContentMapResponse.ModuleNode module = modules.computeIfAbsent(moduleKey, k -> {
                InstituteContentMapResponse.ModuleNode m = InstituteContentMapResponse.ModuleNode.builder()
                        .id(r.getModuleId()).name(r.getModuleName()).headsNow(0)
                        .chapters(new ArrayList<>()).build();
                subject.getModules().add(m);
                return m;
            });

            String chapterKey = moduleKey + "|" + r.getChapterId();
            InstituteContentMapResponse.ChapterNode chapter = chapters.computeIfAbsent(chapterKey, k -> {
                InstituteContentMapResponse.ChapterNode c = InstituteContentMapResponse.ChapterNode.builder()
                        .id(r.getChapterId()).name(r.getChapterName()).headsNow(0)
                        .slides(new ArrayList<>()).build();
                module.getChapters().add(c);
                return c;
            });

            chapter.getSlides().add(InstituteContentMapResponse.SlideNode.builder()
                    .id(r.getSlideId())
                    .title(r.getSlideTitle())
                    .slideType(r.getSlideType())
                    .headsNow(heads)
                    .avgOnSlideSeconds(nz(r.getAvgOnSlideSeconds()))
                    .build());

            course.setHeadsNow(course.getHeadsNow() + heads);
            subject.setHeadsNow(subject.getHeadsNow() + heads);
            module.setHeadsNow(module.getHeadsNow() + heads);
            chapter.setHeadsNow(chapter.getHeadsNow() + heads);
        }

        // Sort every level by heat so hotspots surface at the top.
        List<InstituteContentMapResponse.CourseNode> courseList = new ArrayList<>(courses.values());
        for (InstituteContentMapResponse.CourseNode c : courseList) {
            for (InstituteContentMapResponse.SubjectNode s : c.getSubjects()) {
                for (InstituteContentMapResponse.ModuleNode m : s.getModules()) {
                    for (InstituteContentMapResponse.ChapterNode ch : m.getChapters()) {
                        ch.getSlides().sort(Comparator.comparingInt(
                                InstituteContentMapResponse.SlideNode::getHeadsNow).reversed());
                    }
                    m.getChapters().sort(Comparator.comparingInt(
                            InstituteContentMapResponse.ChapterNode::getHeadsNow).reversed());
                }
                s.getModules().sort(Comparator.comparingInt(
                        InstituteContentMapResponse.ModuleNode::getHeadsNow).reversed());
            }
            c.getSubjects().sort(Comparator.comparingInt(
                    InstituteContentMapResponse.SubjectNode::getHeadsNow).reversed());
        }
        courseList.sort(Comparator.comparingInt(
                InstituteContentMapResponse.CourseNode::getHeadsNow).reversed());

        return InstituteContentMapResponse.builder()
                .courses(courseList)
                .totalHeads(totalHeads)
                .build();
    }

    // ----------------------------------------------------------- live classes

    public InstituteLiveClassesResponse getLiveClasses(String instituteId, String packageSessionId,
                                                       Integer onAirPage, Integer upcomingPage) {
        int onAirIdx = (onAirPage == null || onAirPage < 0) ? 0 : onAirPage;
        int upcomingIdx = (upcomingPage == null || upcomingPage < 0) ? 0 : upcomingPage;
        String batch = scope(packageSessionId);
        return cache.get("inst:liveclasses:" + instituteId + ":" + batch + ":" + onAirIdx + ":" + upcomingIdx,
                cacheTtlSeconds * 1000L,
                () -> computeLiveClasses(instituteId, batch, onAirIdx, upcomingIdx));
    }

    private InstituteLiveClassesResponse computeLiveClasses(String instituteId, String batch,
                                                            int onAirPage, int upcomingPage) {
        // Totals come from their own aggregate rather than summing the returned cards — with
        // paging, page sums would silently mean "page 1 only" in the KPI strip.
        LiveClassTotalsProjection t = repository.getLiveClassTotals(instituteId, batch, upcomingLookaheadMinutes, overrunGraceMinutes);
        long onAirTotal = t == null ? 0 : nz(t.getOnAirCount());
        long upcomingTotal = t == null ? 0 : nz(t.getUpcomingCount());

        List<InstituteLiveClassesResponse.LiveClassCard> onAir =
                repository.getOnAirClasses(instituteId, batch, overrunGraceMinutes, liveClassPageSize,
                                onAirPage * liveClassPageSize)
                        .stream().map(this::toCard).toList();
        List<InstituteLiveClassesResponse.LiveClassCard> upcoming =
                repository.getUpcomingClasses(instituteId, batch, upcomingLookaheadMinutes,
                                liveClassPageSize, upcomingPage * liveClassPageSize)
                        .stream().map(this::toCard).toList();

        return InstituteLiveClassesResponse.builder()
                .onAir(onAir)
                .upcoming(upcoming)
                .onAirCount(onAirTotal)
                .upcomingCount(upcomingTotal)
                .onAirHasMore((long) onAirPage * liveClassPageSize + onAir.size() < onAirTotal)
                .upcomingHasMore((long) upcomingPage * liveClassPageSize + upcoming.size() < upcomingTotal)
                .invitedNow(t == null ? 0 : nz(t.getInvitedNow()))
                .joinedNow(t == null ? 0 : nz(t.getJoinedNow()))
                .build();
    }

    private InstituteLiveClassesResponse.LiveClassCard toCard(LiveClassProjection p) {
        long invited = nz(p.getInvitedCount());
        long joined = nz(p.getJoinedCount());
        String provider = p.getProvider();

        // Provider truth, when we have it. Deliberately additive: `joined` stays "ever joined"
        // (which is what turnout means) and `inRoomNow` answers the different question of who is
        // present. Null rather than 0 when unknown, so the UI never implies an empty room.
        Optional<BbbRunningMeetingDTO> live = bbbLive.forSchedule(p.getScheduleId());
        Integer inRoomNow = live
                .map(m -> Math.max(0, m.getParticipantCount() - m.getModeratorCount()))
                .orElse(null);

        return InstituteLiveClassesResponse.LiveClassCard.builder()
                .inRoomNow(inRoomNow)
                .providerLive(live.isPresent())
                .sessionId(p.getSessionId())
                .scheduleId(p.getScheduleId())
                .title(p.getTitle())
                .subject(p.getSubject())
                .startEpoch(p.getStartEpoch())
                .endEpoch(p.getEndEpoch())
                .provider(provider)
                .invited(invited)
                .joined(joined)
                .absent(Math.max(0, invited - joined))
                .turnoutPercent(invited > 0 ? (int) Math.round(joined * 100.0 / invited) : 0)
                .started(Boolean.TRUE.equals(p.getStarted()))
                .runningOver(Boolean.TRUE.equals(p.getRunningOver()))
                .attendanceSynced(provider != null && SYNCED_PROVIDERS.contains(provider.toUpperCase()))
                .lastSyncEpoch(p.getLastSyncEpoch())
                .build();
    }

    // ------------------------------------------------------------------ feed

    public InstitutePulseFeedResponse getFeed(String instituteId, String packageSessionId,
                                              Integer windowMinutes, Integer limit) {
        int window = (windowMinutes == null || windowMinutes <= 0)
                ? defaultFeedWindowMinutes
                : Math.min(windowMinutes, maxFeedWindowMinutes);
        int rowLimit = (limit == null || limit <= 0) ? feedLimit : Math.min(limit, maxFeedLimit);
        String batch = scope(packageSessionId);
        return cache.get("inst:feed:" + instituteId + ":" + batch + ":" + window + ":" + rowLimit,
                cacheTtlSeconds * 1000L,
                () -> computeFeed(instituteId, batch, window, rowLimit));
    }

    private InstitutePulseFeedResponse computeFeed(String instituteId, String batch, int window,
                                                   int rowLimit) {
        Instant sinceCutoff = Instant.now().minusSeconds(window * 60L);

        // Fetch one extra to learn whether more exist, without a second counting query over the
        // 6-way UNION. The extra row is dropped before returning.
        List<InstituteFeedEventProjection> rows =
                repository.getFeed(instituteId, batch, sinceCutoff, rowLimit + 1);
        boolean hasMore = rows.size() > rowLimit;

        List<InstitutePulseFeedResponse.FeedEvent> events =
                new ArrayList<>(rows.stream().limit(rowLimit).map(this::toEvent).toList());

        // Leave (and provider-observed join) events come from the in-memory poller, not the DB —
        // nothing persists them, by design. Merged here so the feed is one timeline.
        for (LiveRoomEvent e : bbbLive.eventsSince(instituteId, sinceCutoff.toEpochMilli())) {
            events.add(InstitutePulseFeedResponse.FeedEvent.builder()
                    .occurredAtEpoch(e.getOccurredAtEpoch())
                    .userId(e.getProviderUserId())
                    .fullName(e.getParticipantName())
                    .slideId(null)
                    .slideTitle(e.getSessionTitle())
                    .slideType(null)
                    .rail("LIVE_CLASS")
                    .eventType(e.getEventType())
                    .detail(null)
                    .actorRole(e.isHost() ? "HOST" : null)
                    .build());
        }
        events.sort((a, b) -> Long.compare(b.getOccurredAtEpoch(), a.getOccurredAtEpoch()));
        List<InstitutePulseFeedResponse.FeedEvent> capped = events.size() > rowLimit
                ? new ArrayList<>(events.subList(0, rowLimit))
                : events;

        return InstitutePulseFeedResponse.builder()
                .events(capped)
                .windowMinutes(window)
                .hasMore(hasMore || events.size() > rowLimit)
                .build();
    }

    private InstitutePulseFeedResponse.FeedEvent toEvent(InstituteFeedEventProjection e) {
        return InstitutePulseFeedResponse.FeedEvent.builder()
                .occurredAtEpoch(nz(e.getOccurredAtEpoch()))
                .userId(e.getUserId())
                .fullName(e.getFullName())
                .slideId(e.getSlideId())
                .slideTitle(e.getSlideTitle())
                .slideType(e.getSlideType())
                .rail(e.getRail())
                .eventType(e.getEventType())
                .detail(e.getDetail())
                .actorRole(e.getActorRole())
                .build();
    }

    // ---------------------------------------------------------------- helpers

    private int resolveLimit(Integer requested) {
        if (requested == null || requested <= 0) {
            return defaultRosterLimit;
        }
        return Math.min(requested, maxRosterLimit);
    }

    /**
     * Normalises the optional batch scope. Empty string rather than null is the "no filter" value:
     * a nullable parameter in a native query forces CAST gymnastics for Postgres type inference,
     * and no real package_session_id is ever blank.
     */
    private static String scope(String packageSessionId) {
        return (packageSessionId == null || packageSessionId.isBlank()) ? "" : packageSessionId;
    }

    private static long nz(Long v) {
        return v == null ? 0L : v;
    }
}
