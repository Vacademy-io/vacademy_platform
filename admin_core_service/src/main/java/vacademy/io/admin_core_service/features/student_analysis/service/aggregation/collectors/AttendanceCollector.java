package vacademy.io.admin_core_service.features.student_analysis.service.aggregation.collectors;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.live_session.dto.ScheduleAttendanceProjection;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionParticipantRepository;
import vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive.AttendanceSection;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

/**
 * Collects attendance data for a student over the report window.
 * Computes weekly buckets from the raw session list.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AttendanceCollector {

    private final LiveSessionParticipantRepository participantRepository;
    private final ObjectMapper objectMapper;

    private static final DateTimeFormatter MONTH_DAY_FMT = DateTimeFormatter.ofPattern("MMM dd");

    public AttendanceSection collect(String userId, String batchId, LocalDate startDate, LocalDate endDate) {
        try {
            List<ScheduleAttendanceProjection> records =
                    participantRepository.findAttendanceForUser(userId, batchId, startDate, endDate);

            if (records == null || records.isEmpty()) {
                return AttendanceSection.builder().available(true)
                        .overallPercentage(0.0).present(0).absent(0).late(0).unmarked(0)
                        .totalSessions(0)
                        .sessions(List.of())
                        .weekly(List.of())
                        .build();
            }

            int present = 0, absent = 0, unmarked = 0;
            // LATE status — ScheduleAttendanceProjection may not have a LATE value;
            // we track it separately but it will always be 0 unless the projection supports it.
            int late = 0;
            List<AttendanceSection.SessionAttendanceItem> sessions = new ArrayList<>();

            for (ScheduleAttendanceProjection r : records) {
                String status = r.getAttendanceStatus();
                if ("PRESENT".equalsIgnoreCase(status)) present++;
                else if ("ABSENT".equalsIgnoreCase(status)) absent++;
                else if ("LATE".equalsIgnoreCase(status)) late++;
                else unmarked++;

                sessions.add(AttendanceSection.SessionAttendanceItem.builder()
                        .date(r.getMeetingDate() != null ? r.getMeetingDate().toString() : null)
                        .title(r.getSessionTitle())
                        .subject(r.getSubject())
                        .status(status)
                        .durationMinutes(null)
                        .engagement(null)
                        .build());
            }

            int totalSessions = present + absent + late + unmarked;

            // Compute overall percentage
            double pct = 0.0;
            if (batchId != null) {
                try {
                    Double dbPct = participantRepository.getAttendancePercentage(batchId, userId, startDate, endDate);
                    if (dbPct != null) pct = dbPct;
                } catch (Exception e) {
                    log.warn("[AttendanceCollector] Could not fetch attendance %, using count-based: {}", e.getMessage());
                    pct = totalSessions > 0 ? ((present + late) * 100.0 / totalSessions) : 0.0;
                }
            } else {
                pct = totalSessions > 0 ? ((present + late) * 100.0 / totalSessions) : 0.0;
            }

            // Build weekly buckets from sessions
            List<AttendanceSection.WeeklyBucket> weekly = buildWeeklyBuckets(sessions, startDate, endDate);

            return AttendanceSection.builder()
                    .available(true)
                    .overallPercentage(Math.round(pct * 100.0) / 100.0)
                    .present(present)
                    .absent(absent)
                    .late(late)
                    .unmarked(unmarked)
                    .totalSessions(totalSessions)
                    .trend(null)             // set by OverviewBuilder from prior report
                    .changeVsPrevious(null)  // set by OverviewBuilder from prior report
                    .note(null)              // LLM sets this; deterministic collectors leave it null
                    .sessions(sessions)
                    .weekly(weekly)
                    .build();

        } catch (Exception e) {
            log.error("[AttendanceCollector] Failed for userId={}: {}", userId, e.getMessage());
            return AttendanceSection.builder().available(false).build();
        }
    }

    /**
     * Groups sessions by calendar week (Mon–Sun) and computes a per-week attendance %.
     * Weeks that have no sessions are omitted from the output.
     */
    private List<AttendanceSection.WeeklyBucket> buildWeeklyBuckets(
            List<AttendanceSection.SessionAttendanceItem> sessions,
            LocalDate startDate, LocalDate endDate) {

        // Map from week-start-monday → [present+late, total]
        TreeMap<LocalDate, int[]> weekMap = new TreeMap<>();

        for (AttendanceSection.SessionAttendanceItem s : sessions) {
            if (s.getDate() == null) continue;
            try {
                LocalDate sessionDate = LocalDate.parse(s.getDate());
                // Clamp to report window
                if (sessionDate.isBefore(startDate) || sessionDate.isAfter(endDate)) continue;

                LocalDate weekStart = sessionDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                weekMap.computeIfAbsent(weekStart, k -> new int[]{0, 0});
                weekMap.get(weekStart)[1]++; // total
                if ("PRESENT".equalsIgnoreCase(s.getStatus()) || "LATE".equalsIgnoreCase(s.getStatus())) {
                    weekMap.get(weekStart)[0]++; // attended
                }
            } catch (Exception ignored) {
                // malformed date — skip
            }
        }

        List<AttendanceSection.WeeklyBucket> buckets = new ArrayList<>();
        for (Map.Entry<LocalDate, int[]> entry : weekMap.entrySet()) {
            LocalDate weekStart = entry.getKey();
            int[] counts = entry.getValue();
            int total = counts[1];
            if (total == 0) continue;

            double weekPct = Math.round((counts[0] * 100.0 / total) * 10.0) / 10.0;

            // Compute week end (Sun), clamped to endDate
            LocalDate weekEnd = weekStart.plusDays(6);
            if (weekEnd.isAfter(endDate)) weekEnd = endDate;
            if (weekStart.isBefore(startDate)) weekStart = startDate;

            String label = weekStart.format(MONTH_DAY_FMT) + "–" + weekEnd.format(MONTH_DAY_FMT);
            buckets.add(AttendanceSection.WeeklyBucket.builder()
                    .week(label)
                    .percentage(weekPct)
                    .build());
        }
        return buckets;
    }
}
