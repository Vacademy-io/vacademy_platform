package vacademy.io.assessment_service.features.learner_assessment.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.StudentAttemptHistoryProjection;
import vacademy.io.assessment_service.features.assessment.repository.StudentAttemptRepository;
import vacademy.io.assessment_service.features.learner_assessment.dto.SectionComparisonDto;
import vacademy.io.assessment_service.features.learner_assessment.dto.StudentComparisonDto;
import vacademy.io.assessment_service.features.learner_assessment.dto.internal.AssessmentHistoryItemDto;
import vacademy.io.assessment_service.features.learner_assessment.dto.internal.AssessmentHistorySummaryDto;
import vacademy.io.assessment_service.features.learner_assessment.dto.internal.AssessmentSectionSummaryDto;
import vacademy.io.assessment_service.features.learner_assessment.dto.internal.StudentAssessmentHistoryResponse;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;

/**
 * Backing service for the internal student-analysis endpoint.
 *
 * <p><b>Isolation contract (§13.4 of the design doc):</b>
 * <ul>
 *   <li>Read-only — no writes anywhere.
 *   <li>Reuses existing {@link StudentAttemptRepository} queries and
 *       {@link LearnerReportService#buildComparisonData} — no duplicated query logic.
 *   <li>Comparison is capped at {@link #MAX_ASSESSMENTS_PER_REPORT} (default 25) to bound
 *       per-request work.  A truncation warning is logged so operators can tune the cap.
 *   <li>Per-assessment comparison failures are isolated: a single failure marks that entry
 *       with null comparison fields but never aborts the whole request.
 * </ul>
 */
@Slf4j
@Service
public class StudentAnalysisInternalService {

    /**
     * Maximum number of assessments that will have full comparison data computed.
     * The most recent N attempts are processed; older ones are silently omitted.
     * Configurable via a constant here; could be externalised to application properties.
     */
    static final int MAX_ASSESSMENTS_PER_REPORT = 25;

    @Autowired
    private StudentAttemptRepository studentAttemptRepository;

    /**
     * Self-injection to benefit from Spring's @Cacheable proxy on
     * {@link LearnerReportService#buildComparisonData}.
     */
    @Autowired
    @Lazy
    private LearnerReportService learnerReportService;

