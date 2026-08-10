package vacademy.io.assessment_service.features.assessment.service;

import lombok.Builder;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.dto.LeaderBoardDto;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.ParticipantsQuestionOverallDetailDto;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.StudentReportAnswerReviewDto;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.StudentReportOverallDetailDto;
import vacademy.io.assessment_service.features.assessment.enums.QuestionResponseEnum;
import vacademy.io.assessment_service.features.learner_assessment.dto.QuestionClassStatsDto;
import vacademy.io.assessment_service.features.learner_assessment.repository.QuestionWiseMarksRepository;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Class-level analytics for the v2 student report
 * ({@link StudentReportHtmlV2Builder}): score distribution (mean / median /
 * topper), per-question class-correct fractions, "easy misses", "expertise"
 * and the potential-score projection.
 *
 * <p>Everything except the one per-question aggregate query
 * ({@code findQuestionClassStatsForAssessment}) is computed from data the
 * report flow already holds: the cohort leaderboard rows and the student's
 * own answer-review DTOs.
 *
 * <p>Question-level insights are intentionally skipped when the assessment is
 * MANUAL-evaluated (no reliable per-question correctness) or when fewer than
 * {@value #MIN_COHORT_FOR_QUESTION_INSIGHTS} cohort attempts exist (too
 * little signal); the distribution block is still produced with whatever
 * exists.
 */
@Slf4j
@Service
public class StudentReportAnalyticsService {

    /** Below this cohort size, easy-misses / expertise / potential are suppressed. */
    public static final int MIN_COHORT_FOR_QUESTION_INSIGHTS = 3;
    /** A question is an "easy miss" when >= 60% of the class answered it correctly. */
    private static final double EASY_MISS_MIN_CLASS_CORRECT = 0.60;
    /** A question counts as "expertise" when <= 30% of the class answered it correctly. */
    private static final double EXPERTISE_MAX_CLASS_CORRECT = 0.30;
    /** Keep the insight tables compact on the PDF. */
    private static final int MAX_INSIGHT_ROWS = 12;

    @Autowired
    private QuestionWiseMarksRepository questionWiseMarksRepository;

    // ---------------------------------------------------------------- results

    @Getter
    @Builder
    public static class ClassDistribution {
        private final int cohortSize;
        private final Double mean;
        private final Double median;
        private final Double topper;
    }

    @Getter
    @Builder
    public static class QuestionInsightRow {
        private final String questionId;
        /** Question order within its section; nullable when the mapping row is missing. */
        private final Integer questionNumber;
        private final String sectionId;
        private final double classCorrectPercent;
        /** Raw QuestionResponseEnum value (CORRECT / INCORRECT / PARTIAL_CORRECT / PENDING) or null. */
        private final String studentStatus;
    }

    @Getter
    @Builder
    public static class PotentialProjection {
        private final double currentScore;
        private final double potentialScore;
        private final Integer currentRank;
        private final Integer potentialRank;
        private final Double currentPercentile;
        private final Double potentialPercentile;
        private final int skippedQuestionsConsidered;
    }

    @Getter
    @Builder
    public static class StudentReportAnalytics {
        private final ClassDistribution distribution;
        /** false when MANUAL-evaluated or cohort &lt; {@link #MIN_COHORT_FOR_QUESTION_INSIGHTS}. */
        private final boolean questionInsightsAvailable;
        private final List<QuestionInsightRow> easyMisses;
        private final List<QuestionInsightRow> expertise;
        /** null when there is nothing to project (no skipped questions / no expected gain). */
        private final PotentialProjection potential;
    }

    // ------------------------------------------------------------ computation

