package vacademy.io.admin_core_service.features.counsellor_workbench.repository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.counsellor_workbench.dto.WorkbenchLeadDTO;

import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Reads user_lead_profile + the latest audience_response per lead so the
 * workbench's lead list shows status, campaign, and source in one query.
 *
 * Uses JdbcTemplate because the campaign join is conditional and the result
 * is purely a read DTO — fewer moving parts than a JPA projection.
 */
@Repository
public class WorkbenchLeadRepository {

    private final JdbcTemplate jdbc;

    @Autowired
    public WorkbenchLeadRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Leads assigned to any user in counsellorIds, within the institute,
     * optionally filtered by conversion_status.
     *
     * Returns the list ordered by assigned_at DESC (most recently assigned
     * first). The workbench is paginated client-side from this list — keep
     * a sane upper bound on the caller's page size.
     */
    public List<WorkbenchLeadDTO> findLeadsForCounsellors(String instituteId,
                                                          Collection<String> counsellorIds,
                                                          String conversionStatus,
                                                          int offset,
                                                          int limit) {
        if (counsellorIds == null || counsellorIds.isEmpty()) return Collections.emptyList();
        String placeholders = counsellorIds.stream().map(c -> "?").collect(Collectors.joining(","));

        // assigned_at is derived from timeline_event — see compute service.
        // Same LATERAL pattern keeps the resolution rule consistent across
        // every reader.
        //
        // NOTE: admin_core_service and auth_service own SEPARATE Postgres
        // databases on stage/prod — admin_core CANNOT see the `users` table
        // via SQL. Lead name / email / phone are hydrated by the caller
        // through AuthService.getUsersFromAuthServiceByUserIds, batched once
        // per response. Same fix is applied to every workbench query.
        //
        // type_id for USER_LEAD_PROFILE timeline events is user_lead_profile
        // .user_id (TimelineEventService writes the enum NAME as action_type
        // — 'COUNSELOR_ASSIGNED' — and callers pass user_id as typeId). The
        // earlier join on `te.type_id = ulp.id` matched nothing, so
        // assigned_at was always NULL.
        final String sql =
            "SELECT ulp.id AS lead_id, " +
            "       ulp.user_id AS user_id, " +
            "       ulp.conversion_status AS conversion_status, " +
            "       ls.label AS lead_status_label, " +
            "       ulp.lead_tier AS lead_tier, " +
            "       ulp.best_score AS best_score, " +
            "       ulp.assigned_counselor_id AS assigned_counselor_id, " +
            "       ulp.assigned_counselor_name AS assigned_counselor_name, " +
            "       ta.assigned_at AS assigned_at, " +
            "       ulp.last_activity_at AS last_activity_at, " +
            "       latest_ar.campaign_name AS campaign_name, " +
            "       latest_ar.source_type AS source_type " +
            "FROM user_lead_profile ulp " +
            "LEFT JOIN lead_status ls ON ls.id = (" +
            "    SELECT ar2.lead_status_id FROM audience_response ar2 " +
            "    WHERE ar2.user_id = ulp.user_id AND ar2.lead_status_id IS NOT NULL " +
            "    ORDER BY ar2.created_at DESC LIMIT 1) " +
            "LEFT JOIN LATERAL ( " +
            "    SELECT MAX(te.created_at) AS assigned_at " +
            "    FROM timeline_event te " +
            "    WHERE te.type = 'USER_LEAD_PROFILE' " +
            "      AND te.type_id = ulp.user_id " +
            "      AND te.action_type = 'COUNSELOR_ASSIGNED' " +
            ") ta ON true " +
            "LEFT JOIN LATERAL (" +
            "    SELECT a.campaign_name AS campaign_name, ar.source_type AS source_type " +
            "    FROM audience_response ar JOIN audience a ON a.id = ar.audience_id " +
            "    WHERE ar.user_id = ulp.user_id " +
            "    ORDER BY ar.created_at DESC LIMIT 1" +
            ") latest_ar ON true " +
            "WHERE ulp.institute_id = ? " +
            "  AND ulp.assigned_counselor_id IN (" + placeholders + ") " +
            (conversionStatus != null ? "  AND ulp.conversion_status = ? " : "") +
            "ORDER BY ta.assigned_at DESC NULLS LAST " +
            "OFFSET ? LIMIT ?";

        Object[] args = buildArgs(instituteId, counsellorIds, conversionStatus, offset, limit);

        return jdbc.query(sql, (rs, rowNum) -> WorkbenchLeadDTO.builder()
                .leadId(rs.getString("lead_id"))
                .userId(rs.getString("user_id"))
                // Name/email/phone hydrated by caller via AuthService.
                .conversionStatus(rs.getString("conversion_status"))
                .leadStatusLabel(rs.getString("lead_status_label"))
                .leadTier(rs.getString("lead_tier"))
                .bestScore((Integer) rs.getObject("best_score"))
                .assignedCounselorId(rs.getString("assigned_counselor_id"))
                .assignedCounselorName(rs.getString("assigned_counselor_name"))
                .assignedAt(rs.getTimestamp("assigned_at"))
                .lastActivityAt(rs.getTimestamp("last_activity_at"))
                .campaignName(rs.getString("campaign_name"))
                .sourceType(rs.getString("source_type"))
                .build(), args);
    }

    public long countLeadsForCounsellors(String instituteId,
                                         Collection<String> counsellorIds,
                                         String conversionStatus) {
        if (counsellorIds == null || counsellorIds.isEmpty()) return 0L;
        String placeholders = counsellorIds.stream().map(c -> "?").collect(Collectors.joining(","));
        String sql = "SELECT COUNT(*) FROM user_lead_profile ulp " +
                     "WHERE ulp.institute_id = ? " +
                     "  AND ulp.assigned_counselor_id IN (" + placeholders + ") " +
                     (conversionStatus != null ? "  AND ulp.conversion_status = ? " : "");
        Object[] args = buildCountArgs(instituteId, counsellorIds, conversionStatus);
        Long n = jdbc.queryForObject(sql, Long.class, args);
        return n != null ? n : 0L;
    }

