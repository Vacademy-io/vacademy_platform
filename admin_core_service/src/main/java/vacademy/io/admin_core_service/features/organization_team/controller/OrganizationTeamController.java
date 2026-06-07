package vacademy.io.admin_core_service.features.organization_team.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.auth_service.service.OrganizationTeamAuthClient;
import vacademy.io.common.auth.dto.organization.*;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

/**
 * Public admin-facing endpoints for the org chart. Each method is a thin
 * proxy that delegates to auth_service via {@link OrganizationTeamAuthClient}.
 *
 * Team data is owned by auth_service (team membership is a property of the
 * user), so admin_core_service does not keep its own tables; this controller
 * exists only to provide a single base URL ({@code /admin-core-service/v1/...})
 * that the frontend already calls, with the JWT-based auth filter applied
 * uniformly with the rest of admin_core_service.
 */
@RestController
@RequestMapping("/admin-core-service/v1/organization-team")
@RequiredArgsConstructor
public class OrganizationTeamController {

    private final OrganizationTeamAuthClient client;

    // ── Team CRUD ──────────────────────────────────────────────────

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
    public ResponseEntity<String> deleteTeam(
            @PathVariable String teamId,
            @RequestParam(value = "cascade", defaultValue = "false") boolean cascade) {
        client.deleteTeam(teamId, cascade);
        return ResponseEntity.ok("Team deleted");
    }

    // ── Hierarchy reads ────────────────────────────────────────────

    @GetMapping("/chart")
    public ResponseEntity<List<OrgTeamNodeDTO>> getChart(@RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(client.getChart(instituteId));
    }

    @GetMapping("/{teamId}/ancestors")
    public ResponseEntity<List<OrgTeamDTO>> getAncestors(@PathVariable String teamId) {
        return ResponseEntity.ok(client.getAncestors(teamId));
    }

    @GetMapping("/{teamId}/descendants")
    public ResponseEntity<List<OrgTeamDTO>> getDescendants(
            @PathVariable String teamId,
            @RequestParam(value = "flat", defaultValue = "true") boolean flat) {
        // Kept as a query param for forward compatibility — auth_service only
        // returns flat today; nested callers slice from /chart.
        return ResponseEntity.ok(client.getDescendants(teamId));
    }

    // ── Membership ─────────────────────────────────────────────────

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

    @PatchMapping("/{teamId}/members/{mappingId}")
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
}
