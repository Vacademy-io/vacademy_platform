package vacademy.io.assessment_service.features.assessment.dashboard;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.AssessmentCountResponse;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentRepository;

/**
 * Builds the Overview tab payload. Each block is its own query and its own
 * try/catch: a slow or failing aggregate must degrade to zeros for that block,
 * not blank the whole tab.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AssessmentDashboardService {

    /** IN (...) needs a non-empty list even when it is ignored; no id looks like this. */
    private static final List<String> NO_BATCH = List.of("-");
    private static final int RECENT_LIMIT = 12;

    private final AssessmentDashboardRepository dashboardRepository;
    private final AssessmentRepository assessmentRepository;

    public AssessmentDashboardDto overview(String instituteId, List<String> batchIds) {
        boolean all = batchIds == null || batchIds.isEmpty();
        List<String> ids = all ? NO_BATCH : batchIds;

        AssessmentDashboardDto.Counts counts = AssessmentDashboardDto.Counts.builder().build();
        try {
            AssessmentCountResponse c = assessmentRepository.getAssessmentAllTypeCount(instituteId);
            if (c != null) {
                counts = AssessmentDashboardDto.Counts.builder()
                        .live(n(c.getLiveCount())).upcoming(n(c.getUpcomingCount()))
                        .previous(n(c.getPreviousCount())).draft(n(c.getDraftCount())).build();
            }
        } catch (Exception e) {
            log.warn("[assessment-dashboard] counts failed for {}: {}", instituteId, e.getMessage());
        }

        AssessmentDashboardDto.Participation participation = AssessmentDashboardDto.Participation.builder().build();
        try {
            AssessmentDashboardRepository.ParticipationRow r = dashboardRepository.participation(instituteId, all, ids);
            if (r != null) {
                participation = AssessmentDashboardDto.Participation.builder()
                        .registeredLearners(n(r.getRegisteredLearners())).attemptedLearners(n(r.getAttemptedLearners()))
                        .attemptsTotal(n(r.getAttemptsTotal())).attemptsLast7Days(n(r.getAttemptsLast7Days()))
                        .liveAttempts(n(r.getLiveAttempts())).build();
            }
        } catch (Exception e) {
            log.warn("[assessment-dashboard] participation failed for {}: {}", instituteId, e.getMessage());
        }

        AssessmentDashboardDto.Pending pending = AssessmentDashboardDto.Pending.builder().build();
        try {
            AssessmentDashboardRepository.PendingRow r = dashboardRepository.pending(instituteId, all, ids);
            if (r != null) {
                pending = AssessmentDashboardDto.Pending.builder()
                        .manualEvaluationPending(n(r.getManualEvaluationPending())).aiChecksRunning(n(r.getAiChecksRunning()))
                        .aiChecksFailed(n(r.getAiChecksFailed())).resultsToRelease(n(r.getResultsToRelease()))
                        .reattemptRequestsPending(n(r.getReattemptRequestsPending())).build();
            }
        } catch (Exception e) {
            log.warn("[assessment-dashboard] pending failed for {}: {}", instituteId, e.getMessage());
        }

        List<AssessmentDashboardDto.BatchPerformance> batches = new ArrayList<>();
        try {
            for (AssessmentDashboardRepository.BatchRow b : dashboardRepository.batchPerformance(instituteId, all, ids)) {
                batches.add(AssessmentDashboardDto.BatchPerformance.builder()
                        .batchId(b.getBatchId()).assessments(n(b.getAssessments())).learners(n(b.getLearners()))
                        .attempts(n(b.getAttempts())).avgPercent(round1(b.getAvgPercent()))
                        .bestPercent(round1(b.getBestPercent())).lowestPercent(round1(b.getLowestPercent())).build());
            }
        } catch (Exception e) {
            log.warn("[assessment-dashboard] batch performance failed for {}: {}", instituteId, e.getMessage());
        }

        List<AssessmentDashboardDto.AssessmentPerformance> recent = new ArrayList<>();
        try {
            for (AssessmentDashboardRepository.AssessmentRow a : dashboardRepository.recentAssessments(instituteId, all, ids, RECENT_LIMIT)) {
                recent.add(AssessmentDashboardDto.AssessmentPerformance.builder()
                        .assessmentId(a.getAssessmentId()).name(a.getName()).playMode(a.getPlayMode()).visibility(a.getVisibility())
                        .evaluationType(a.getEvaluationType()).startTime(a.getStartTime()).endTime(a.getEndTime())
                        .participants(n(a.getParticipants())).attempted(n(a.getAttempted()))
                        .avgPercent(round1(a.getAvgPercent())).pendingEvaluation(n(a.getPendingEvaluation()))
                        .toRelease(n(a.getToRelease())).build());
            }
        } catch (Exception e) {
            log.warn("[assessment-dashboard] recent assessments failed for {}: {}", instituteId, e.getMessage());
        }

        return AssessmentDashboardDto.builder()
                .counts(counts).participation(participation).pending(pending)
                .batches(batches).assessments(recent).generatedAt(new Date())
                .build();
    }

    private static long n(Number v) {
        return v == null ? 0L : v.longValue();
    }

    private static Double round1(Double v) {
        return v == null ? null : Math.round(v * 10.0) / 10.0;
    }
}
