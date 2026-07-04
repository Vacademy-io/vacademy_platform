package vacademy.io.admin_core_service.features.student_analysis.service.aggregation.collectors;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.live_session.dto.ScheduleAttendanceProjection;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionParticipantRepository;
import vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive.LiveClassesSection;

import java.time.LocalDate;
import java.util.List;

/**
 * Collects live-class attendance summary (attended/missed counts, total, attendance %).
 *
 * <p>Participation detail (questionsAsked, pollsAnswered, avgEngagement) is set to null
 * because ScheduleAttendanceProjection does not expose per-user engagement counts.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LiveClassCollector {

    private final LiveSessionParticipantRepository participantRepository;

    public LiveClassesSection collect(String userId, String batchId, LocalDate startDate, LocalDate endDate) {
        try {
            List<ScheduleAttendanceProjection> userRecords =
                    participantRepository.findAttendanceForUser(userId, batchId, startDate, endDate);

            int attended = 0, missed = 0, unmarked = 0;

            for (ScheduleAttendanceProjection r : userRecords) {
                String status = r.getAttendanceStatus();
                if ("PRESENT".equalsIgnoreCase(status)) attended++;
                else if ("ABSENT".equalsIgnoreCase(status)) missed++;
                else unmarked++;
            }

            int total = attended + missed + unmarked;

            // Fold "not marked" into "missed". Attendance is auto-recorded as PRESENT when a learner
            // joins; ABSENT is only ever set by a manual admin action that rarely happens. So a session
            // with no PRESENT record means the learner did not attend (= missed), not a data gap. Without
            // this, "Missed" was always 0 while the real absences sat under "Not marked", making the card
            // read as if the learner missed nothing.
            missed = missed + unmarked;
            unmarked = 0;
            double attendancePct = total > 0
                    ? Math.round((attended * 100.0 / total) * 10.0) / 10.0
                    : 0.0;

            return LiveClassesSection.builder()
                    .available(true)
                    .attended(attended)
                    .missed(missed)
                    .unmarked(unmarked)
                    .total(total)
                    .attendancePercentage(attendancePct)
                    // participation: no engagement data in ScheduleAttendanceProjection
                    .participation(null)
                    .build();

        } catch (Exception e) {
            log.error("[LiveClassCollector] Failed for userId={}: {}", userId, e.getMessage());
            return LiveClassesSection.builder().available(false).build();
        }
    }
}
