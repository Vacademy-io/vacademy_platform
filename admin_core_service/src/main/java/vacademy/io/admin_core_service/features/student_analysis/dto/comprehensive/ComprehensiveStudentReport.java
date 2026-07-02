package vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Top-level v2 report DTO stored in {@code student_analysis_process.report_json}.
 * Shape matches the canonical sample at docs/samples/student-report-sample.json.
 *
 * <p>Every domain section uses an {@code available} flag so a collector failure yields
 * an "unavailable" section rather than breaking the whole report.
 *
 * <p>Key naming notes:
 * <ul>
 *   <li>{@code studyHabits} → {@code study_habits} via SnakeCaseStrategy</li>
 *   <li>{@code courseProgress} → {@code course_progress} via SnakeCaseStrategy</li>
 *   <li>{@code liveClasses} → {@code live_classes} via SnakeCaseStrategy</li>
 *   <li>{@code doubtsAndEngagement} → {@code doubts_and_engagement} via SnakeCaseStrategy</li>
 *   <li>{@code aiInsights} → {@code ai_insights} via SnakeCaseStrategy</li>
 *   <li>{@code areasToImprove} → {@code areas_to_improve} via SnakeCaseStrategy</li>
 * </ul>
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ComprehensiveStudentReport {

    // ── Header ────────────────────────────────────────────────────────────────
    private MetaSection meta;
    private StudentIdentitySection student;
    private InstituteSection institute;
    private ReportPeriodSection period;

    // ── Overview ──────────────────────────────────────────────────────────────
    private OverviewSection overview;

    /** LLM-generated parent-facing narrative paragraph. Null until narration. */
    private String parentSummary;

    // ── Domain sections ───────────────────────────────────────────────────────
    private AttendanceSection attendance;
    private AcademicsSection academics;

    /** Study habits / activity — serialized as "study_habits". */
    private StudyHabitsSection studyHabits;

    /** Course progress — serialized as "course_progress". */
    private ProgressSection courseProgress;

    /** Live classes — serialized as "live_classes". */
    private LiveClassesSection liveClasses;

    /** Assignments. */
    private AssignmentsSection assignments;

    // ── AI-powered insight lists (top-level) ──────────────────────────────────
    /** LLM-derived strengths — serialized as "strengths". */
    private List<TopicConfidence> strengths;

    /** LLM-derived areas to improve — serialized as "areas_to_improve". */
    private List<TopicConfidence> areasToImprove;

    // ── Achievements ──────────────────────────────────────────────────────────
    /** Certificates + streak badges — serialized as "achievements". */
    private List<AchievementItem> achievements;

    // ── Engagement ────────────────────────────────────────────────────────────
    /** Doubts / engagement — serialized as "doubts_and_engagement". */
    private DoubtsAndEngagementSection doubtsAndEngagement;

    // ── AI narrative ──────────────────────────────────────────────────────────
    /** Layer-2 AI insights — serialized as "ai_insights". Null until narration. */
    private AiInsightsSection aiInsights;

    // ── Footer ────────────────────────────────────────────────────────────────
    /** Static disclaimer notes about data sourcing and trend comparisons. */
    private List<String> dataNotes;

    // ── Internal fields not in serialized output ──────────────────────────────

    /**
     * Which modules were requested/included in this report.
     * Internal only — not in the JSON output.
     */
    @JsonIgnore
    private List<String> includedModules;

    /**
     * Login section — collected but not serialized in the v2 report.
     * Kept as a field so the LoginCollector can still run if needed.
     */
    @JsonIgnore
    private LoginSection login;
}
