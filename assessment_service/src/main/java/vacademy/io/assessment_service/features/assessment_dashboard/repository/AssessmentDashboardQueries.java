package vacademy.io.assessment_service.features.assessment_dashboard.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import vacademy.io.assessment_service.features.assessment_dashboard.service.AssessmentDashboardAssembler.AttemptRow;
import vacademy.io.assessment_service.features.assessment_dashboard.service.AssessmentDashboardAssembler.TestInfo;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Read-only queries behind the Assessment Dashboard: three small reads per period, all
 * aggregation happens in {@code AssessmentDashboardAssembler}.
 *
 * <p><b>Two kinds of timestamp.</b> {@code assessment.bound_start_time / bound_end_time}
 * are {@code timestamp without time zone} holding UTC wall-clock (the list page compares
 * them with {@code CURRENT_TIMESTAMP AT TIME ZONE 'UTC'}), so they are bound as UTC
 * {@link LocalDateTime}. {@code student_attempt.start_time / submit_time} are
 * {@code timestamptz} and are bound as {@link OffsetDateTime}. A {@code java.sql.Timestamp}
 * would be rendered in the JVM zone and shift the first kind whenever the pod is not UTC.
 *
 * <p><b>Anytime tests.</b> Mocks and practice tests are published with a closing time in
 * year 9999. Those are in a range only when they were published in it or had an attempt
 * started in it; otherwise every mock ever published would sit in every range.
 */
@Repository
public class AssessmentDashboardQueries {

    /** A closing time at or after this marks an anytime test. */
    public static final LocalDateTime OPEN_ENDED_FROM = LocalDateTime.of(9000, 1, 1, 0, 0);

    private final NamedParameterJdbcTemplate jdbc;

    public AssessmentDashboardQueries(JdbcTemplate jdbcTemplate) {
        this.jdbc = new NamedParameterJdbcTemplate(jdbcTemplate);
    }

    private static final String TESTS_SQL = """
            SELECT DISTINCT ON (a.id)
                   a.id, a.name, a.play_mode, a.evaluation_type, a.assessment_visibility,
                   a.bound_start_time, a.bound_end_time, a.duration, aim.subject_id,
                   (SELECT SUM(s.total_marks) FROM section s
                     WHERE s.assessment_id = a.id AND COALESCE(s.status, '') <> 'DELETED') AS max_marks
            FROM assessment a
            JOIN assessment_institute_mapping aim ON aim.assessment_id = a.id
            WHERE aim.institute_id = :instituteId
              AND a.status = 'PUBLISHED'
              AND a.bound_start_time IS NOT NULL
              AND a.bound_end_time IS NOT NULL
              AND (
                    (a.bound_end_time < :openEndedFrom
                     AND a.bound_start_time < :rangeEnd AND a.bound_end_time >= :rangeStart)
                 OR (:includeLiveNow AND a.bound_end_time < :openEndedFrom
                     AND a.bound_start_time <= :now AND a.bound_end_time >= :now)
                 OR (a.bound_end_time >= :openEndedFrom
                     AND ((a.bound_start_time >= :rangeStart AND a.bound_start_time < :rangeEnd)
                          OR EXISTS (SELECT 1
                                     FROM assessment_user_registration r
                                     JOIN student_attempt sa ON sa.registration_id = r.id
                                     WHERE r.assessment_id = a.id
                                       AND r.institute_id = :instituteId
                                       AND sa.start_time >= :rangeStartTz
                                       AND sa.start_time < :rangeEndTz)))
              )
            ORDER BY a.id
            LIMIT :limit
            """;

    /**
     * Published tests of the institute that overlap {@code [rangeStart, rangeEnd)}, plus,
     * when asked, scheduled tests whose window is open at {@code now} whatever the range.
     */
    public List<TestInfo> findTests(String instituteId, Instant rangeStart, Instant rangeEnd,
                                    Instant now, boolean includeLiveNow, int limit) {
        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("instituteId", instituteId)
                .addValue("openEndedFrom", OPEN_ENDED_FROM)
                .addValue("rangeStart", utc(rangeStart))
                .addValue("rangeEnd", utc(rangeEnd))
                .addValue("rangeStartTz", rangeStart.atOffset(ZoneOffset.UTC))
                .addValue("rangeEndTz", rangeEnd.atOffset(ZoneOffset.UTC))
                .addValue("now", utc(now))
                .addValue("includeLiveNow", includeLiveNow)
                .addValue("limit", limit);
        return jdbc.query(TESTS_SQL, p, (rs, i) -> new TestInfo(
                rs.getString("id"),
                rs.getString("name"),
                rs.getString("play_mode"),
                rs.getString("evaluation_type"),
                rs.getString("assessment_visibility"),
                utcInstant(rs, "bound_start_time"),
                openEndedOrInstant(rs, "bound_end_time"),
                (Integer) rs.getObject("duration"),
                rs.getString("subject_id"),
                rs.getObject("max_marks") == null ? null : rs.getDouble("max_marks")));
    }

