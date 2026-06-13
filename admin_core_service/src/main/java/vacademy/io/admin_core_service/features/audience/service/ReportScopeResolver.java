package vacademy.io.admin_core_service.features.audience.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.auth_service.service.OrganizationTeamAuthClient;
import vacademy.io.admin_core_service.features.counsellor_workbench.service.CounsellorScopeService;
import vacademy.io.common.auth.dto.organization.OrgTeamDTO;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Shared RBAC scope resolution for every report endpoint under
 * {@code /v1/reports/**} (lead summary, counsellor performance, source
 * performance, calling, dispositions, follow-up aging, funnel velocity).
 *
 * <p>Extracted verbatim from {@code LeadReportService.resolveScopeUserIds}
 * (which now delegates here) so the newer report services can share one
 * implementation instead of three copies drifting apart. Mirrors
 * {@code SalesDashboardService.scopedUsers} with explicit narrowing on top.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReportScopeResolver {

    private final CounsellorScopeService counsellorScopeService;
    private final OrganizationTeamAuthClient orgTeamClient;

    /**
     * RBAC scope for report queries, as the CSV the report SQL binds against
     * {@code (:csv IS NULL OR col = ANY(STRING_TO_ARRAY(:csv, ',')))}.
     *
     * @return CSV of counsellor user_ids; {@code ""} matches nothing (zeroed
     *         report — STRING_TO_ARRAY('', ',') is the empty array); {@code null}
     *         = no scope filter (admin setup mode). Mirrors LeadReportService's
     *         existing resolveScopeUserIds semantics.
     */
    public String resolveScopeUsersCsv(String instituteId, String callerUserId,
                                       String teamId, String counsellorUserId) {
        List<String> scope = resolveScopeUserIds(
                instituteId, callerUserId, trimToNull(teamId), trimToNull(counsellorUserId));
        return scope == null ? null : String.join(",", scope);
    }

    /**
     * Resolve the counsellor-user whitelist a report should aggregate over.
     *
     * Priority:
     *   1. Explicit {@code counsellorUserId} → that single counsellor. When the
     *      caller is themselves inside the leads subtree, the target must sit
     *      inside their RBAC descendants — 403 otherwise.
     *   2. Explicit {@code teamId} → all users across that team's subtree,
     *      intersected with the caller's RBAC scope when the caller is scoped.
     *   3. Caller inside the leads subtree → their RBAC descendants. A leaf
     *      counsellor resolves to just themselves — self-scoped reports are the
     *      chosen product behavior.
     *   4. Admin outside the leads subtree → everyone under the leads root.
     *   5. Leads team not configured → null = institute-wide (admin setup mode).
     *
     * Returns null for "no scope filter". A non-empty list MUST be applied; an
     * EMPTY list means "scoped to nothing" — the report comes back zeroed rather
     * than silently widening back to institute-wide.
     */
    private List<String> resolveScopeUserIds(String instituteId, String callerUserId,
                                             String teamId, String counsellorUserId) {
        boolean callerScoped = counsellorScopeService.isCallerInLeadsSubtree(instituteId, callerUserId);
        List<String> callerScope = callerScoped
                ? counsellorScopeService.descendantUserIdsForCaller(instituteId, callerUserId)
                : Collections.emptyList();

        if (counsellorUserId != null) {
            if (callerScoped && !callerScope.contains(counsellorUserId)) {
                throw new VacademyException(HttpStatus.FORBIDDEN,
                        "You are not allowed to view reports for this counsellor.");
            }
            return List.of(counsellorUserId);
        }

        if (teamId != null) {
            List<String> subtreeTeamIds = orgTeamClient.getSubtreeIncludingSelf(teamId).stream()
                    .map(OrgTeamDTO::getId).collect(Collectors.toList());
            List<String> teamUsers = counsellorScopeService.usersInTeams(subtreeTeamIds);
            if (callerScoped) {
                Set<String> allowed = new HashSet<>(callerScope);
                teamUsers = teamUsers.stream().filter(allowed::contains).collect(Collectors.toList());
            }
            return teamUsers; // possibly empty → zeroed report, never silently unscoped
        }

        if (callerScoped && !callerScope.isEmpty()) {
            return callerScope;
        }

        List<String> leadsTeamIds = counsellorScopeService.allTeamIdsUnderLeadsRoot(instituteId);
        if (leadsTeamIds.isEmpty()) return null; // admin setup mode — no scope filter
        List<String> users = counsellorScopeService.usersInTeams(leadsTeamIds);
        return users.isEmpty() ? null : users;
    }

    private static String trimToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}