    /**
     * @param cohortLeaderboard the full cohort rows already fetched by the report
     *                          flow ({@code ReportClassContext.fullLeaderboard})
     * @param totalMarks        assessment total marks — used only to cap the
     *                          potential score; nullable
     * @param autoEvaluated     false for MANUAL (pen-and-paper) assessments
     */
    public StudentReportAnalytics compute(String assessmentId,
                                          String instituteId,
                                          String attemptId,
                                          List<LeaderBoardDto> cohortLeaderboard,
                                          StudentReportOverallDetailDto reportDetail,
                                          Double totalMarks,
                                          boolean autoEvaluated) {
        List<LeaderBoardDto> cohort = cohortLeaderboard != null ? cohortLeaderboard : Collections.emptyList();
        ClassDistribution distribution = buildDistribution(cohort);

        boolean insightsAvailable = autoEvaluated && distribution.getCohortSize() >= MIN_COHORT_FOR_QUESTION_INSIGHTS;
        if (!insightsAvailable) {
            return StudentReportAnalytics.builder()
                    .distribution(distribution)
                    .questionInsightsAvailable(false)
                    .easyMisses(Collections.emptyList())
                    .expertise(Collections.emptyList())
                    .build();
        }

        Map<String, QuestionClassStatsDto> classStatsByQuestion = loadClassStats(assessmentId, instituteId);
        List<ReviewRow> studentRows = flattenStudentRows(reportDetail);

        List<QuestionInsightRow> easyMisses = new ArrayList<>();
        List<QuestionInsightRow> expertise = new ArrayList<>();
        double potentialGain = 0.0;
        int skippedConsidered = 0;

        for (ReviewRow row : studentRows) {
            QuestionClassStatsDto stats = classStatsByQuestion.get(row.questionId());
            double fraction = correctFraction(stats);
            if (stats == null || stats.getTotalCount() == null || stats.getTotalCount() <= 0) {
                continue;
            }
            boolean studentCorrect = QuestionResponseEnum.CORRECT.name().equals(row.status());
            boolean studentSkipped = row.status() == null || QuestionResponseEnum.PENDING.name().equals(row.status());

            if (fraction >= EASY_MISS_MIN_CLASS_CORRECT && !studentCorrect) {
                easyMisses.add(insightRow(row, fraction));
            } else if (fraction <= EXPERTISE_MAX_CLASS_CORRECT && studentCorrect) {
                expertise.add(insightRow(row, fraction));
            }

            if (studentSkipped) {
                double questionMarks = stats.getMaxMarks() != null ? stats.getMaxMarks() : 0.0;
                if (questionMarks > 0 && fraction > 0) {
                    potentialGain += questionMarks * fraction;
                    skippedConsidered++;
                }
            }
        }

        easyMisses.sort(Comparator.comparingDouble(QuestionInsightRow::getClassCorrectPercent).reversed());
        expertise.sort(Comparator.comparingDouble(QuestionInsightRow::getClassCorrectPercent));

        PotentialProjection potential = buildPotential(reportDetail, cohort, attemptId, potentialGain,
                skippedConsidered, totalMarks);

        return StudentReportAnalytics.builder()
                .distribution(distribution)
                .questionInsightsAvailable(true)
                .easyMisses(limit(easyMisses))
                .expertise(limit(expertise))
                .potential(potential)
                .build();
    }

    // --------------------------------------------------------------- privates

    private ClassDistribution buildDistribution(List<LeaderBoardDto> cohort) {
        List<Double> marks = cohort.stream()
                .map(LeaderBoardDto::getAchievedMarks)
                .filter(Objects::nonNull)
                .sorted()
                .toList();
        if (marks.isEmpty()) {
            return ClassDistribution.builder().cohortSize(0).build();
        }
        double mean = marks.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
        int n = marks.size();
        double median = n % 2 == 1 ? marks.get(n / 2) : (marks.get(n / 2 - 1) + marks.get(n / 2)) / 2.0;
        double topper = marks.get(n - 1);
        return ClassDistribution.builder()
                .cohortSize(n)
                .mean(round1(mean))
                .median(round1(median))
                .topper(round1(topper))
                .build();
    }

    private Map<String, QuestionClassStatsDto> loadClassStats(String assessmentId, String instituteId) {
        Map<String, QuestionClassStatsDto> byQuestion = new HashMap<>();
        try {
            for (QuestionClassStatsDto stats : questionWiseMarksRepository
                    .findQuestionClassStatsForAssessment(assessmentId, instituteId)) {
                if (stats != null && stats.getQuestionId() != null) {
                    byQuestion.put(stats.getQuestionId(), stats);
                }
            }
        } catch (Exception e) {
            log.warn("[report-analytics] Failed to load per-question class stats for assessment {}: {}",
                    assessmentId, e.getMessage());
        }
        return byQuestion;
    }

