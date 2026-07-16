package vacademy.io.admin_core_service.features.counsellor_workbench.repository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.counsellor_workbench.dto.ActivityFeedItemDTO;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

/**
 * Native UNION read across the three existing tables that capture counsellor
 * activity: telephony_call_log, lead_followup, timeline_event. There is no
 * new "counsellor_activity_log" table — these are the canonical sources of
 * truth and the workbench just projects them into a single sorted feed.
 *
 * Implemented with JdbcTemplate (not JpaRepository) because the query mixes
 * SELECTs from tables that have no JPA association; binding parameters by
 * name and projecting straight into a DTO is cleaner here than entity gymnastics.
 */
@Repository
public class WorkbenchActivityRepository {

    private final JdbcTemplate jdbc;

    @Autowired
    public WorkbenchActivityRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Returns the most recent {@code limit} activity rows for a counsellor in
     * the given time window. Rows are ordered by created_at DESC across all
     * three sources.
     */
    public List<ActivityFeedItemDTO> fetchFeed(String counsellorUserId,
                                               String instituteId,
                                               Timestamp from,
                                               Timestamp to,
                                               int limit) {
        // UNION ALL of three sub-queries. Each emits the same column set so the
        // outer ORDER BY + LIMIT can sort across them. Lead identifiers are
        // resolved via user_lead_profile lookups where the source table only
        // carries user_id (call_log) or audience_response_id (lead_followup).
        final String sql =
            "WITH calls AS (" +
            "  SELECT cl.id AS id, " +
            "         'telephony_call_log'::text AS source_table, " +
            "         'CALL'::text AS action_type, " +
            "         ulp.id AS lead_id, " +
            "         cl.status AS title, " +
            "         CASE WHEN cl.duration_seconds IS NULL THEN NULL " +
            "              ELSE 'Call · ' || cl.duration_seconds || 's' END AS description, " +
            "         json_build_object(" +
            "             'status', cl.status, " +
            "             'duration_seconds', cl.duration_seconds, " +
            "             'recording_url', cl.recording_url, " +
            "             'direction', cl.direction" +
            "         )::text AS metadata_json, " +
            "         cl.created_at AS created_at " +
            "  FROM telephony_call_log cl " +
            "  LEFT JOIN user_lead_profile ulp ON ulp.user_id = cl.user_id AND ulp.institute_id = cl.institute_id " +
            "  WHERE cl.counsellor_user_id = ? " +
            "    AND cl.institute_id = ? " +
            "    AND cl.created_at >= ? AND cl.created_at < ? " +
            "), followups AS (" +
            "  SELECT lf.id AS id, " +
            "         'lead_followup'::text AS source_table, " +
            "         CASE WHEN lf.is_closed THEN 'FOLLOWUP_CLOSED' ELSE 'FOLLOWUP_CREATED' END AS action_type, " +
            "         (SELECT ulp.id FROM user_lead_profile ulp " +
            "             JOIN audience_response ar ON ar.user_id = ulp.user_id " +
            "             WHERE ar.id = lf.audience_response_id AND ulp.institute_id = lf.institute_id LIMIT 1) AS lead_id, " +
            "         COALESCE(NULLIF(lf.content, ''), 'Follow-up') AS title, " +
            "         lf.status AS description, " +
            "         json_build_object(" +
            "             'status', lf.status, " +
            "             'is_closed', lf.is_closed, " +
            "             'schedule_time', lf.schedule_time, " +
            "             'closer_reason', lf.closer_reason" +
            "         )::text AS metadata_json, " +
            "         COALESCE(lf.closed_at, lf.created_at) AS created_at " +
            "  FROM lead_followup lf " +
            "  WHERE (lf.created_by = ? OR lf.closed_by = ?) " +
            "    AND lf.institute_id = ? " +
            "    AND COALESCE(lf.closed_at, lf.created_at) >= ? " +
            "    AND COALESCE(lf.closed_at, lf.created_at) < ? " +
            "), timeline AS (" +
            "  SELECT te.id AS id, " +
            "         'timeline_event'::text AS source_table, " +
            // Normalize the stored action_type (the enum NAME, e.g.
            // 'COUNSELOR_ASSIGNED' — assigns and reassigns share the enum) to
            // one of the canonical labels the UI knows. The transfer direction
            // comes from metadata: reassigned_from = feed subject → OUT,
            // counselor_id = feed subject → IN.
            "         CASE " +
            // jsonb ? 'key' is the PG key-exists operator but JDBC eats the
            // '?'. The "->> 'key' IS NOT NULL" form means the same thing and
            // contains no ambiguous '?'. (See sales-dashboard reassignment
            // series for the matching rewrite.)
            "           WHEN te.action_type = 'COUNSELOR_ASSIGNED' AND (te.metadata_json::jsonb ->> 'reassigned_from') IS NOT NULL " +
            "                AND (te.metadata_json::jsonb ->> 'reassigned_from') = ? THEN 'LEAD_TRANSFERRED_OUT' " +
            "           WHEN te.action_type = 'COUNSELOR_ASSIGNED' AND (te.metadata_json::jsonb ->> 'counselor_id') IS NOT NULL " +
            "                AND (te.metadata_json::jsonb ->> 'counselor_id') = ? THEN 'LEAD_TRANSFERRED_IN' " +
            "           WHEN te.action_type ILIKE '%status%' THEN 'STATUS_CHANGED' " +
            "           WHEN te.action_type ILIKE '%note%' THEN 'NOTE_ADDED' " +
            "           ELSE upper(replace(te.action_type, ' ', '_')) END AS action_type, " +
            // lead_id is polymorphic: this CTE deliberately spans every type
            // with an actor_id (USER_LEAD_PROFILE, AUDIENCE_RESPONSE, ENQUIRY,
            // LEAD, STUDENT, ...) to show the counsellor's full activity, so
            // type_id means a different table's PK depending on te.type — do
            // NOT treat lead_id as directly joinable to user_lead_profile
            // without also checking source_table/type first. For
            // USER_LEAD_PROFILE rows specifically it is user_lead_profile.id
            // (not user_id) as of V379 — see UserLeadProfile's uniqueConstraints.
            "         te.type_id AS lead_id, " +
            "         te.title AS title, " +
            "         te.description AS description, " +
            "         te.metadata_json::text AS metadata_json, " +
            "         te.created_at AS created_at " +
            "  FROM timeline_event te " +
            "  WHERE te.actor_id = ? " +
            "    AND te.created_at >= ? AND te.created_at < ? " +
            ") " +
            "SELECT id, source_table, action_type, lead_id, title, description, metadata_json, created_at " +
            "FROM (SELECT * FROM calls UNION ALL SELECT * FROM followups UNION ALL SELECT * FROM timeline) merged " +
            "ORDER BY created_at DESC " +
            "LIMIT ?";

        return jdbc.query(sql, (rs, rowNum) -> ActivityFeedItemDTO.builder()
                .id(rs.getString("id"))
                .sourceTable(rs.getString("source_table"))
                .actionType(rs.getString("action_type"))
                .leadId(rs.getString("lead_id"))
                .title(rs.getString("title"))
                .description(rs.getString("description"))
                .metadataJson(rs.getString("metadata_json"))
                .createdAt(rs.getTimestamp("created_at"))
                .build(),
                // calls: counsellor, institute, from, to
                counsellorUserId, instituteId, from, to,
                // followups: created_by, closed_by, institute, from, to
                counsellorUserId, counsellorUserId, instituteId, from, to,
                // timeline: reassigned_from match counsellor, counselor_id match counsellor, actor_id, from, to
                counsellorUserId, counsellorUserId, counsellorUserId, from, to,
                limit);
    }
}
