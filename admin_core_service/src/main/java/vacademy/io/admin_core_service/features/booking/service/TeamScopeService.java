package vacademy.io.admin_core_service.features.booking.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.audience.service.AudienceRoleAccessService;
import vacademy.io.admin_core_service.features.auth_service.service.OrganizationTeamAuthClient;
import vacademy.io.common.auth.dto.organization.TeamMemberDTO;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Role-AGNOSTIC org-team scope for the Meetings feature: who reports up to the
 * caller through {@code parent_user_id} chains in any team they belong to.
 *
 * <p>Unlike {@link vacademy.io.admin_core_service.features.counsellor_workbench.service.CounsellorScopeService},
 * descendants are NOT intersected with the counsellor-role set — Team Meetings
 * shows the schedules of ALL direct/indirect reports regardless of their role
 * (sales, teachers, support, ...). Admins keep the institute-wide view at the
 * endpoint layer; this service only answers the hierarchy question.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TeamScopeService {

    private final OrganizationTeamAuthClient orgTeamClient;
    private final AudienceRoleAccessService roleAccessService;

    /** Does the caller hold the ADMIN role for this institute? */
    public boolean hasAdminRole(CustomUserDetails caller, String instituteId) {
        return caller != null
                && roleAccessService.resolvedCallerRoles(caller, instituteId).contains("ADMIN");
    }

    /**
     * Caller's own user id plus every user reporting up to them (any role) in
     * any org team they belong to. A caller with no team membership, or a leaf
     * member, gets only themselves. Failures degrade to self-only — the safe
     * direction (a manager temporarily sees less, never more).
     */
    public List<String> scopedTeamUserIds(String callerUserId) {
        Set<String> out = new LinkedHashSet<>();
        if (callerUserId == null || callerUserId.isBlank()) return new ArrayList<>(out);
        out.add(callerUserId);

        List<TeamMemberDTO> callerMappings;
        try {
            callerMappings = orgTeamClient.mappingsForUser(callerUserId);
        } catch (Exception e) {
            log.warn("scopedTeamUserIds: mappingsForUser({}) failed: {}", callerUserId, e.getMessage());
            return new ArrayList<>(out);
        }

        for (TeamMemberDTO m : callerMappings) {
            if (m.getTeamId() == null || m.getMappingId() == null) continue;
            try {
                List<TeamMemberDTO> descendants = orgTeamClient.getDescendants(m.getTeamId(), m.getMappingId());
                for (TeamMemberDTO d : descendants) {
                    if (d.getUserId() != null) {
                        out.add(d.getUserId());
                    }
                }
            } catch (Exception e) {
                log.warn("scopedTeamUserIds: getDescendants({}, {}) failed: {}",
                        m.getTeamId(), m.getMappingId(), e.getMessage());
            }
        }
        return new ArrayList<>(out);
    }

    /** True when the caller manages at least one other person (shows the Team tab). */
    public boolean isTeamManager(String callerUserId) {
        return scopedTeamUserIds(callerUserId).size() > 1;
    }
}
