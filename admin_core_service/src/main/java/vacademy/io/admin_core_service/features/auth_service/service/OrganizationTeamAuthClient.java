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

import java.util.Collections;
import java.util.List;

/**
 * Thin HMAC-internal client for the organization-team endpoints in auth_service.
 *
 * Each method maps one-to-one to an endpoint on
 * {@code OrganizationTeamInternalController}. Path templates from
 * {@link AuthServiceRoutes} get filled in with the path-variables here; the
 * actual signing + request execution lives in {@link InternalClientUtils}
 * (same machinery the rest of {@link AuthService} already uses).
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

    // ────────────────────────────────────────────────────────────────
    // Team CRUD
    // ────────────────────────────────────────────────────────────────

    public OrgTeamDTO createTeam(CreateTeamRequest req, String createdBy) {
        String endpoint = AuthServiceRoutes.ORG_TEAM_BASE
                + (createdBy != null ? "?createdBy=" + createdBy : "");
        return call(HttpMethod.POST, endpoint, req, OrgTeamDTO.class);
    }

    public OrgTeamDTO updateTeam(String teamId, UpdateTeamRequest req) {
        String endpoint = AuthServiceRoutes.ORG_TEAM_BY_ID.replace("{teamId}", teamId);
        return call(HttpMethod.PUT, endpoint, req, OrgTeamDTO.class);
    }

    public void deleteTeam(String teamId, boolean cascade) {
        String endpoint = AuthServiceRoutes.ORG_TEAM_BY_ID.replace("{teamId}", teamId)
                + "?cascade=" + cascade;
        call(HttpMethod.DELETE, endpoint, null, String.class);
    }

    // ────────────────────────────────────────────────────────────────
    // Reads
    // ────────────────────────────────────────────────────────────────

    public List<OrgTeamNodeDTO> getChart(String instituteId) {
        String endpoint = AuthServiceRoutes.ORG_TEAM_CHART + "?instituteId=" + instituteId;
        return callList(HttpMethod.GET, endpoint, null, new TypeReference<>() {});
    }

    public List<OrgTeamNodeDTO> getChartWithMembers(String instituteId) {
        String endpoint = AuthServiceRoutes.ORG_TEAM_CHART_WITH_MEMBERS + "?instituteId=" + instituteId;
        return callList(HttpMethod.GET, endpoint, null, new TypeReference<>() {});
    }

    public List<OrgTeamDTO> getAncestors(String teamId) {
        String endpoint = AuthServiceRoutes.ORG_TEAM_ANCESTORS.replace("{teamId}", teamId);
        return callList(HttpMethod.GET, endpoint, null, new TypeReference<>() {});
    }

    public List<OrgTeamDTO> getDescendants(String teamId) {
        String endpoint = AuthServiceRoutes.ORG_TEAM_DESCENDANTS.replace("{teamId}", teamId);
        return callList(HttpMethod.GET, endpoint, null, new TypeReference<>() {});
    }

    public List<OrgTeamDTO> getSubtreeIncludingSelf(String teamId) {
        String endpoint = AuthServiceRoutes.ORG_TEAM_SUBTREE.replace("{teamId}", teamId);
        return callList(HttpMethod.GET, endpoint, null, new TypeReference<>() {});
    }

    // ────────────────────────────────────────────────────────────────
    // Membership
    // ────────────────────────────────────────────────────────────────

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
        return call(HttpMethod.PATCH, endpoint, req, TeamMemberDTO.class);
    }

    public void removeMember(String teamId, String mappingId) {
        String endpoint = AuthServiceRoutes.ORG_TEAM_MEMBER_BY_ID
                .replace("{teamId}", teamId)
                .replace("{mappingId}", mappingId);
        call(HttpMethod.DELETE, endpoint, null, String.class);
    }

    // ────────────────────────────────────────────────────────────────
    // Cross-service helpers used by the workbench scope resolver
    // ────────────────────────────────────────────────────────────────

    public List<String> usersInTeams(List<String> teamIds) {
        if (teamIds == null || teamIds.isEmpty()) return Collections.emptyList();
        return callList(HttpMethod.POST, AuthServiceRoutes.ORG_TEAM_USERS_IN_TEAMS, teamIds,
                new TypeReference<>() {});
    }

    public List<TeamMemberDTO> mappingsForUser(String userId) {
        String endpoint = AuthServiceRoutes.ORG_TEAM_MAPPINGS_FOR_USER.replace("{userId}", userId);
        return callList(HttpMethod.GET, endpoint, null, new TypeReference<>() {});
    }

    // ────────────────────────────────────────────────────────────────
    // Plumbing
    // ────────────────────────────────────────────────────────────────

    private <T> T call(HttpMethod method, String endpoint, Object body, Class<T> responseType) {
        try {
            ResponseEntity<String> response = hmacClientUtils.makeHmacRequest(
                    clientName, method.name(), authServerBaseUrl, endpoint, body);
            if (response.getBody() == null || response.getBody().isBlank()) return null;
            return objectMapper.readValue(response.getBody(), responseType);
        } catch (Exception e) {
            log.warn("auth-service call failed: {} {} → {}", method, endpoint, e.getMessage());
            throw new VacademyException(unwrap(e));
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
            throw new VacademyException(unwrap(e));
        }
    }

    private static String unwrap(Throwable e) {
        return e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
    }
}
