package vacademy.io.admin_core_service.features.student_analysis.service.aggregation.collectors;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.student_analysis.client.AssessmentServiceClient;
import vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive.AcademicsSection;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Collects academic (assessment) data by calling the assessment_service HMAC endpoint.
 * Computes subject performance rollup and top-level summary fields.
 * Degrades gracefully to an "unavailable" section on any failure.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AcademicsCollector {

    private final AssessmentServiceClient assessmentServiceClient;

    public AcademicsSection collect(String userId, String instituteId, LocalDate startDate, LocalDate endDate) {
        try {
            AssessmentServiceClient.AssessmentHistoryResponse response =
                    assessmentServiceClient.fetchStudentAssessmentHistory(
                            userId, instituteId, startDate.toString(), endDate.toString());

            if (response == null) {
                log.warn("[AcademicsCollector] Assessment service returned null for userId={}", userId);
                return AcademicsSection.builder().available(false).build();
            }

            List<AcademicsSection.AssessmentItem> rawAssessments = response.getAssessments();
            // Enrich each assessment item with derived fields (name/date/grade/status)
            List<AcademicsSection.AssessmentItem> assessments = enrich(rawAssessments);

            Double avgPct = null;
            Double classAvgPct = null;
            String bestSubject = null;
            String weakestSubject = null;
            List<AcademicsSection.SubjectPerformance> subjectPerformance = null;

            if (assessments != null && !assessments.isEmpty()) {
                // Compute overall averages
                OptionalDouble avgOpt = assessments.stream()
                        .filter(a -> a.getPercentage() != null)
                        .mapToDouble(AcademicsSection.AssessmentItem::getPercentage)
                        .average();
                if (avgOpt.isPresent()) {
                    avgPct = Math.round(avgOpt.getAsDouble() * 10.0) / 10.0;
                }

                OptionalDouble classOpt = assessments.stream()
                        .filter(a -> a.getClassAverage() != null && a.getTotalMarks() != null && a.getTotalMarks() > 0)
                        .mapToDouble(a -> a.getClassAverage() / a.getTotalMarks() * 100.0)
                        .average();
                if (classOpt.isPresent()) {
                    classAvgPct = Math.round(classOpt.getAsDouble() * 10.0) / 10.0;
                }

                // Group by subject
                subjectPerformance = buildSubjectPerformance(assessments);

                if (subjectPerformance != null && !subjectPerformance.isEmpty()) {
                    AcademicsSection.SubjectPerformance best = subjectPerformance.stream()
                            .filter(s -> s.getScorePercentage() != null)
                            .max(Comparator.comparingDouble(AcademicsSection.SubjectPerformance::getScorePercentage))
                            .orElse(null);
                    AcademicsSection.SubjectPerformance weakest = subjectPerformance.stream()
                            .filter(s -> s.getScorePercentage() != null)
                            .min(Comparator.comparingDouble(AcademicsSection.SubjectPerformance::getScorePercentage))
                            .orElse(null);
                    if (best != null) bestSubject = best.getSubject();
                    if (weakest != null) weakestSubject = weakest.getSubject();
                }
            }

            return AcademicsSection.builder()
                    .available(true)
                    .averagePercentage(avgPct)
                    .classAveragePercentage(classAvgPct)
                    .bestSubject(bestSubject)
                    .weakestSubject(weakestSubject)
                    .assessments(assessments)
                    .subjectPerformance(subjectPerformance)
                    .build();

        } catch (Exception e) {
            log.error("[AcademicsCollector] Failed for userId={}: {}", userId, e.getMessage());
            return AcademicsSection.builder().available(false).build();
        }
    }

    /**
     * Enrich raw assessment items: copy assessmentName → name, attemptDate → date,
     * compute grade, map resultStatus → status.
     */
    private List<AcademicsSection.AssessmentItem> enrich(List<AcademicsSection.AssessmentItem> raw) {
        if (raw == null) return null;
        return raw.stream().map(a -> AcademicsSection.AssessmentItem.builder()
                .assessmentId(a.getAssessmentId())
                .name(a.getName() != null ? a.getName() : a.getAssessmentId())
                .date(a.getDate())
                .subject(a.getSubject())
                .marks(a.getMarks())
                .totalMarks(a.getTotalMarks())
                .percentage(a.getPercentage())
                .grade(gradeFromPct(a.getPercentage()))
                .rank(a.getRank())
                .percentile(a.getPercentile())
                .classAverage(a.getClassAverage())
                .status(mapStatus(a.getStatus(), a.getPercentage()))
                .attemptId(a.getAttemptId())
                .accuracy(a.getAccuracy())
                .classAccuracy(a.getClassAccuracy())
                .durationSeconds(a.getDurationSeconds())
                .sections(a.getSections())
                .build()
        ).collect(Collectors.toList());
    }

    private List<AcademicsSection.SubjectPerformance> buildSubjectPerformance(
            List<AcademicsSection.AssessmentItem> assessments) {

        // Group by subject (null subject → "Unknown")
        Map<String, List<AcademicsSection.AssessmentItem>> bySubject = assessments.stream()
                .collect(Collectors.groupingBy(
                        a -> a.getSubject() != null ? a.getSubject() : "Unknown"));

        List<AcademicsSection.SubjectPerformance> result = new ArrayList<>();

        for (Map.Entry<String, List<AcademicsSection.AssessmentItem>> entry : bySubject.entrySet()) {
            String subject = entry.getKey();
            List<AcademicsSection.AssessmentItem> items = entry.getValue();

            OptionalDouble scoreOpt = items.stream()
                    .filter(a -> a.getPercentage() != null)
                    .mapToDouble(AcademicsSection.AssessmentItem::getPercentage)
                    .average();
            Double scorePct = scoreOpt.isPresent()
                    ? Math.round(scoreOpt.getAsDouble() * 10.0) / 10.0 : null;

            OptionalDouble classOpt = items.stream()
                    .filter(a -> a.getClassAverage() != null && a.getTotalMarks() != null && a.getTotalMarks() > 0)
                    .mapToDouble(a -> a.getClassAverage() / a.getTotalMarks() * 100.0)
                    .average();
            Double classAvg = classOpt.isPresent()
                    ? Math.round(classOpt.getAsDouble() * 10.0) / 10.0 : null;

            String sentiment = sentimentFromPct(scorePct, classAvg);

            result.add(AcademicsSection.SubjectPerformance.builder()
                    .subject(subject)
                    .scorePercentage(scorePct)
                    .classAverage(classAvg)
                    .trend(null)   // trend requires prior report; left null
                    .sentiment(sentiment)
                    .build());
        }

        // Sort by score descending
        result.sort((a, b) -> {
            if (a.getScorePercentage() == null) return 1;
            if (b.getScorePercentage() == null) return -1;
            return Double.compare(b.getScorePercentage(), a.getScorePercentage());
        });
        return result;
    }

    private String gradeFromPct(Double pct) {
        if (pct == null) return null;
        if (pct >= 90) return "A+";
        if (pct >= 80) return "A";
        if (pct >= 70) return "B+";
        if (pct >= 60) return "B";
        if (pct >= 50) return "C";
        return "D";
    }

    private String mapStatus(String resultStatus, Double pct) {
        if (resultStatus != null) {
            String upper = resultStatus.toUpperCase();
            if (upper.equals("PASS") || upper.equals("PASSED")) return "PASS";
            if (upper.equals("FAIL") || upper.equals("FAILED")) return "FAIL";
            if (upper.contains("WORK") || upper.contains("IMPROVE")) return "NEEDS_WORK";
        }
        // Fallback from percentage
        if (pct == null) return null;
        if (pct >= 50) return "PASS";
        if (pct >= 35) return "NEEDS_WORK";
        return "FAIL";
    }

    private String sentimentFromPct(Double scorePct, Double classAvg) {
        if (scorePct == null) return null;
        if (classAvg != null && scorePct < classAvg - 5) return "attention";
        if (scorePct >= 70) return "good";
        return "neutral";
    }
}
