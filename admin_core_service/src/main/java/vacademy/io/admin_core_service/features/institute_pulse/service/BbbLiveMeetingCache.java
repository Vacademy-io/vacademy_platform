package vacademy.io.admin_core_service.features.institute_pulse.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.institute_pulse.dto.BbbRunningMeetingDTO;
import vacademy.io.admin_core_service.features.institute_pulse.dto.LiveRoomEvent;
import vacademy.io.admin_core_service.features.institute_pulse.dto.ProviderMeetingRefProjection;
import vacademy.io.admin_core_service.features.institute_pulse.repository.InstitutePulseRepository;
import vacademy.io.admin_core_service.features.live_session.provider.entity.BbbServerPool;
import vacademy.io.admin_core_service.features.live_session.provider.manager.BbbMeetingManager;
import vacademy.io.admin_core_service.features.live_session.provider.repository.BbbServerPoolRepository;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Polls BBB for the set of meetings actually running, so Institute Pulse can stop inferring
 * liveness from the timetable.
 *
 * <p><b>Why this exists.</b> The schedule is a plan, not an observation. Teachers open classes
 * early and run past the scheduled end, so clock arithmetic produced confident errors in both
 * directions — classes shown as "running over" that had finished, and classes genuinely live that
 * we listed as "starting in 60 minutes". BBB knows the truth; nothing else does.
 *
 * <p><b>Cost discipline — the constraint this was built under.</b>
 * <ul>
 *   <li><b>O(servers), not O(meetings).</b> {@code getMeetings} returns every running meeting on a
 *       server in ONE call. Using {@code isMeetingRunning} would have been one HTTP round trip per
 *       class, which does not scale.
 *   <li><b>Zero calls when nothing is running.</b> Each tick first runs one indexed query for
 *       servers with a schedule inside its window. Outside class hours that returns empty and the
 *       poller does nothing at all — no HTTP, no work.
 *   <li><b>Zero database writes.</b> Live occupancy and join/leave events are held in memory in
 *       bounded structures. Persisting a row per join/leave would add write load proportional to
 *       concurrent learners — precisely the cost this must not add. The feed only looks back
 *       minutes, so nothing needs durability.
 *   <li><b>Zero extra work on the request path.</b> Reads are ConcurrentHashMap lookups. Admin
 *       polls do not trigger provider calls, so cost is flat in the number of admins watching.
 * </ul>
 *
 * <p><b>Per-JVM.</b> Each replica polls independently and holds its own event buffer, so with N
 * replicas BBB sees N times the calls and an admin may see a partial event history depending which
 * replica answers. At current replica counts that is cheaper than the coordination needed to avoid
 * it; if it stops being true, this moves behind Redis rather than changing shape.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class BbbLiveMeetingCache {

    private final InstitutePulseRepository repository;
    private final BbbServerPoolRepository serverPoolRepository;
    private final BbbMeetingManager bbbMeetingManager;

    /** Disabled by default — turn on per environment once BBB reachability is confirmed. */
    @Value("${institute-pulse.bbb-poll.enabled:true}")
    private boolean enabled;

    /** How early before a scheduled start a server becomes worth polling (teachers open early). */
    @Value("${institute-pulse.bbb-poll.start-grace-minutes:30}")
    private int startGraceMinutes;

    /** How long after a scheduled end a server stays worth polling (classes run over). */
    @Value("${institute-pulse.bbb-poll.end-grace-minutes:60}")
    private int endGraceMinutes;

    /** Ring-buffer size for inferred join/leave events, per institute. */
    @Value("${institute-pulse.bbb-poll.event-buffer:300}")
    private int eventBufferSize;

    /** Live state keyed by provider meeting id. */
    private final Map<String, BbbRunningMeetingDTO> runningByMeetingId = new ConcurrentHashMap<>();

    /** Provider meeting id -> schedule id, so callers can look up by schedule. */
    private final Map<String, String> meetingIdByScheduleId = new ConcurrentHashMap<>();

    /** Bounded, newest-last event buffer per institute. */
    private final Map<String, Deque<LiveRoomEvent>> eventsByInstitute = new ConcurrentHashMap<>();

    /**
     * The previous tick's full snapshot per meeting, kept so departures can be attributed.
     *
     * <p>Someone who has left is absent from the CURRENT snapshot, so neither their name nor
     * their role is readable when the leave is detected — both have to be remembered. Retaining
     * the whole DTO rather than parallel id/name/role maps keeps them from drifting apart.
     */
    private final Map<String, BbbRunningMeetingDTO> previousSnapshot = new ConcurrentHashMap<>();

    /** True when the poller has data, so callers know whether to trust it or fall back. */
    private volatile boolean primed = false;

    public boolean isPrimed() {
        return primed;
    }

    /** Live occupancy for a schedule, or empty when BBB has not reported it as running. */
    public Optional<BbbRunningMeetingDTO> forSchedule(String scheduleId) {
        String meetingId = meetingIdByScheduleId.get(scheduleId);
        return meetingId == null ? Optional.empty()
                : Optional.ofNullable(runningByMeetingId.get(meetingId));
    }

    /** Join/leave events for one institute since {@code sinceEpochMillis}, newest first. */
    public List<LiveRoomEvent> eventsSince(String instituteId, long sinceEpochMillis) {
        Deque<LiveRoomEvent> buffer = eventsByInstitute.get(instituteId);
        if (buffer == null) {
            return List.of();
        }
        synchronized (buffer) {
            return buffer.stream()
                    .filter(e -> e.getOccurredAtEpoch() > sinceEpochMillis)
                    .sorted((a, b) -> Long.compare(b.getOccurredAtEpoch(), a.getOccurredAtEpoch()))
                    .toList();
        }
    }

    @Scheduled(fixedDelayString = "${institute-pulse.bbb-poll.interval-ms:45000}")
    public void poll() {
        if (!enabled) {
            return;
        }
        try {
            // Cost gate: one indexed query. Empty outside class hours => no HTTP at all.
            List<String> serverIds = repository.findActiveBbbServerIds(startGraceMinutes, endGraceMinutes);
            if (serverIds.isEmpty()) {
                if (!runningByMeetingId.isEmpty()) {
                    runningByMeetingId.clear();
                    previousSnapshot.clear();
                    meetingIdByScheduleId.clear();
                }
                primed = true;
                return;
            }

            List<ProviderMeetingRefProjection> refs = repository.findMeetingRefs(serverIds);
            Map<String, ProviderMeetingRefProjection> refByMeetingId = new HashMap<>();
            for (ProviderMeetingRefProjection r : refs) {
                refByMeetingId.put(r.getProviderMeetingId(), r);
            }

            Map<String, BbbRunningMeetingDTO> fresh = new HashMap<>();
            for (String serverId : serverIds) {
                Optional<BbbServerPool> server = serverPoolRepository.findById(serverId);
                if (server.isEmpty() || server.get().getApiUrl() == null) {
                    continue;
                }
                // One call per SERVER returns every running meeting on it.
                fresh.putAll(bbbMeetingManager.getRunningMeetings(
                        server.get().getApiUrl(), server.get().getSecret()));
            }

            long now = System.currentTimeMillis();
            diffAndRecord(fresh, refByMeetingId, now);

            runningByMeetingId.clear();
            runningByMeetingId.putAll(fresh);

            meetingIdByScheduleId.clear();
            for (ProviderMeetingRefProjection r : refs) {
                if (fresh.containsKey(r.getProviderMeetingId())) {
                    meetingIdByScheduleId.put(r.getScheduleId(), r.getProviderMeetingId());
                }
            }
            primed = true;

        } catch (Exception e) {
            // Never let a provider problem break the app; callers fall back to the schedule.
            log.warn("[InstitutePulse] BBB live poll failed: {}", e.getMessage());
        }
    }

    /**
     * Emit JOINED_ROOM / LEFT_ROOM by comparing this tick's attendee set with the last.
     *
     * <p>Granularity is the poll interval, not the instant — someone who joins and leaves inside
     * one tick is never seen. That is the honest limit of inferring events from snapshots, and it
     * is the price of not persisting a row per participant change.
     */
    private void diffAndRecord(Map<String, BbbRunningMeetingDTO> fresh,
                               Map<String, ProviderMeetingRefProjection> refByMeetingId,
                               long now) {
        Set<String> seen = new HashSet<>();

        for (Map.Entry<String, BbbRunningMeetingDTO> entry : fresh.entrySet()) {
            String meetingId = entry.getKey();
            seen.add(meetingId);
            BbbRunningMeetingDTO now_ = entry.getValue();
            Set<String> current = now_.getAttendeeIds();
            BbbRunningMeetingDTO prev = previousSnapshot.get(meetingId);
            Set<String> before = prev == null ? null : prev.getAttendeeIds();
            previousSnapshot.put(meetingId, now_);

            // First sighting: everyone present is pre-existing, not a join. Recording them would
            // dump the whole room into the feed the moment a replica starts.
            if (before == null) {
                continue;
            }

            ProviderMeetingRefProjection ref = refByMeetingId.get(meetingId);
            if (ref == null) {
                continue;
            }

            for (String id : current) {
                if (!before.contains(id)) {
                    record(ref, id, nameOf(now_, id), isHost(now_, id), "JOINED_ROOM", now);
                }
            }
            for (String id : before) {
                if (!current.contains(id)) {
                    // Name and role come from the PREVIOUS snapshot — they are gone from the
                    // current one, so nothing about them is readable there.
                    record(ref, id, nameOf(prev, id), isHost(prev, id), "LEFT_ROOM", now);
                }
            }
        }

        // A meeting that vanished has ended; everyone in it left.
        for (Map.Entry<String, BbbRunningMeetingDTO> stale : Map.copyOf(previousSnapshot).entrySet()) {
            if (seen.contains(stale.getKey())) {
                continue;
            }
            ProviderMeetingRefProjection ref = refByMeetingId.get(stale.getKey());
            BbbRunningMeetingDTO prev = stale.getValue();
            if (ref != null && prev.getAttendeeIds() != null) {
                for (String id : prev.getAttendeeIds()) {
                    record(ref, id, nameOf(prev, id), isHost(prev, id), "LEFT_ROOM", now);
                }
            }
            previousSnapshot.remove(stale.getKey());
        }
    }

    private static String nameOf(BbbRunningMeetingDTO snapshot, String id) {
        return (snapshot == null || snapshot.getAttendeeNames() == null)
                ? null : snapshot.getAttendeeNames().get(id);
    }

    private static boolean isHost(BbbRunningMeetingDTO snapshot, String id) {
        return snapshot != null && snapshot.getModeratorIds() != null
                && snapshot.getModeratorIds().contains(id);
    }

    private void record(ProviderMeetingRefProjection ref, String providerUserId,
                        String participantName, boolean host, String eventType, long now) {
        Deque<LiveRoomEvent> buffer = eventsByInstitute
                .computeIfAbsent(ref.getInstituteId(), k -> new ArrayDeque<>());
        synchronized (buffer) {
            buffer.addLast(LiveRoomEvent.builder()
                    .occurredAtEpoch(now)
                    .instituteId(ref.getInstituteId())
                    .sessionId(ref.getSessionId())
                    .scheduleId(ref.getScheduleId())
                    .sessionTitle(ref.getTitle())
                    .providerUserId(providerUserId)
                    .participantName(participantName)
                    .host(host)
                    .eventType(eventType)
                    .build());
            while (buffer.size() > eventBufferSize) {
                buffer.removeFirst();
            }
        }
    }
}