    public long countOpenLeadsForCounsellor(String instituteId, String counsellorUserId) {
        // "Open" = anything not converted. user_lead_profile.conversion_status
        // is NULL for the bulk of leads (only flipped when something happens),
        // so the earlier `= 'LEAD'` filter matched almost nothing and the
        // card count + reassign-on-inactive flow silently saw zero leads.
        // Mirrors the canonical predicate used in AudienceResponseRepository.
        Long n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM user_lead_profile ulp " +
                        "WHERE ulp.institute_id = ? " +
                        "  AND ulp.assigned_counselor_id = ? " +
                        "  AND (ulp.conversion_status IS NULL OR ulp.conversion_status != 'CONVERTED')",
                Long.class, instituteId, counsellorUserId);
        return n != null ? n : 0L;
    }

    /**
     * Open leads for a single counsellor — paginated. Same "open" predicate
     * as {@link #countOpenLeadsForCounsellor}. Used by the reassign-on-
     * inactive flow so the workbench can pre-populate the dialog.
     */
    public List<WorkbenchLeadDTO> findOpenLeadsForCounsellor(String instituteId,
                                                             String counsellorUserId,
                                                             int offset,
                                                             int limit) {
        // Same separate-DB constraint as findLeadsForCounsellors — no JOIN
        // to users. Caller hydrates lead name / email / phone via AuthService.
        // type_id on USER_LEAD_PROFILE timeline events is user_id, and
        // action_type stores the enum NAME ('COUNSELOR_ASSIGNED'), not the
        // human title.
        final String sql =
            "SELECT ulp.id AS lead_id, " +
            "       ulp.user_id AS user_id, " +
            "       ulp.conversion_status AS conversion_status, " +
            "       ls.label AS lead_status_label, " +
            "       ulp.lead_tier AS lead_tier, " +
            "       ulp.best_score AS best_score, " +
            "       ulp.assigned_counselor_id AS assigned_counselor_id, " +
            "       ulp.assigned_counselor_name AS assigned_counselor_name, " +
            "       ta.assigned_at AS assigned_at, " +
            "       ulp.last_activity_at AS last_activity_at, " +
            "       NULL::text AS campaign_name, " +
            "       NULL::text AS source_type " +
            "FROM user_lead_profile ulp " +
            "LEFT JOIN lead_status ls ON ls.id = (" +
            "    SELECT ar2.lead_status_id FROM audience_response ar2 " +
            "    WHERE ar2.user_id = ulp.user_id AND ar2.lead_status_id IS NOT NULL " +
            "    ORDER BY ar2.created_at DESC LIMIT 1) " +
            "LEFT JOIN LATERAL ( " +
            "    SELECT MAX(te.created_at) AS assigned_at " +
            "    FROM timeline_event te " +
            "    WHERE te.type = 'USER_LEAD_PROFILE' " +
            "      AND te.type_id = ulp.user_id " +
            "      AND te.action_type = 'COUNSELOR_ASSIGNED' " +
            ") ta ON true " +
            "WHERE ulp.institute_id = ? " +
            "  AND ulp.assigned_counselor_id = ? " +
            "  AND (ulp.conversion_status IS NULL OR ulp.conversion_status != 'CONVERTED') " +
            "ORDER BY ta.assigned_at DESC NULLS LAST " +
            "OFFSET ? LIMIT ?";

        return jdbc.query(sql, (rs, rowNum) -> WorkbenchLeadDTO.builder()
                .leadId(rs.getString("lead_id"))
                .userId(rs.getString("user_id"))
                // Name/email/phone hydrated by caller via AuthService.
                .conversionStatus(rs.getString("conversion_status"))
                .leadStatusLabel(rs.getString("lead_status_label"))
                .leadTier(rs.getString("lead_tier"))
                .bestScore((Integer) rs.getObject("best_score"))
                .assignedCounselorId(rs.getString("assigned_counselor_id"))
                .assignedCounselorName(rs.getString("assigned_counselor_name"))
                .assignedAt(rs.getTimestamp("assigned_at"))
                .lastActivityAt(rs.getTimestamp("last_activity_at"))
                .campaignName(rs.getString("campaign_name"))
                .sourceType(rs.getString("source_type"))
                .build(),
                instituteId, counsellorUserId, offset, limit);
    }

    private Object[] buildArgs(String instituteId,
                               Collection<String> counsellorIds,
                               String conversionStatus,
                               int offset,
                               int limit) {
        int extraTail = (conversionStatus != null ? 3 : 2); // status?, offset, limit
        Object[] args = new Object[1 + counsellorIds.size() + extraTail];
        int i = 0;
        args[i++] = instituteId;
        for (String c : counsellorIds) args[i++] = c;
        if (conversionStatus != null) args[i++] = conversionStatus;
        args[i++] = offset;
        args[i] = limit;
        return args;
    }

    private Object[] buildCountArgs(String instituteId,
                                    Collection<String> counsellorIds,
                                    String conversionStatus) {
        int extraTail = (conversionStatus != null ? 1 : 0);
        Object[] args = new Object[1 + counsellorIds.size() + extraTail];
        int i = 0;
        args[i++] = instituteId;
        for (String c : counsellorIds) args[i++] = c;
        if (conversionStatus != null) args[i] = conversionStatus;
        return args;
    }
}
