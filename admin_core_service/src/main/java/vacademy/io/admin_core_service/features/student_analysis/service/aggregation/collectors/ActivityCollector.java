package vacademy.io.admin_core_service.features.student_analysis.service.aggregation.collectors;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ActivityLogRepository;
import vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive.StudyHabitsSection;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * Collects learning-activity metrics and builds a {@link StudyHabitsSection}.
 * Uses READ-ONLY methods on ActivityLogRepository (does NOT write to activity_log).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ActivityCollector {

    private final ActivityLogRepository activityLogRepository;

    public StudyHabitsSection collect(String userId, LocalDate startDate, LocalDate endDate) {
        try {
            // 1. Daily time-spent series (returns [date, minutes] Object[] rows)
            List<Object[]> dailyRaw = activityLogRepository.getTimeSpentByLearnerPerDay(
                    startDate.toString(), endDate.toString(), userId);

            List<StudyHabitsSection.DailyStudyEntry> dailyStudyMinutes = new ArrayList<>();
            double totalMinutes = 0.0;
            int activeDays = 0;

            if (dailyRaw != null) {
                for (Object[] row : dailyRaw) {
                    String date = row[0] != null ? row[0].toString() : null;
                    double mins = row[1] != null ? ((Number) row[1]).doubleValue() : 0.0;
                    // Cap each day at 24h. The query sums many activity_log rows per day and a
                    // single row's (end_time - start_time) can be inflated (e.g. a slide left open
                    // for days), so per-day totals can exceed 24h — physically impossible. Without
                    // this, totals ran to ~1993 "hrs". Per-row is already capped at 1440 min upstream.
                    mins = Math.min(mins, 1440.0);
                    double rounded = Math.round(mins * 100.0) / 100.0;
                    dailyStudyMinutes.add(StudyHabitsSection.DailyStudyEntry.builder()
                            .date(date)
                            .minutes(rounded)
                            .build());
                    totalMinutes += mins;
                    if (mins > 0) activeDays++;
                }
            }

            // Clamp to >= 1. An inverted window makes DAYS.between() negative, which would emit a
            // negative totalDays and divide avgMinutesPerDay by it. The controller now rejects such
            // windows, but this collector must not depend on that to stay arithmetically sane.
            int totalDays = Math.max(1, (int) ChronoUnit.DAYS.between(startDate, endDate) + 1);

            double totalStudyHours = Math.round((totalMinutes / 60.0) * 10.0) / 10.0;

            int avgMinutesPerDay = totalDays > 0
                    ? (int) Math.round(totalMinutes / totalDays)
                    : 0;

            int longestStreak = computeLongestStreak(dailyStudyMinutes);

            String consistencyRating = computeConsistency(activeDays, totalDays);

            // Content engagement: query source_type counts from activity_log
            StudyHabitsSection.ContentEngagement contentEngagement = fetchContentEngagement(
                    userId, startDate, endDate);

            // Focus score = average concentration (0-100) over the window; null when no samples.
            Double focusScore = null;
            try {
                Double conc = activityLogRepository.getAvgConcentrationScore(
                        userId, startDate.toString(), endDate.toString());
                if (conc != null) focusScore = Math.round(conc * 10.0) / 10.0;
            } catch (Exception e) {
                log.warn("[ActivityCollector] Focus score query failed for userId={}: {}", userId, e.getMessage());
            }

            // The daily series is built from generate_series, so it has one row per day even when the
            // learner has no activity_log rows at all — an isEmpty() check can never fire. Decide
            // availability from whether ANY signal actually carries data: without this, a learner
            // with no tracked activity is reported as a measured "0 hrs, Low consistency" learner
            // rather than as "no data".
            boolean anySignal = totalMinutes > 0
                    || focusScore != null
                    || hasAnyCount(contentEngagement);
            if (!anySignal) {
                log.info("[ActivityCollector] No activity signal for userId={} in [{} .. {}] "
                        + "— reporting as unavailable rather than zeroes.", userId, startDate, endDate);
                return StudyHabitsSection.builder().available(false).build();
            }

            return StudyHabitsSection.builder()
                    .available(true)
                    .totalStudyHours(totalStudyHours)
                    .avgMinutesPerDay(avgMinutesPerDay)
                    .activeDays(activeDays)
                    .totalDays(totalDays)
                    .longestStreakDays(longestStreak)
                    .consistencyRating(consistencyRating)
                    .mostActiveTime(null)       // hourly breakdown not available without N+1 query
                    .focusScore(focusScore)
                    .contentEngagement(contentEngagement)
                    .dailyStudyMinutes(dailyStudyMinutes)
                    .build();

        } catch (Exception e) {
            log.error("[ActivityCollector] Failed for userId={}: {}", userId, e.getMessage());
            return StudyHabitsSection.builder().available(false).build();
        }
    }

    /** True when the engagement block carries at least one non-null, non-zero count. */
    private boolean hasAnyCount(StudyHabitsSection.ContentEngagement ce) {
        if (ce == null) return false;
        return (ce.getVideosWatched() != null && ce.getVideosWatched() > 0)
                || (ce.getDocumentsRead() != null && ce.getDocumentsRead() > 0)
                || (ce.getQuizzesAttempted() != null && ce.getQuizzesAttempted() > 0);
    }

    private int computeLongestStreak(List<StudyHabitsSection.DailyStudyEntry> daily) {
        int longest = 0, current = 0;
        for (StudyHabitsSection.DailyStudyEntry e : daily) {
            if (e.getMinutes() != null && e.getMinutes() > 0) {
                current++;
                if (current > longest) longest = current;
            } else {
                current = 0;
            }
        }
        return longest;
    }

    private String computeConsistency(int activeDays, int totalDays) {
        if (totalDays == 0) return "Low";
        double ratio = (double) activeDays / totalDays;
        if (ratio >= 0.8) return "High";
        if (ratio >= 0.5) return "Medium";
        return "Low";
    }

    /**
     * Fetches content engagement counts (VIDEO, DOCUMENT, QUIZ) using a read-only
     * source_type count query on activity_log.
     * Returns null values when the query is unavailable.
     */
    private StudyHabitsSection.ContentEngagement fetchContentEngagement(
            String userId, LocalDate startDate, LocalDate endDate) {
        try {
            java.sql.Timestamp startTs = java.sql.Timestamp.valueOf(startDate.atStartOfDay());
            java.sql.Timestamp endTs = java.sql.Timestamp.valueOf(endDate.atTime(23, 59, 59));

            List<Object[]> counts = activityLogRepository
                    .getContentTypeCountsForUser(userId, startTs, endTs);

            if (counts == null || counts.isEmpty()) {
                return StudyHabitsSection.ContentEngagement.builder().build(); // all nulls
            }

            // Map every source_type the platform actually writes (SlideTypeEnum + the lowercase
            // "llm_assessment"). The old switch handled only VIDEO / DOCUMENT / QUIZ / "PDF" — and
            // "PDF" is not a value anything writes — so HTML_VIDEO, AUDIO, SCORM, QUESTION,
            // VIDEO_QUESTION, ASSIGNMENT and ASSESSMENT counts were silently discarded. An institute
            // serving its videos as HTML_VIDEO reported "no videos watched" despite hundreds of rows.
            Integer videos = null, documents = null, quizzes = null;
            for (Object[] row : counts) {
                String type = row[0] != null ? row[0].toString().toUpperCase() : "";
                int count = row[1] != null ? ((Number) row[1]).intValue() : 0;
                switch (type) {
                    case "VIDEO", "HTML_VIDEO", "VIDEO_QUESTION", "AUDIO" ->
                            videos = (videos == null ? 0 : videos) + count;
                    case "DOCUMENT", "PDF", "SCORM" ->
                            documents = (documents == null ? 0 : documents) + count;
                    case "QUIZ", "QUESTION", "ASSESSMENT", "LLM_ASSESSMENT" ->
                            quizzes = (quizzes == null ? 0 : quizzes) + count;
                    default -> log.debug("[ActivityCollector] Unmapped activity source_type '{}' ({} rows)", type, count);
                }
            }
            return StudyHabitsSection.ContentEngagement.builder()
                    .videosWatched(videos)
                    .documentsRead(documents)
                    .quizzesAttempted(quizzes)
                    .build();
        } catch (Exception e) {
            log.warn("[ActivityCollector] Content engagement query failed: {}", e.getMessage());
            return StudyHabitsSection.ContentEngagement.builder().build(); // all nulls
        }
    }
}
