package vacademy.io.admin_core_service.features.auth_service.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.auth_service.constants.AuthServiceRoutes;
import vacademy.io.common.auth.dto.organization.*;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;

/**
 * HMAC-internal client for the hybrid org-team / user-to-user endpoints in
 * auth_service. Each method maps one-to-one to an endpoint on
 * {@code OrganizationTeamInternalController}.
 */
@Slf4j
@Service
public class OrganizationTeamAuthClient {

    @Autowired
    private InternalClientUtils hmacClientUtils;

    @Value("${auth.server.baseurl}")
    private String authServerBaseUrl;

    @Value("${spring.application.name}")
    private String clientName;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // ── Teams ──────────────────────────────────────────────────────

    public List<OrgTeamDTO> listTeams(String instituteId) {
        String endpoint = AuthServiceRoutes.ORG_TEAM_LIST + "?instituteId=" + instituteId;
        return callList(HttpMethod.GET, endpoint, null, new TypeReference<>() {});
    }

    public OrgTeamDTO getTeam(String teamId) {
        String endpoint = AuthServiceRoutes.ORG_TEAM_BY_ID.replace("{teamId}", teamId);
        return call(HttpMethod.GET, endpoint, null, OrgTeamDTO.class);
    }

    public OrgTeamDTO createTeam(CreateTeamRequest req, String createdBy) {
        String endpoint = AuthServiceRoutes.ORG_TEAM_BASE
                + (createdBy != null ? "?createdBy=" + createdBy : "");
        return call(HttpMethod.POST, endpoint, req, OrgTeamDTO.class);
    }

    public OrgTeamDTO updateTeam(String teamId, UpdateTeamRequest req) {
        String endpoint = AuthServiceRoutes.ORG_TEAM_BY_ID.replace("{teamId}", teamId);
        return call(HttpMethod.PUT, endpoint, req, OrgTeamDTO.class);
    }

    public void deleteTeam(String teamId) {
        String endpoint = AuthServiceRoutes.ORG_TEAM_BY_ID.replace("{teamId}", teamId);
        call(HttpMethod.DELETE, endpoint, null, String.class);
    }

    // ── Members ───────────────────────────────────────────────────

    public List<TeamMemberDTO> listMembers(String teamId) {
        String endpoint = AuthServiceRoutes.ORG_TEAM_MEMBERS.replace("{teamId}", teamId);
        return callList(HttpMethod.GET, endpoint, null, new TypeReference<>() {});
    }

    public TeamMemberDTO addMember(String teamId, AddMemberRequest req, String addedBy) {
        String endpoint = AuthServiceRoutes.ORG_TEAM_MEMBERS.replace("{teamId}", teamId)
                + (addedBy != null ? "?addedBy=" + addedBy : "");
        return call(HttpMethod.POST, endpoint, req, TeamMemberDTO.class);
    }

    public TeamMemberDTO updateMember(String teamId, String mappingId, UpdateMemberRequest req) {
        String endpoint = AuthServiceRoutes.ORG_TEAM_MEMBER_BY_ID
                .replace("{teamId}", teamId)
                .replace("{mappingId}", mappingId);
        // PUT — InternalClientUtils uses HttpURLConnection which can't send PATCH.
        return call(HttpMethod.PUT, endpoint, req, TeamMemberDTO.class);
    }

    public void removeMember(String teamId, String mappingId) {
        String endpoint = AuthServiceRoutes.ORG_TEAM_MEMBER_BY_ID
                .replace("{teamId}", teamId)
                .replace("{mappingId}", mappingId);
        call(HttpMethod.DELETE, endpoint, null, String.class);
    }

    // ── Chart + traversal ─────────────────────────────────────────

    public List<OrgChartNodeDTO> getTeamChart(String teamId) {
        String endpoint = AuthServiceRoutes.ORG_TEAM_CHART.replace("{teamId}", teamId);
        return callList(HttpMethod.GET, endpoint, null, new TypeReference<>() {});
    }

    public List<TeamMemberDTO> getAncestors(String teamId, String mappingId) {
        String endpoint = AuthServiceRoutes.ORG_TEAM_ANCESTORS
                .replace("{teamId}", teamId).replace("{mappingId}", mappingId);
        return callList(HttpMethod.GET, endpoint, null, new TypeReference<>() {});
    }