    /**
     * Assembles a student's assessment history with per-attempt comparison data.
     *
     * @param userId      learner's UUID
     * @param instituteId institute's UUID
     * @param startDate   inclusive lower bound (null = no lower bound)
     * @param endDate     inclusive upper bound (null = no upper bound)
     * @return fully populated response
     */
    public StudentAssessmentHistoryResponse fetchAssessmentHistory(
            String userId, String instituteId, Date startDate, Date endDate) {

        // Fetch at most MAX+1 rows so we can detect truncation without fetching everything
        List<StudentAttemptHistoryProjection> rows = studentAttemptRepository
                .findAssessmentHistoryForUserInDateRange(
                        userId, instituteId, startDate, endDate,
                        PageRequest.of(0, MAX_ASSESSMENTS_PER_REPORT + 1));

        boolean truncated = rows.size() > MAX_ASSESSMENTS_PER_REPORT;
        if (truncated) {
            log.warn("student-analysis: assessment history for userId={} instituteId={} " +
                     "exceeded cap of {}; truncating to most recent {}.",
                     userId, instituteId, MAX_ASSESSMENTS_PER_REPORT, MAX_ASSESSMENTS_PER_REPORT);
            rows = rows.subList(0, MAX_ASSESSMENTS_PER_REPORT);
        }

        List<AssessmentHistoryItemDto> items = new ArrayList<>(rows.size());

        for (StudentAttemptHistoryProjection row : rows) {
            AssessmentHistoryItemDto item = buildHistoryItem(row, userId, instituteId);
            items.add(item);
        }

        AssessmentHistorySummaryDto summary = buildSummary(items);

        return StudentAssessmentHistoryResponse.builder()
                .userId(userId)
                .instituteId(instituteId)
                .assessments(items)
                .summary(summary)
                .build();
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private AssessmentHistoryItemDto buildHistoryItem(
            StudentAttemptHistoryProjection row,
            String userId,
            String instituteId) {

        AssessmentHistoryItemDto.AssessmentHistoryItemDtoBuilder builder =
                AssessmentHistoryItemDto.builder()
                        .assessmentId(row.getAssessmentId())
                        .assessmentName(row.getAssessmentName())
                        .attemptId(row.getAttemptId())
                        .attemptDate(row.getAttemptDate())
                        .marks(row.getTotalMarks())
                        .durationSeconds(row.getDurationInSeconds())
                        .resultStatus(row.getResultStatus())
                        .sections(Collections.emptyList());

        // Attempt to enrich with comparison data; never let a failure abort the whole request.
        try {
            StudentComparisonDto comparison = learnerReportService
                    .buildComparisonData(userId, row.getAssessmentId(), row.getAttemptId(), instituteId);

            if (comparison != null) {
                Double totalMarks = comparison.getTotalMarks();
                Double earnedMarks = row.getTotalMarks();
                double percentage = (totalMarks != null && totalMarks > 0 && earnedMarks != null)
                        ? Math.round((earnedMarks / totalMarks) * 1000.0) / 10.0
                        : 0.0;

                builder.totalMarks(totalMarks)
                        .percentage(percentage)
                        .rank(comparison.getStudentRank())
                        .percentile(comparison.getStudentPercentile())
                        .accuracy(comparison.getStudentAccuracy())
                        .classAverageMarks(comparison.getAverageMarks())
                        .classAccuracy(comparison.getClassAccuracy())
                        .sections(mapSections(comparison.getSectionWiseComparison()));
            }
        } catch (Exception ex) {
            log.warn("student-analysis: failed to build comparison for " +
                     "assessmentId={} attemptId={} userId={}: {}",
                     row.getAssessmentId(), row.getAttemptId(), userId, ex.getMessage());
        }

        return builder.build();
    }

    private List<AssessmentSectionSummaryDto> mapSections(List<SectionComparisonDto> sectionComparisons) {
        if (sectionComparisons == null || sectionComparisons.isEmpty()) {
            return Collections.emptyList();
        }
        List<AssessmentSectionSummaryDto> result = new ArrayList<>(sectionComparisons.size());
        for (SectionComparisonDto s : sectionComparisons) {
            result.add(AssessmentSectionSummaryDto.builder()
                    .sectionId(s.getSectionId())
                    .sectionName(s.getSectionName())
                    .studentMarks(s.getStudentMarks())
                    .sectionTotalMarks(s.getSectionTotalMarks())
                    .sectionAverageMarks(s.getSectionAverageMarks())
                    .studentAccuracy(s.getStudentAccuracy())
                    .classAccuracy(s.getClassAccuracy())
                    .build());
        }
        return result;
    }

    private AssessmentHistorySummaryDto buildSummary(List<AssessmentHistoryItemDto> items) {
        if (items == null || items.isEmpty()) {
            return AssessmentHistorySummaryDto.builder()
                    .totalAssessments(0)
                    .averagePercentage(0.0)
                    .build();
        }

        double totalPct = 0.0;
        double bestPct = Double.NEGATIVE_INFINITY;
        double worstPct = Double.POSITIVE_INFINITY;
        String bestId = null;
        String weakestId = null;

        for (AssessmentHistoryItemDto item : items) {
            double pct = item.getPercentage() != null ? item.getPercentage() : 0.0;
            totalPct += pct;
            if (pct > bestPct) {
                bestPct = pct;
                // BUG-17: store the name (rendered in UI), not the id
                bestId = item.getAssessmentName();
            }
            if (pct < worstPct) {
                worstPct = pct;
                // BUG-17: store the name (rendered in UI), not the id
                weakestId = item.getAssessmentName();
            }
        }

        double avg = Math.round((totalPct / items.size()) * 10.0) / 10.0;

        return AssessmentHistorySummaryDto.builder()
                .totalAssessments(items.size())
                .averagePercentage(avg)
                .bestAssessment(bestId)
                .weakestAssessment(weakestId)
                .build();
    }
}
