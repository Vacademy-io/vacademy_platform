package vacademy.io.auth_service.feature.organization.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.organization.service.OrganizationTeamService;
import vacademy.io.common.auth.dto.organization.*;

import java.util.List;

/**
 * HMAC-internal endpoints for the hybrid team / user-to-user org chart.
 * admin_core_service forwards user-facing requests here.
 *
 * Endpoint shape stays identical to what we already designed:
 *   teams        — POST / PUT / DELETE / GET list
 *   members      — POST / PATCH / DELETE / GET list per team
 *   chart        — GET /chart/{teamId} returns the per-team reporting tree
 *   ancestors    — GET /members/{mappingId}/ancestors
 *   descendants  — GET /members/{mappingId}/descendants
 */
@RestController
@RequestMapping("/auth-service/internal/organization-team")
@RequiredArgsConstructor
public class OrganizationTeamInternalController {

    private final OrganizationTeamService service;

    // ── Teams ──────────────────────────────────────────────────────

    @PostMapping
    public ResponseEntity<OrgTeamDTO> createTeam(
            @RequestBody CreateTeamRequest request,
            @RequestParam(value = "createdBy", required = false) String createdBy) {
        return ResponseEntity.ok(service.createTeam(request, createdBy));
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
            @RequestParam(value = "addedBy", required = false) String addedBy) {
        return ResponseEntity.ok(service.addMember(teamId, request, addedBy));
    }

    // PUT (not PATCH) — admin_core_service forwards over JDK HttpURLConnection
    // which does not support PATCH. The body's change_X flags already make
    // this a partial update; PUT here means "apply the parts you flagged."
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
