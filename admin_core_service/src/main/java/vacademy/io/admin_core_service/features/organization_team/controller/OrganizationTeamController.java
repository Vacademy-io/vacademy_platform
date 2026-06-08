package vacademy.io.admin_core_service.features.organization_team.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.auth_service.service.OrganizationTeamAuthClient;
import vacademy.io.common.auth.dto.organization.*;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

/**
 * Frontend-facing org-team endpoints. Each method is a thin proxy onto
 * auth_service. URL surface is identical to what the frontend already
 * binds to, so no client changes are needed when the backend shape evolves.
 *
 * Model: flat teams + user-to-user reporting inside each team. The same
 * person can be in multiple teams with different managers.
 */
@RestController
@RequestMapping("/admin-core-service/v1/organization-team")
@RequiredArgsConstructor
public class OrganizationTeamController {

    private final OrganizationTeamAuthClient client;

    // ── Teams ──────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<List<OrgTeamDTO>> listTeams(
            @RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(client.listTeams(instituteId));
    }

    @GetMapping("/{teamId}")
    public ResponseEntity<OrgTeamDTO> getTeam(@PathVariable String teamId) {
        return ResponseEntity.ok(client.getTeam(teamId));
    }

    @PostMapping
    public ResponseEntity<OrgTeamDTO> createTeam(
            @RequestBody CreateTeamRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(client.createTeam(request, user.getUserId()));
    }

    @PutMapping("/{teamId}")
    public ResponseEntity<OrgTeamDTO> updateTeam(
            @PathVariable String teamId,
            @RequestBody UpdateTeamRequest request) {
        return ResponseEntity.ok(client.updateTeam(teamId, request));
    }

    @DeleteMapping("/{teamId}")
    public ResponseEntity<String> deleteTeam(@PathVariable String teamId) {
        client.deleteTeam(teamId);
        return ResponseEntity.ok("Team deleted");
    }

    // ── Members ───────────────────────────────────────────────────

    @GetMapping("/{teamId}/members")
    public ResponseEntity<List<TeamMemberDTO>> listMembers(@PathVariable String teamId) {
        return ResponseEntity.ok(client.listMembers(teamId));
    }

    @PostMapping("/{teamId}/members")
    public ResponseEntity<TeamMemberDTO> addMember(
            @PathVariable String teamId,
            @RequestBody AddMemberRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(client.addMember(teamId, request, user.getUserId()));
    }

    // PUT (not PATCH) — see note on the internal endpoint: the inter-service
    // forwarder cannot send PATCH over HttpURLConnection.
    @PutMapping("/{teamId}/members/{mappingId}")
    public ResponseEntity<TeamMemberDTO> updateMember(
            @PathVariable String teamId,
            @PathVariable String mappingId,
            @RequestBody UpdateMemberRequest request) {
        return ResponseEntity.ok(client.updateMember(teamId, mappingId, request));
    }

    @DeleteMapping("/{teamId}/members/{mappingId}")
    public ResponseEntity<String> removeMember(
            @PathVariable String teamId,
            @PathVariable String mappingId) {
        client.removeMember(teamId, mappingId);
        return ResponseEntity.ok("Member removed");
    }

    // ── Chart + traversal ─────────────────────────────────────────

    @GetMapping("/{teamId}/chart")
    public ResponseEntity<List<OrgChartNodeDTO>> getTeamChart(@PathVariable String teamId) {
        return ResponseEntity.ok(client.getTeamChart(teamId));
    }

    @GetMapping("/{teamId}/members/{mappingId}/ancestors")
    public ResponseEntity<List<TeamMemberDTO>> getAncestors(
            @PathVariable String teamId,
            @PathVariable String mappingId) {
        return ResponseEntity.ok(client.getAncestors(teamId, mappingId));
    }

    @GetMapping("/{teamId}/members/{mappingId}/descendants")
    public ResponseEntity<List<TeamMemberDTO>> getDescendants(
            @PathVariable String teamId,
            @PathVariable String mappingId) {
        return ResponseEntity.ok(client.getDescendants(teamId, mappingId));
    }

    @GetMapping("/members/by-user/{userId}")
    public ResponseEntity<List<TeamMemberDTO>> getUserMemberships(@PathVariable String userId) {
        return ResponseEntity.ok(client.getUserMemberships(userId));
    }
}
