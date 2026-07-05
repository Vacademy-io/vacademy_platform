package vacademy.io.admin_core_service.features.audience.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import vacademy.io.admin_core_service.features.audience.dto.CounselorPerformanceDTO;
import vacademy.io.admin_core_service.features.audience.dto.reports.TeamRollupReportDTO;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.auth_service.service.OrganizationTeamAuthClient;
import vacademy.io.admin_core_service.features.counsellor_workbench.service.CounsellorScopeService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.organization.OrgTeamDTO;
import vacademy.io.common.auth.dto.organization.TeamMemberDTO;

import java.sql.Types;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Builds the Manager team-rollup report: one aggregate row per reporting team so a manager can
 * compare sub-teams head-to-head, plus an institute/root-wide totals row.
 *
 * <p>Design notes (the org-team model is FLAT — there is no sub-team hierarchy; the reporting line
 * lives INSIDE a team via {@code parent_user_id}). So:
 * <ul>
 *   <li><b>Reporting teams</b> = the requested {@code teamId} alone when provided, else every flat
 *       team in the institute ({@link OrganizationTeamAuthClient#listTeams}). {@code getSubtreeIncludingSelf}
 *       is a singleton in this model, so "members of a team's subtree" reduces to that team's members.</li>
 *   <li><b>RBAC</b>: a non-scoped admin (outside the leads subtree) sees every reporting team. A
 *       scoped caller (inside the leads subtree) only sees teams that contain at least one of their
 *       RBAC descendants, and per-team members are intersected with that descendant set — same spirit
 *       as {@link ReportScopeResolver}. The per-counsellor numbers themselves come from
 *       {@link LeadReportService#getCounselorPerformance}, which re-applies the scope resolver
 *       internally, so the figures are RBAC-correct even before this narrowing.</li>
 *   <li><b>Cross-team counsellors</b>: a counsellor who belongs to more than one reporting team is
 *       counted in EACH of those teams (membership-based). The totals row is therefore computed over
 *       the de-duplicated union of members (via one team-less aggregate), NOT by summing the team rows.</li>
 * </ul>
 *
 * <p>This service is pure read aggregation — it never writes, so it cannot break any business rule.
 * Names + the team head are hydrated via a single {@link AuthService} batch. OPTED_OUT leads are
 * excluded by the underlying aggregate.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ManagerReportService {

    private final LeadReportService leadReportService;
    private final CounsellorScopeService counsellorScopeService;
    private final OrganizationTeamAuthClient orgTeamClient;
    private final AuthService authService;
    private final NamedParameterJdbcTemplate jdbc;

    /**
     * SUM of monthly targets over the given members. monthly_target is a per-(pool, audience,
     * counsellor) CELL — a counsellor's true monthly target is the sum of their per-audience cell
     * targets, so a plain SUM over the member-scoped rows is correct (each row is a distinct cell,
     * not a duplicate). No users join — institute scoping comes from the parent counselor_pool.
     * csv "" → STRING_TO_ARRAY('', ',') = {} → no rows → SUM = NULL → null target. All-null
     * targets also yield SQL NULL.
     */
    private static final String TEAM_TARGET_SQL = """
            SELECT SUM(cpm.monthly_target) AS target
            FROM counselor_pool_member cpm
            JOIN counselor_pool cp ON cp.id = cpm.pool_id
            WHERE cp.institute_id = :instituteId
              AND cpm.counselor_user_id = ANY(STRING_TO_ARRAY(:csv, ','))
            """;

    @Transactional(readOnly = true)
    public TeamRollupReportDTO getTeamRollup(String instituteId, String fromDate, String toDate,
                                             String teamId, String audienceId, String callerUserId) {
        String requestedTeamId = trimToNull(teamId);
        String scopedAudienceId = trimToNull(audienceId);

        // 1. Reporting teams: the requested team alone, else every flat team in the institute.
        List<OrgTeamDTO> reportingTeams = resolveReportingTeams(instituteId, requestedTeamId);

        // 2. RBAC narrowing: a scoped caller (COUNSELLOR role) only sees teams containing ≥1 of
        //    their descendants, and per-team membership is intersected with that descendant set.
        boolean callerScoped = counsellorScopeService.isScopedCaller(instituteId, callerUserId);
        Set<String> callerDescendants = callerScoped
                ? new HashSet<>(counsellorScopeService.scopedCounsellorUserIds(instituteId, callerUserId))
                : Collections.emptySet();

        List<TeamRollupReportDTO.Row> rows = new ArrayList<>();
        Set<String> allMemberIds = new LinkedHashSet<>(); // de-dup union for the totals target
        Set<String> headIds = new LinkedHashSet<>();
        Map<String, String> headIdByTeamId = new HashMap<>(); // team_id → head user_id

        for (OrgTeamDTO team : reportingTeams) {
            String tId = team.getId();
            if (tId == null) continue;

            List<TeamMemberDTO> members = listMembersSafe(tId);
            // In the flat model getSubtreeIncludingSelf(tId) == [team], so the team's own members
            // are the full member set; usersInTeams([tId]) would return the same ids.
            Set<String> memberIds = members.stream()
                    .map(TeamMemberDTO::getUserId)
                    .filter(u -> u != null && !u.isBlank())
                    .collect(Collectors.toCollection(LinkedHashSet::new));

            if (callerScoped) {
                memberIds.retainAll(callerDescendants);
                if (memberIds.isEmpty()) {
                    // No descendants of the caller in this team → not reportable for them.
                    continue;
                }
            }
            allMemberIds.addAll(memberIds);

            // Per-counsellor numbers for this team, reusing the canonical aggregate (8-arg signature:
            // sourceType is null; audienceId scopes to the selected campaign when set). It re-applies
            // ReportScopeResolver(teamId, caller), so the rows already respect RBAC.
            CounselorPerformanceDTO perf = leadReportService.getCounselorPerformance(
                    instituteId, fromDate, toDate, tId, null, scopedAudienceId, null, callerUserId);
            List<CounselorPerformanceDTO.Row> perfRows = perf.getRows() != null
                    ? perf.getRows() : Collections.emptyList();

            String headId = resolveHeadUserId(members);
            if (headId != null) {
                headIds.add(headId);
                headIdByTeamId.put(tId, headId);
            }

            Long target = sumTeamTarget(instituteId, memberIds);

            rows.add(buildTeamRow(tId, team.getName(), perfRows, target));
        }

        // 3. Totals over the de-duplicated union of members — one team-less aggregate so a counsellor
        //    in several teams is not double-counted. RBAC handled inside getCounselorPerformance.
        CounselorPerformanceDTO totalsPerf = leadReportService.getCounselorPerformance(
                instituteId, fromDate, toDate, requestedTeamId, null, scopedAudienceId, null, callerUserId);
        List<CounselorPerformanceDTO.Row> totalsRows = totalsPerf.getRows() != null
                ? totalsPerf.getRows() : Collections.emptyList();
        Long totalsTarget = sumTeamTarget(instituteId, allMemberIds);
        TeamRollupReportDTO.Row totals = buildTeamRow(null, null, totalsRows, totalsTarget);

        // 4. Resolve head names via one auth-service batch and stamp them onto the rows by team_id.
        Map<String, String> headNames = resolveNames(headIds);
        rows.forEach(r -> {
            String headId = headIdByTeamId.get(r.getTeamId());
            if (headId != null) {
                r.setHeadName(headNames.getOrDefault(headId, headId));
            }
        });

        // 5. Sort: conversions desc, then team name asc.
        rows.sort(Comparator
                .comparingLong(TeamRollupReportDTO.Row::getConversions).reversed()
                .thenComparing(r -> Optional.ofNullable(r.getTeamName()).orElse("")));

        return TeamRollupReportDTO.builder().teams(rows).totals(totals).build();
    }

    // ─────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────

    /** Requested team alone, else every flat team in the institute (the reporting root's children). */
    private List<OrgTeamDTO> resolveReportingTeams(String instituteId, String requestedTeamId) {
        if (requestedTeamId != null) {
            // getSubtreeIncludingSelf is the singleton [team] in the flat model; empty when missing.
            return orgTeamClient.getSubtreeIncludingSelf(requestedTeamId);
        }
        try {
            List<OrgTeamDTO> teams = orgTeamClient.listTeams(instituteId);
            return teams != null ? teams : Collections.emptyList();
        } catch (Exception e) {
            log.warn("[ManagerReport] listTeams({}) failed: {}", instituteId, e.getMessage());
            return Collections.emptyList();
        }
    }

    private List<TeamMemberDTO> listMembersSafe(String teamId) {
        try {
            List<TeamMemberDTO> members = orgTeamClient.listMembers(teamId);
            return members != null ? members : Collections.emptyList();
        } catch (Exception e) {
            log.warn("[ManagerReport] listMembers({}) failed: {}", teamId, e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * The flat team's head = the member whose parent_user_id is null (top of the in-team reporting
     * line). When several members have no manager (e.g. multiple seniors), pick the first stable one;
     * null when the team has no members.
     */
    private static String resolveHeadUserId(List<TeamMemberDTO> members) {
        return members.stream()
                .filter(m -> m.getUserId() != null && !m.getUserId().isBlank())
                .filter(m -> m.getParentUserId() == null || m.getParentUserId().isBlank())
                .map(TeamMemberDTO::getUserId)
                .findFirst()
                .orElse(null);
    }

    private TeamRollupReportDTO.Row buildTeamRow(String teamId, String teamName,
                                                 List<CounselorPerformanceDTO.Row> perfRows,
                                                 Long target) {
        long counsellors = perfRows.size();
        long leads = perfRows.stream().mapToLong(CounselorPerformanceDTO.Row::getLeadsAssigned).sum();
        long responded = perfRows.stream().mapToLong(CounselorPerformanceDTO.Row::getLeadsResponded).sum();
        long conversions = perfRows.stream().mapToLong(CounselorPerformanceDTO.Row::getConversions).sum();
        long open = perfRows.stream().mapToLong(CounselorPerformanceDTO.Row::getOpenLeads).sum();
        long overdue = perfRows.stream().mapToLong(CounselorPerformanceDTO.Row::getOverdueLeads).sum();

        double avgResponse = weightedAvgResponse(perfRows);

        return TeamRollupReportDTO.Row.builder()
                .teamId(teamId)
                .teamName(teamName)
                // headName filled later from the auth-service batch; keep head id out of the DTO.
                .counsellors(counsellors)
                .leads(leads)
                .responded(responded)
                .conversions(conversions)
                .conversionRate(percentage(conversions, leads))
                .open(open)
                .overdue(overdue)
                .avgResponseMinutes(Double.isNaN(avgResponse) ? null : avgResponse)
                .target(target)
                .attainmentPct((target == null || target <= 0) ? null
                        : percentage(conversions, target))
                .build();
    }

    /**
     * SUM(monthly_target) over the members' pool cells in this institute; null when no members or
     * every target is null/unset (SUM of all-NULL → SQL NULL → null Long here, so the team target
     * stays null and attainment_pct is suppressed).
     */
    private Long sumTeamTarget(String instituteId, Collection<String> memberIds) {
        if (CollectionUtils.isEmpty(memberIds)) return null;
        String csv = memberIds.stream().filter(s -> s != null && !s.isBlank())
                .collect(Collectors.joining(","));
        if (csv.isBlank()) return null;
        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("instituteId", instituteId)
                .addValue("csv", csv, Types.VARCHAR);
        return jdbc.queryForObject(TEAM_TARGET_SQL, p, Long.class);
    }

    /** One auth-service batch; failures degrade to id-as-name instead of 500ing the report. */
    private Map<String, String> resolveNames(Collection<String> userIds) {
        List<String> ids = userIds.stream()
                .filter(s -> s != null && !s.isBlank())
                .distinct()
                .collect(Collectors.toList());
        if (ids.isEmpty()) return Collections.emptyMap();
        try {
            List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(ids);
            if (CollectionUtils.isEmpty(users)) return Collections.emptyMap();
            return users.stream()
                    .filter(u -> u != null && u.getId() != null)
                    .collect(Collectors.toMap(UserDTO::getId, u ->
                            Optional.ofNullable(u.getFullName()).filter(s -> !s.isBlank()).orElse(u.getId()),
                            (a, b) -> a));
        } catch (Exception ex) {
            log.warn("[ManagerReport] Failed to resolve head names: {}", ex.getMessage());
            return Collections.emptyMap();
        }
    }

    /** Sum(avgResponse * responded) / Sum(responded); NaN when no team member responded. */
    private static double weightedAvgResponse(List<CounselorPerformanceDTO.Row> rows) {
        double num = 0, den = 0;
        for (CounselorPerformanceDTO.Row r : rows) {
            Double v = r.getAvgResponseMinutes();
            long w = r.getLeadsResponded();
            if (v == null || w <= 0) continue;
            num += v * w; den += w;
        }
        return den == 0 ? Double.NaN : (num / den);
    }

    private static String trimToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    /** numerator/denominator * 100, one decimal; null when denominator is 0. */
    private static Double percentage(long num, long denom) {
        if (denom == 0) return null;
        return Math.round((num * 1000.0) / denom) / 10.0;
    }
}