    public List<TeamMemberDTO> getDescendants(String teamId, String mappingId) {
        String endpoint = AuthServiceRoutes.ORG_TEAM_DESCENDANTS
                .replace("{teamId}", teamId).replace("{mappingId}", mappingId);
        return callList(HttpMethod.GET, endpoint, null, new TypeReference<>() {});
    }

    public List<TeamMemberDTO> getUserMemberships(String userId) {
        String endpoint = AuthServiceRoutes.ORG_TEAM_USER_MEMBERSHIPS.replace("{userId}", userId);
        return callList(HttpMethod.GET, endpoint, null, new TypeReference<>() {});
    }

    // ── Flat-model shims for workbench callers ─────────────────────
    // The workbench was originally written against a sub-team hierarchy.
    // Under the hybrid model teams are flat (no sub-teams) and reporting
    // happens user-to-user inside a team via parent_user_id. These shims
    // give callers the shapes they expect — semantically correct for the
    // new model rather than throwing or pretending sub-teams exist.

    /** Alias kept for workbench callers. Identical to {@link #getUserMemberships}. */
    public List<TeamMemberDTO> mappingsForUser(String userId) {
        return getUserMemberships(userId);
    }

    /**
     * In the flat-team model a team has no sub-teams, so "subtree including
     * self" is just the team itself. Returns a singleton list, or empty when
     * the team has been soft-deleted / does not exist.
     */
    public List<OrgTeamDTO> getSubtreeIncludingSelf(String teamId) {
        try {
            OrgTeamDTO self = getTeam(teamId);
            return self != null ? List.of(self) : Collections.emptyList();
        } catch (Exception e) {
            log.warn("getSubtreeIncludingSelf: team {} not found ({})", teamId, e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * In the flat-team model a team has no parent team, so the team-level
     * ancestor chain is always empty. Kept as an overload so workbench
     * code that asks for "this team's ancestors" compiles and runs
     * harmlessly. Per-user ancestor traversal still uses the
     * {@link #getAncestors(String, String)} variant.
     */
    public List<OrgTeamDTO> getAncestors(String teamId) {
        return Collections.emptyList();
    }

    /**
     * Distinct user ids across the given teams. Walks {@link #listMembers}
     * per team. Cheap enough for workbench scope queries since team counts
     * per institute are small (single digits in practice).
     */
    public List<String> usersInTeams(Collection<String> teamIds) {
        if (teamIds == null || teamIds.isEmpty()) return Collections.emptyList();
        LinkedHashSet<String> out = new LinkedHashSet<>();
        for (String teamId : teamIds) {
            try {
                for (TeamMemberDTO m : listMembers(teamId)) {
                    if (m.getUserId() != null) out.add(m.getUserId());
                }
            } catch (Exception e) {
                log.warn("usersInTeams: skipping team {} ({})", teamId, e.getMessage());
            }
        }
        return new ArrayList<>(out);
    }

    // ────────────────────────────────────────────────────────────────

    private <T> T call(HttpMethod method, String endpoint, Object body, Class<T> responseType) {
        try {
            ResponseEntity<String> response = hmacClientUtils.makeHmacRequest(
                    clientName, method.name(), authServerBaseUrl, endpoint, body);
            if (response.getBody() == null || response.getBody().isBlank()) return null;
            // Void operations on auth_service (delete team, remove member, etc.)
            // return plain-text bodies like "Team deleted" — not JSON. Trying
            // to JSON-parse those throws, which the catch wraps as a 510 and
            // the frontend interprets as failure even though the action
            // succeeded. When the caller asks for a String, hand back the
            // raw body and skip Jackson entirely.
            if (responseType == String.class) {
                return responseType.cast(response.getBody());
            }
            return objectMapper.readValue(response.getBody(), responseType);
        } catch (Exception e) {
            log.warn("auth-service call failed: {} {} → {}", method, endpoint, e.getMessage());
            throw new VacademyException(e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
        }
    }

    private <T> List<T> callList(HttpMethod method, String endpoint, Object body, TypeReference<List<T>> ref) {
        try {
            ResponseEntity<String> response = hmacClientUtils.makeHmacRequest(
                    clientName, method.name(), authServerBaseUrl, endpoint, body);
            if (response.getBody() == null || response.getBody().isBlank()) return Collections.emptyList();
            return objectMapper.readValue(response.getBody(), ref);
        } catch (Exception e) {
            log.warn("auth-service call failed: {} {} → {}", method, endpoint, e.getMessage());
            throw new VacademyException(e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
        }
    }
}
