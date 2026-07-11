package vacademy.io.admin_core_service.features.counsellor_workbench.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.audience.service.AudienceRoleAccessService;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.auth_service.service.OrganizationTeamAuthClient;
import vacademy.io.admin_core_service.features.counsellor_workbench.dto.WorkbenchTeamDTO;
import vacademy.io.common.auth.dto.organization.OrgTeamDTO;
import vacademy.io.common.auth.dto.organization.TeamMemberDTO;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Resolves the caller's RBAC scope for the counsellor / leads features.
 *
 * Model (role-based — replaces the old "configured leads team" model):
 *   • A counsellor is any institute user holding the ACTIVE {@code COUNSELLOR}
 *     role in auth_service. Nothing is configured in LEAD_SETTING anymore;
 *     the old {@code workbench.leads_team_id} JSON key is ignored.
 *   • ADMIN OUTRANKS EVERYTHING (product decision, 2026-07-06): a caller
 *     holding the ADMIN role — even one who ALSO holds COUNSELLOR — sees all
 *     leads, all data, and may assign any counsellor, institute-wide.
 *   • A non-admin COUNSELLOR-role caller is hierarchy-scoped: their scope =
 *     themselves + every counsellor-role user who reports up to them through
 *     {@code parent_user_id} chains in ANY org team they belong to.
 *   • A caller with neither role (teacher, …) is not hierarchy-scoped here;
 *     what they see stays governed by the caller-role checks at each endpoint
 *     and by {@code AudienceRoleAccessService} modes.
 *
 * Membership in unrelated teams (Finance, HR, …) is harmless: descendants are
 * intersected with the counsellor-role set, which replaces the old "only walk
 * teams under the leads root" guard.
 *
 * All team-graph access goes through {@link OrganizationTeamAuthClient} and the
 * role list through {@link AuthService}; this service holds no JPA references
 * because both the team graph and user_role live in auth_service.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CounsellorScopeService {

    /**
     * Both spellings are queried and unioned: the codebase mixes them (role
     * seed + frontend role filters use COUNSELLOR; DB columns and the
     * audience-access mode use COUNSELOR), so an institute's user_role rows
     * could legitimately carry either.
     */
    public static final List<String> COUNSELLOR_ROLE_NAMES = List.of("COUNSELLOR", "COUNSELOR");

    /** Role-list cache TTL. Scope freshness within a couple of minutes matches
     *  the old behavior (team edits weren't instant either) and keeps the
     *  per-request HMAC fan-out off the hot leads/report paths. */
    private static final long ROLE_CACHE_TTL_MS = 2 * 60 * 1000L;

    private final OrganizationTeamAuthClient orgTeamClient;
    private final AuthService authService;
    private final AudienceRoleAccessService roleAccessService;

    private record CachedIds(List<String> userIds, long fetchedAt) {}
    private final Map<String, CachedIds> counsellorCache = new ConcurrentHashMap<>();

    /**
     * All ACTIVE counsellor-role user ids of the institute — the institute-wide
     * roster admins see. Cached per institute; on auth_service failure the last
     * known value is served (stale beats silently flipping everyone's RBAC),
     * and with no cached value we degrade to an empty list (callers then scope
     * to self / render an empty roster rather than erroring the whole page).
     */
    public List<String> allCounsellorUserIds(String instituteId) {
        if (instituteId == null || instituteId.isBlank()) return Collections.emptyList();
        long now = System.currentTimeMillis();
        CachedIds cached = counsellorCache.get(instituteId);
        if (cached != null && now - cached.fetchedAt() < ROLE_CACHE_TTL_MS) {
            return cached.userIds();
        }
        try {
            LinkedHashSet<String> union = new LinkedHashSet<>(
                    authService.getActiveUserIdsByRoles(instituteId, COUNSELLOR_ROLE_NAMES));
            if (union.isEmpty()) {
                // Legit for institutes that haven't granted counsellor roles yet
                // (setup mode), but the most common misconfiguration too — make
                // it findable in the logs when "the picker is empty".
                log.warn("allCounsellorUserIds({}): no ACTIVE user_role rows for {} — "
                        + "counsellor lists will be empty until the role is granted",
                        instituteId, COUNSELLOR_ROLE_NAMES);
            }
            List<String> fresh = List.copyOf(union);
            counsellorCache.put(instituteId, new CachedIds(fresh, now));
            return fresh;
        } catch (Exception e) {
            log.warn("allCounsellorUserIds({}) failed, serving {}: {}", instituteId,
                    cached != null ? "stale cache" : "empty", e.getMessage());
            return cached != null ? cached.userIds() : Collections.emptyList();
        }
    }

    /** Does the caller hold the ADMIN role for this institute? (JWT-resolved.) */
    public boolean hasAdminRole(CustomUserDetails caller, String instituteId) {
        return caller != null
                && roleAccessService.resolvedCallerRoles(caller, instituteId).contains("ADMIN");
    }

    /**
     * Should this caller's data access be narrowed to their hierarchy scope?
     * True when the caller holds the COUNSELLOR role AND does NOT hold the
     * ADMIN role — ADMIN outranks: an admin who also counsels keeps the full
     * institute-wide view everywhere (leads, roster, reports, follow-ups).
     *
     * <p>The admin check reads the CURRENT request's JWT (most call sites
     * only have a user id in hand). Outside a request context it resolves to
     * "not admin", i.e. scoped — the safe direction.
     *
     * <p><b>Prefer {@link #isScopedCaller(String, CustomUserDetails)} whenever
     * the caller's authenticated principal is available.</b> This overload's
     * raw-JWT-only check has no fallback to the already-validated
     * {@code CustomUserDetails} authorities, so it can miss ADMIN for a
     * dual ADMIN+COUNSELLOR account and wrongly scope a real admin down to
     * their counsellor hierarchy (e.g. hiding leads assigned to counsellors
     * outside their reporting chain) — confirmed as the cause of leads being
     * invisible to a dual-role admin while visible to the assigned counsellor.
     */
    public boolean isScopedCaller(String instituteId, String callerUserId) {
        if (callerUserId == null || callerUserId.isBlank()) return false;
        if (!allCounsellorUserIds(instituteId).contains(callerUserId)) return false;
        return !roleAccessService.currentRequestRoles(instituteId).contains("ADMIN");
    }

    /**
     * Same as {@link #isScopedCaller(String, String)}, but resolves roles via
     * {@link AudienceRoleAccessService#resolvedCallerRoles} — which checks the
     * caller's already-authenticated {@code CustomUserDetails} authorities
     * first and only falls back to decoding the JWT — instead of always
     * decoding the JWT. Use this whenever the caller's {@code CustomUserDetails}
     * is in hand (virtually every controller-driven call site).
     */
    public boolean isScopedCaller(String instituteId, CustomUserDetails caller) {
        if (caller == null || caller.getUserId() == null) return false;
        if (!allCounsellorUserIds(instituteId).contains(caller.getUserId())) return false;
        return !roleAccessService.resolvedCallerRoles(caller, instituteId).contains("ADMIN");
    }

    /**
     * The canonical "what data can this caller see" answer: the caller's own
     * user_id plus every counsellor-role user reporting up to them through
     * {@code parent_user_id} chains in any team the caller belongs to. A team
     * head gets the whole team's counsellor downstream; a mid-level manager
     * gets themselves + reports (+ their reports); a leaf counsellor or a
     * caller with no team membership gets only themselves.
     *
     * <p>Every endpoint that filters by counsellor user_id should run requests
     * through here when {@link #isScopedCaller} is true.
     */
    public List<String> scopedCounsellorUserIds(String instituteId, String callerUserId) {
        if (callerUserId == null || callerUserId.isBlank()) return Collections.emptyList();

        Set<String> out = new LinkedHashSet<>();
        out.add(callerUserId);

        Set<String> counsellors = new HashSet<>(allCounsellorUserIds(instituteId));

        List<TeamMemberDTO> callerMappings;
        try {
            callerMappings = orgTeamClient.mappingsForUser(callerUserId);
        } catch (Exception e) {
            log.warn("scopedCounsellorUserIds: mappingsForUser({}) failed: {}",
                    callerUserId, e.getMessage());
            return new ArrayList<>(out);
        }

        for (TeamMemberDTO m : callerMappings) {
            if (m.getTeamId() == null || m.getMappingId() == null) continue;
            try {
                List<TeamMemberDTO> descendants = orgTeamClient.getDescendants(m.getTeamId(), m.getMappingId());
                for (TeamMemberDTO d : descendants) {
                    if (d.getUserId() != null && counsellors.contains(d.getUserId())) {
                        out.add(d.getUserId());
                    }
                }
            } catch (Exception e) {
                log.warn("scopedCounsellorUserIds: getDescendants({}, {}) failed: {}",
                        m.getTeamId(), m.getMappingId(), e.getMessage());
            }
        }
        return new ArrayList<>(out);
    }

    /**
     * The counsellor list a caller may see in rosters / filter dropdowns /
     * assignment pickers: their hierarchy scope when scoped, the institute-wide
     * counsellor-role list otherwise (pure admins and other unscoped roles).
     */
    public List<String> visibleCounsellorUserIds(String instituteId, String callerUserId) {
        return isScopedCaller(instituteId, callerUserId)
                ? scopedCounsellorUserIds(instituteId, callerUserId)
                : allCounsellorUserIds(instituteId);
    }

    /**
     * The counsellors a caller may ASSIGN/REASSIGN leads to. Since ADMIN now
     * outranks the counsellor scoping everywhere ({@link #isScopedCaller}),
     * this coincides with {@link #visibleCounsellorUserIds}: admins get the
     * institute-wide roster, non-admin counsellors their hierarchy scope.
     * Kept as a named entry point so assignment call sites stay explicit —
     * and use the caller's authorities directly when available.
     */
    public List<String> assignableCounsellorUserIds(String instituteId, CustomUserDetails caller) {
        if (caller == null || caller.getUserId() == null) {
            return allCounsellorUserIds(instituteId);
        }
        if (hasAdminRole(caller, instituteId)) {
            return allCounsellorUserIds(instituteId);
        }
        return visibleCounsellorUserIds(instituteId, caller.getUserId());
    }

    /**
     * Distinct user ids across the given teams. Used by report queries that
     * take an explicit teamId filter.
     */
    public List<String> usersInTeams(Collection<String> teamIds) {
        if (teamIds == null || teamIds.isEmpty()) return Collections.emptyList();
        return orgTeamClient.usersInTeams(new ArrayList<>(teamIds));
    }

    /**
     * The caller's team memberships, for header/display purposes only — RBAC
     * never depends on this. Returns an empty list for users without a team
     * (no more "leads team is not configured" error: there is nothing to
     * configure in the role-based model).
     */
    public List<WorkbenchTeamDTO> myTeams(String callerUserId) {
        if (callerUserId == null || callerUserId.isBlank()) return Collections.emptyList();
        List<TeamMemberDTO> mappings;
        try {
            mappings = orgTeamClient.mappingsForUser(callerUserId);
        } catch (Exception e) {
            log.warn("myTeams: mappingsForUser({}) failed: {}", callerUserId, e.getMessage());
            return Collections.emptyList();
        }
        List<WorkbenchTeamDTO> out = new ArrayList<>();
        for (TeamMemberDTO m : mappings) {
            if (m.getTeamId() == null) continue;
            String teamName = null;
            try {
                OrgTeamDTO team = orgTeamClient.getTeam(m.getTeamId());
                if (team != null) teamName = team.getName();
            } catch (Exception e) {
                log.warn("myTeams: getTeam({}) failed: {}", m.getTeamId(), e.getMessage());
            }
            out.add(WorkbenchTeamDTO.builder()
                    .teamId(m.getTeamId())
                    .teamName(teamName)
                    .ancestorNames(Collections.emptyList())
                    .descendantTeamIds(List.of(m.getTeamId()))
                    .build());
        }
        return out;
    }
}
