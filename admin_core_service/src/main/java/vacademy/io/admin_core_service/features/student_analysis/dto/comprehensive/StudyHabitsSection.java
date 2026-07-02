package vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Study habits / learning activity section for the v2 report.
 * Serialized as {@code study_habits} at the top level.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class StudyHabitsSection {

    private boolean available;

    /** Total hours studied (totalTimeMinutes / 60, 1 decimal). */
    private Double totalStudyHours;

    /** Average minutes studied per day over the report window. */
    private Integer avgMinutesPerDay;

    /** Number of days with > 0 minutes of activity. */
    private Integer activeDays;

    /** Total calendar days in the report window. */
    private Integer totalDays;

    /** Longest consecutive active-day streak in the window. */
    private Integer longestStreakDays;

    /** "High" (>=80% active), "Medium" (>=50%), "Low" (<50%). */
    private String consistencyRating;

    /** Most active time-of-day label, e.g. "6–8 PM". Null — hourly data not available. */
    private String mostActiveTime;

    /** Average focus/concentration score (0–100). Null if no concentration data available. */
    private Double focusScore;

    /** Content type engagement counts. */
    private ContentEngagement contentEngagement;

    /** Per-day time-series — renamed from dailyTime. */
    private List<DailyStudyEntry> dailyStudyMinutes;

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class ContentEngagement {
        private Integer videosWatched;
        private Integer documentsRead;
        private Integer quizzesAttempted;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class DailyStudyEntry {
        private String date;
        /** Minutes studied on this day (0 when no activity). */
        private Double minutes;
    }
}
