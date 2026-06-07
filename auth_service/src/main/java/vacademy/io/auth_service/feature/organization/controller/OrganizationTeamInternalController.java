package vacademy.io.auth_service.feature.organization.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.organization.service.OrganizationTeamService;
import vacademy.io.common.auth.dto.organization.*;

import java.util.List;

/**
 * HMAC-internal endpoints under {@code /auth-service/internal/organization-team/*}.
 *
 * admin_core_service calls these (via {@code AuthService} +
 * {@code InternalClientUtils.makeHmacRequest}) so the team graph stays the
 * single source of truth in auth_service. End-user requests still hit
 * admin_core_service's controller, which forwards here.
 */
@RestController
@RequestMapping("/auth-service/internal/organization-team")
@RequiredArgsConstructor
public class OrganizationTeamInternalController {

    private final OrganizationTeamService service;

    // ── CRUD ────────────────────────────────────────────────────────

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
    public ResponseEntity<String> deleteTeam(
            @PathVariable String teamId,
            @RequestParam(value = "cascade", defaultValue = "false") boolean cascade) {
        service.deleteTeam(teamId, cascade);
        return ResponseEntity.ok("Team deleted");
    }

    // ── Hierarchy reads ────────────────────────────────────────────

    @GetMapping("/chart")
    public ResponseEntity<List<OrgTeamNodeDTO>> getChart(@RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(service.getChart(instituteId));
    }

    @GetMapping("/{teamId}/ancestors")
    public ResponseEntity<List<OrgTeamDTO>> getAncestors(@PathVariable String teamId) {
        return ResponseEntity.ok(service.getAncestors(teamId));
    }

    @GetMapping("/{teamId}/descendants")
    public ResponseEntity<List<OrgTeamDTO>> getDescendants(@PathVariable String teamId) {
        return ResponseEntity.ok(service.getDescendantsFlat(teamId));
    }

    @GetMapping("/{teamId}/subtree")
    public ResponseEntity<List<OrgTeamDTO>> getSubtreeIncludingSelf(@PathVariable String teamId) {
        return ResponseEntity.ok(service.getSubtreeIncludingSelf(teamId));
    }

    // ── Membership ─────────────────────────────────────────────────

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

    @PatchMapping("/{teamId}/members/{mappingId}")
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

    // ── Cross-service helpers for the workbench team scope ─────────

    @PostMapping("/members/users-in-teams")
    public ResponseEntity<List<String>> usersInTeams(@RequestBody List<String> teamIds) {
        return ResponseEntity.ok(service.usersInTeams(teamIds));
    }

    @GetMapping("/members/by-user/{userId}")
    public ResponseEntity<List<TeamMemberDTO>> mappingsForUser(@PathVariable String userId) {
        return ResponseEntity.ok(service.mappingsForUser(userId));
    }
}
