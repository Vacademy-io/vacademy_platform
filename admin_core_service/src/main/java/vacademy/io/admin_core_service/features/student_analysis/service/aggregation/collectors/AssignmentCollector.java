package vacademy.io.admin_core_service.features.student_analysis.service.aggregation.collectors;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.learner_tracking.dto.AssignmentSlideActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.entity.ActivityLog;
import vacademy.io.admin_core_service.features.learner_tracking.entity.AssignmentSlideTracked;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ActivityLogRepository;
import vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive.AssignmentsSection;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Collects assignment submission data by querying activity_log (READ-ONLY).
 * Computes: submitted, late, onTime, avgScorePercentage.
 * assigned and pending are null (no query for total available assignments exists).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AssignmentCollector {

    private final ActivityLogRepository activityLogRepository;

    public AssignmentsSection collect(String userId, LocalDate startDate, LocalDate endDate) {
        try {
            java.sql.Timestamp startTs = java.sql.Timestamp.valueOf(startDate.atStartOfDay());
            java.sql.Timestamp endTs = java.sql.Timestamp.valueOf(endDate.atTime(23, 59, 59));

            List<ActivityLog> activityLogs = activityLogRepository
                    .findAssignmentActivityLogsForUserInRange(userId, startTs, endTs);

            int submitted = 0, graded = 0, late = 0;
            List<AssignmentsSection.AssignmentItem> items = new ArrayList<>();

            for (ActivityLog actLog : activityLogs) {
                List<AssignmentSlideTracked> tracked = actLog.getAssignmentSlideTracked();
                if (tracked == null || tracked.isEmpty()) continue;

                for (AssignmentSlideTracked ast : tracked) {
                    AssignmentSlideActivityLogDTO dto = ast.toAssignmentSlideActivityLog();
                    submitted++;
                    boolean isLate = Boolean.TRUE.equals(dto.getLateSubmission());
                    if (isLate) late++;
                    boolean isGraded = dto.getMarks() != null
                            || dto.getFeedback() != null
                            || dto.getCheckedFileId() != null;
                    if (isGraded) graded++;

                    items.add(AssignmentsSection.AssignmentItem.builder()
                            .slideId(actLog.getSlideId())
                            .title(actLog.getSlideId())
                            .marks(dto.getMarks())
                            .late(isLate)
                            .feedback(dto.getFeedback())
                            .reviewStatus(isGraded ? "REVIEWED" : "PENDING")
                            .build());
                }
            }

            int onTime = submitted - late;
            // avgScorePercentage: null — AssignmentSlideActivityLogDTO does not expose totalMarks,
            // so a percentage cannot be computed here without an additional slide query.
            Double avgScorePct = null;

            return AssignmentsSection.builder()
                    .available(true)
                    .assigned(null)       // total available assignments not queryable without separate query
                    .submitted(submitted)
                    .onTime(onTime)
                    .late(late)
                    .pending(null)        // null because assigned is null
                    .avgScorePercentage(avgScorePct)
                    .graded(graded)
                    .items(items)
                    .build();

        } catch (Exception e) {
            log.error("[AssignmentCollector] Failed for userId={}: {}", userId, e.getMessage());
            return AssignmentsSection.builder().available(false).build();
        }
    }
}