    /** Student's own per-question rows, flattened out of the allSections review map. */
    private List<ReviewRow> flattenStudentRows(StudentReportOverallDetailDto reportDetail) {
        List<ReviewRow> rows = new ArrayList<>();
        if (reportDetail == null || reportDetail.getAllSections() == null) {
            return rows;
        }
        for (Map.Entry<String, List<StudentReportAnswerReviewDto>> entry : reportDetail.getAllSections().entrySet()) {
            String sectionId = entry.getKey();
            if (entry.getValue() == null) continue;
            for (StudentReportAnswerReviewDto review : entry.getValue()) {
                if (review == null || review.getQuestionId() == null) continue;
                rows.add(new ReviewRow(review.getQuestionId(), review.getQuestionOrder(), sectionId,
                        review.getAnswerStatus()));
            }
        }
        return rows;
    }

    private PotentialProjection buildPotential(StudentReportOverallDetailDto reportDetail,
                                               List<LeaderBoardDto> cohort,
                                               String attemptId,
                                               double potentialGain,
                                               int skippedConsidered,
                                               Double totalMarks) {
        if (skippedConsidered == 0 || potentialGain < 0.05) {
            return null;
        }
        ParticipantsQuestionOverallDetailDto detail = reportDetail != null
                ? reportDetail.getQuestionOverallDetailDto() : null;
        double currentScore = detail != null && detail.getAchievedMarks() != null ? detail.getAchievedMarks() : 0.0;
        double potentialScore = currentScore + potentialGain;
        if (totalMarks != null && totalMarks > 0) {
            potentialScore = Math.min(potentialScore, totalMarks);
        }
        if (potentialScore <= currentScore + 0.05) {
            return null;
        }

        // Others' marks (excluding the student's own row) for rank/percentile insertion.
        List<Double> otherMarks = cohort.stream()
                .filter(row -> attemptId == null || !attemptId.equals(row.getAttemptId()))
                .map(LeaderBoardDto::getAchievedMarks)
                .filter(Objects::nonNull)
                .toList();
        int potentialRank = 1 + (int) countAbove(otherMarks, potentialScore);
        double potentialPercentile = otherMarks.isEmpty() ? 100.0
                : (countBelow(otherMarks, potentialScore) * 100.0) / otherMarks.size();

        Integer currentRank = detail != null ? detail.getRank() : null;
        if (currentRank == null) {
            currentRank = 1 + (int) countAbove(otherMarks, currentScore);
        }
        Double currentPercentile = detail != null ? detail.getPercentile() : null;

        // Never project a worse position than today (insertion arithmetic can be
        // coarser than the SQL rank/percentile the report already shows).
        if (potentialRank > currentRank) {
            potentialRank = currentRank;
        }
        if (currentPercentile != null && potentialPercentile < currentPercentile) {
            potentialPercentile = currentPercentile;
        }

        return PotentialProjection.builder()
                .currentScore(round1(currentScore))
                .potentialScore(round1(potentialScore))
                .currentRank(currentRank)
                .potentialRank(potentialRank)
                .currentPercentile(currentPercentile != null ? round1(currentPercentile) : null)
                .potentialPercentile(round1(potentialPercentile))
                .skippedQuestionsConsidered(skippedConsidered)
                .build();
    }

    private static QuestionInsightRow insightRow(ReviewRow row, double fraction) {
        return QuestionInsightRow.builder()
                .questionId(row.questionId())
                .questionNumber(row.questionOrder())
                .sectionId(row.sectionId())
                .classCorrectPercent(round1(fraction * 100.0))
                .studentStatus(row.status())
                .build();
    }

    private static double correctFraction(QuestionClassStatsDto stats) {
        if (stats == null || stats.getTotalCount() == null || stats.getTotalCount() <= 0) {
            return 0.0;
        }
        long correct = stats.getCorrectCount() != null ? stats.getCorrectCount() : 0L;
        return (double) correct / stats.getTotalCount();
    }

    private static long countAbove(List<Double> marks, double score) {
        return marks.stream().filter(m -> m > score).count();
    }

    private static long countBelow(List<Double> marks, double score) {
        return marks.stream().filter(m -> m < score).count();
    }

    private static List<QuestionInsightRow> limit(List<QuestionInsightRow> rows) {
        return rows.size() > MAX_INSIGHT_ROWS ? new ArrayList<>(rows.subList(0, MAX_INSIGHT_ROWS)) : rows;
    }

    private static double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private record ReviewRow(String questionId, Integer questionOrder, String sectionId, String status) {
    }
}
