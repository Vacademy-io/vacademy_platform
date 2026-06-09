package vacademy.io.admin_core_service.features.counsellor_workbench.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.auth_service.service.OrganizationTeamAuthClient;
import vacademy.io.admin_core_service.features.counsellor_workbench.dto.WorkbenchTeamDTO;
import vacademy.io.common.auth.dto.organization.OrgTeamDTO;
import vacademy.io.common.auth.dto.organization.TeamMemberDTO;
import vacademy.io.common.exceptions.VacademyException;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Resolves the caller's "team scope" for the counsellor workbench.
 *
 * Workflow:
 *   1. Read leads_team_id from institute_setting (LEAD_SETTING.workbench).
 *   2. Pull the caller's team mappings from auth_service.
 *   3. Pick the mapping whose team_id sits inside the leads subtree.
 *   4. Resolve that team's subtree via auth_service (one HMAC call) — those
 *      are the teams whose members' leads the caller is allowed to see.
 *
 * All team-graph access goes through {@link OrganizationTeamAuthClient}; this
 * service holds no JPA references because the team graph lives in auth_service.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CounsellorScopeService {

    private final LeadWorkbenchSettingService configService;
    private final OrganizationTeamAuthClient orgTeamClient;

    public WorkbenchTeamDTO resolveHomeScope(String instituteId, String callerUserId) {
        String leadsRootId = configService.getLeadsTeamId(instituteId)
                .orElseThrow(() -> new VacademyException(
                        "Leads team is not configured for this institute. Set it under Settings → Lead Workbench."));

        // Resolve the leads subtree once — used both for the membership filter
        // and to validate that the caller's home team falls inside it.
        List<OrgTeamDTO> leadsSubtree = orgTeamClient.getSubtreeIncludingSelf(leadsRootId);
        Set<String> leadsSubtreeIds = leadsSubtree.stream()
                .map(OrgTeamDTO::getId).collect(Collectors.toSet());

        // The caller's team mappings live in auth_service alongside their roles.
        List<TeamMemberDTO> mappings = orgTeamClient.mappingsForUser(callerUserId);
        String homeTeamId = null;
        String homeTeamName = null;
        for (TeamMemberDTO m : mappings) {
            if (leadsSubtreeIds.contains(m.getTeamId())) {
                homeTeamId = m.getTeamId();
                break;
            }
        }
        if (homeTeamId == null) {
            throw new VacademyException("You are not a member of any team within the leads org subtree.");
        }
        final String resolvedTeamId = homeTeamId;
        for (OrgTeamDTO t : leadsSubtree) {
            if (resolvedTeamId.equals(t.getId())) {
                homeTeamName = t.getName();
                break;
            }
        }

        List<OrgTeamDTO> subtree = orgTeamClient.getSubtreeIncludingSelf(resolvedTeamId);
        List<OrgTeamDTO> ancestors = orgTeamClient.getAncestors(resolvedTeamId);

        return WorkbenchTeamDTO.builder()
                .teamId(resolvedTeamId)
                .teamName(homeTeamName)
                .leadsRootTeamId(leadsRootId)
                .ancestorNames(ancestors.stream().map(OrgTeamDTO::getName).collect(Collectors.toList()))
                .descendantTeamIds(subtree.stream().map(OrgTeamDTO::getId).collect(Collectors.toList()))
                .build();
    }

    /**
     * Distinct user ids across the given teams. Single HMAC POST to
     * auth_service — much cheaper than calling {@link #mappingsForUser} per user.
     */
    public List<String> usersInTeams(Collection<String> teamIds) {
        if (teamIds == null || teamIds.isEmpty()) return Collections.emptyList();
        return orgTeamClient.usersInTeams(new ArrayList<>(teamIds));
    }

    /** All teams under the institute's leads root — used by admin-scope queries. */
    public List<String> allTeamIdsUnderLeadsRoot(String instituteId) {
        return leadsRootSubtree(instituteId).stream()
                .map(OrgTeamDTO::getId).collect(Collectors.toList());
    }

    /**
     * Full DTO subtree under the institute's leads root. Returns empty when
     * the institute has not configured a leads root yet.
     */
    public List<OrgTeamDTO> leadsRootSubtree(String instituteId) {
        String leadsRootId = configService.getLeadsTeamId(instituteId).orElse(null);
        if (leadsRootId == null) return Collections.emptyList();
        return orgTeamClient.getSubtreeIncludingSelf(leadsRootId);
    }

    /**
     * RBAC scope for the workbench / sales dashboard. Returns the caller's
     * user_id plus every user that reports up to them through
     * {@code parent_user_id} chains inside any team under the institute's
     * configured leads root.
     *
     * <p>Concretely: a team head (parent_user_id = null inside the team)
     * gets the whole team's downstream; a mid-level manager gets themselves
     * + direct reports + their reports; a leaf member gets only themselves.
     *
     * <p>This is the canonical "what data can this caller see" answer —
     * every endpoint that filters by counsellor user_id should run requests
     * through here unless the caller has an admin-level permission that
     * widens the scope explicitly. The caller's own user_id is always in
     * the returned set so a leaf counsellor still sees their own data.
     */
    public List<String> descendantUserIdsForCaller(String instituteId, String callerUserId) {
        if (callerUserId == null || callerUserId.isBlank()) return Collections.emptyList();

        Set<String> leadsTeamIds = new HashSet<>(allTeamIdsUnderLeadsRoot(instituteId));
        // Caller might not be in any leads-team yet — that's fine, they still
        // see themselves (and may have leads assigned without team membership).
        Set<String> out = new HashSet<>();
        out.add(callerUserId);

        List<TeamMemberDTO> callerMappings;
        try {
            callerMappings = orgTeamClient.mappingsForUser(callerUserId);
        } catch (Exception e) {
            log.warn("descendantUserIdsForCaller: mappingsForUser({}) failed: {}",
                    callerUserId, e.getMessage());
            return new ArrayList<>(out);
        }

        for (TeamMemberDTO m : callerMappings) {
            if (m.getTeamId() == null || m.getMappingId() == null) continue;
            // Only walk through teams under the configured leads root, so a
            // caller who happens to be in an unrelated team (e.g. Finance)
            // doesn't accidentally see their Finance reports' leads.
            if (!leadsTeamIds.isEmpty() && !leadsTeamIds.contains(m.getTeamId())) continue;
            try {
                List<TeamMemberDTO> descendants = orgTeamClient.getDescendants(m.getTeamId(), m.getMappingId());
                for (TeamMemberDTO d : descendants) {
                    if (d.getUserId() != null) out.add(d.getUserId());
                }
            } catch (Exception e) {
                log.warn("descendantUserIdsForCaller: getDescendants({}, {}) failed: {}",
                        m.getTeamId(), m.getMappingId(), e.getMessage());
            }
        }
        return new ArrayList<>(out);
    }
}
