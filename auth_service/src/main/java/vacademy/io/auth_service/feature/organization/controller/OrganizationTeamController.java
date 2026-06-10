package vacademy.io.auth_service.feature.organization.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.organization.service.OrganizationTeamService;
import vacademy.io.common.auth.dto.organization.*;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

/**
 * Frontend-facing org-team endpoints. Authenticated via the standard
 * JwtAuthFilter (Bearer token), same as every other v1 controller here —
 * the actor's user id is injected on the request as {@code "user"}.
 *
 * Replaces the old admin_core_service proxy. Routing CRUD through admin_core
 * added a network hop, an HMAC sig step, a JSON re-serialisation cycle, and
 * a class of bugs (510 String parsing, PATCH unsupported over
 * HttpURLConnection) — none of which provided any cross-service value.
 *
 * The HMAC internal controller stays for what it's actually for: service-to-
 * service calls (admin_core's workbench / sales-dashboard scope queries).
 *
 * Same backend service, same {@code parent_user_id} column, same SQL — only
 * the HTTP entry point changes.
 */
@RestController
@RequestMapping("/auth-service/v1/organization-team")
@RequiredArgsConstructor
public class OrganizationTeamController {

    private final OrganizationTeamService service;

    // ── Teams ──────────────────────────────────────────────────────

    @PostMapping
    public ResponseEntity<OrgTeamDTO> createTeam(
            @RequestBody CreateTeamRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(service.createTeam(request, user.getUserId()));
    }

    @PutMapping("/{teamId}")
    public ResponseEntity<OrgTeamDTO> updateTeam(
            @PathVariable String teamId,
            @RequestBody UpdateTeamRequest request) {
        return ResponseEntity.ok(service.updateTeam(teamId, request));
    }

    @DeleteMapping("/{teamId}")
    public ResponseEntity<String> deleteTeam(@PathVariable String teamId) {
        service.deleteTeam(teamId);
        return ResponseEntity.ok("Team deleted");
    }

    @GetMapping
    public ResponseEntity<List<OrgTeamDTO>> listTeams(@RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(service.listTeams(instituteId));
    }

    @GetMapping("/{teamId}")
    public ResponseEntity<OrgTeamDTO> getTeam(@PathVariable String teamId) {
        return ResponseEntity.ok(service.getTeam(teamId));
    }

    // ── Members per team ───────────────────────────────────────────

    @GetMapping("/{teamId}/members")
    public ResponseEntity<List<TeamMemberDTO>> listMembers(@PathVariable String teamId) {
        return ResponseEntity.ok(service.listMembers(teamId));
    }

    @PostMapping("/{teamId}/members")
    public ResponseEntity<TeamMemberDTO> addMember(
            @PathVariable String teamId,
            @RequestBody AddMemberRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(service.addMember(teamId, request, user.getUserId()));
    }

    @PutMapping("/{teamId}/members/{mappingId}")
    public ResponseEntity<TeamMemberDTO> updateMember(
            @PathVariable String teamId,
            @PathVariable String mappingId,
            @RequestBody UpdateMemberRequest request) {
        return ResponseEntity.ok(service.updateMember(teamId, mappingId, request));
    }

    @DeleteMapping("/{teamId}/members/{mappingId}")
    public ResponseEntity<String> removeMember(
            @PathVariable String teamId,
            @PathVariable String mappingId) {
        service.removeMember(teamId, mappingId);
        return ResponseEntity.ok("Member removed");
    }

    // ── Per-team chart + traversal ─────────────────────────────────

    @GetMapping("/{teamId}/chart")
    public ResponseEntity<List<OrgChartNodeDTO>> getTeamChart(@PathVariable String teamId) {
        return ResponseEntity.ok(service.getTeamChart(teamId));
    }

    @GetMapping("/{teamId}/members/{mappingId}/ancestors")
    public ResponseEntity<List<TeamMemberDTO>> getAncestors(
            @PathVariable String teamId,
            @PathVariable String mappingId) {
        return ResponseEntity.ok(service.getAncestors(teamId, mappingId));
    }

    @GetMapping("/{teamId}/members/{mappingId}/descendants")
    public ResponseEntity<List<TeamMemberDTO>> getDescendants(
            @PathVariable String teamId,
            @PathVariable String mappingId) {
        return ResponseEntity.ok(service.getDescendants(teamId, mappingId));
    }

    // ── Cross-team helpers ─────────────────────────────────────────

    /** All teams a user is a member of — used for the multi-team "+1 team" badge. */
    @GetMapping("/members/by-user/{userId}")
    public ResponseEntity<List<TeamMemberDTO>> getUserMemberships(@PathVariable String userId) {
        return ResponseEntity.ok(service.listMembershipsForUser(userId));
    }
}