    private static final String BATCHES_SQL = """
            SELECT abr.assessment_id, abr.batch_id
            FROM assessment_batch_registration abr
            WHERE abr.assessment_id IN (:ids)
              AND abr.institute_id = :instituteId
              AND abr.status = 'ACTIVE'
            """;

    /** Assigned batches per test — same scoping as the Pending tab's batch lookup. */
    public Map<String, List<String>> findBatchesByTest(String instituteId, Collection<String> testIds) {
        Map<String, List<String>> out = new HashMap<>();
        if (testIds.isEmpty()) {
            return out;
        }
        jdbc.query(BATCHES_SQL,
                new MapSqlParameterSource().addValue("ids", testIds).addValue("instituteId", instituteId),
                rs -> {
                    List<String> list = out.computeIfAbsent(rs.getString("assessment_id"), k -> new ArrayList<>());
                    String batchId = rs.getString("batch_id");
                    if (batchId != null && !list.contains(batchId)) {
                        list.add(batchId);
                    }
                });
        return out;
    }

    private static final String ATTEMPTS_SQL = """
            SELECT aur.assessment_id, aur.user_id, aur.source, aur.source_id,
                   aur.participant_name, aur.user_email, aur.phone_number,
                   sa.id AS attempt_id, sa.status, sa.result_status, sa.report_release_status,
                   sa.total_marks, sa.start_time, sa.submit_time, sa.total_time_in_seconds
            FROM assessment_user_registration aur
            LEFT JOIN student_attempt sa ON sa.registration_id = aur.id
            WHERE aur.assessment_id IN (:ids)
              AND aur.institute_id = :instituteId
              AND COALESCE(aur.status, 'ACTIVE') <> 'DELETED'
            """;

    /** Every registration of the tests, with its attempts (one row per attempt, or one bare row). */
    public List<AttemptRow> findRegistrationsAndAttempts(String instituteId, Collection<String> testIds) {
        if (testIds.isEmpty()) {
            return List.of();
        }
        return jdbc.query(ATTEMPTS_SQL,
                new MapSqlParameterSource().addValue("ids", testIds).addValue("instituteId", instituteId),
                (rs, i) -> new AttemptRow(
                        rs.getString("assessment_id"),
                        rs.getString("user_id"),
                        rs.getString("source"),
                        rs.getString("source_id"),
                        rs.getString("participant_name"),
                        rs.getString("user_email"),
                        rs.getString("phone_number"),
                        rs.getString("attempt_id"),
                        rs.getString("status"),
                        rs.getString("result_status"),
                        rs.getString("report_release_status"),
                        rs.getObject("total_marks") == null ? null : rs.getDouble("total_marks"),
                        tzInstant(rs, "start_time"),
                        tzInstant(rs, "submit_time"),
                        rs.getObject("total_time_in_seconds") == null ? null : rs.getLong("total_time_in_seconds")));
    }

    private static LocalDateTime utc(Instant instant) {
        return LocalDateTime.ofInstant(instant, ZoneOffset.UTC);
    }

    /** A {@code timestamp without time zone} column read as UTC wall-clock. */
    private static Instant utcInstant(ResultSet rs, String column) throws SQLException {
        LocalDateTime value = rs.getObject(column, LocalDateTime.class);
        return value == null ? null : value.toInstant(ZoneOffset.UTC);
    }

    /** Anytime tests (closing in year 9000+) come back with no end at all. */
    private static Instant openEndedOrInstant(ResultSet rs, String column) throws SQLException {
        LocalDateTime value = rs.getObject(column, LocalDateTime.class);
        if (value == null || !value.isBefore(OPEN_ENDED_FROM)) {
            return null;
        }
        return value.toInstant(ZoneOffset.UTC);
    }

    private static Instant tzInstant(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }
}
