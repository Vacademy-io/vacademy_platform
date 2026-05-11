package vacademy.io.admin_core_service.features.suborg.controller;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.suborg.dto.SubOrgTeamAddRequestDTO;
import vacademy.io.admin_core_service.features.suborg.dto.SubOrgTeamListRequestDTO;
import vacademy.io.admin_core_service.features.suborg.dto.SubOrgTeamRemoveRequestDTO;
import vacademy.io.admin_core_service.features.suborg.service.SubOrgTeamService;
import vacademy.io.common.auth.dto.PagedUserWithRolesResponse;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;
import java.util.Map;

/**
 * Endpoints for sub-org team (custom-role) management. Separate from the existing
 * SubOrgLearnerController to keep learner enrollment and team management cleanly distinct.
 */
@RestController
@RequestMapping("/admin-core-service/sub-org/v1/team")
@RequiredArgsConstructor
@Tag(name = "Sub-Org Team Controller", description = "List / add / remove sub-org team members")
public class SubOrgTeamController {

    private final SubOrgTeamService subOrgTeamService;

    @PostMapping("/list")
    public ResponseEntity<PagedUserWithRolesResponse> listTeamMembers(
            @RequestBody SubOrgTeamListRequestDTO request,
            @RequestAttribute(value = "user", required = false) CustomUserDetails user) {
        return ResponseEntity.ok(subOrgTeamService.listTeamMembers(request, user));
    }

    /** Sub-orgs the caller can manage (for the picker on the manage-suborg-teams page). */
    @GetMapping("/accessible-sub-orgs")
    public ResponseEntity<List<Map<String, Object>>> listAccessibleSubOrgs(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute(value = "user", required = false) CustomUserDetails user) {
        return ResponseEntity.ok(subOrgTeamService.listAccessibleSubOrgs(user, instituteId));
    }

    /** Grants (PS IDs + invites) the caller can extend from the Add Member form. */
    @GetMapping("/accessible-grants")
    public ResponseEntity<Map<String, Object>> listAccessibleGrants(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute(value = "user", required = false) CustomUserDetails user) {
        return ResponseEntity.ok(subOrgTeamService.listAccessibleGrants(user, instituteId));
    }

    @PostMapping("/add")
    public ResponseEntity<Map<String, Object>> addTeamMember(
            @RequestBody SubOrgTeamAddRequestDTO request,
            @RequestAttribute(value = "user", required = false) CustomUserDetails user) {
        return ResponseEntity.ok(subOrgTeamService.addTeamMember(request, user));
    }

    @PostMapping("/remove")
    public ResponseEntity<Map<String, Object>> removeTeamMember(
            @RequestBody SubOrgTeamRemoveRequestDTO request,
            @RequestAttribute(value = "user", required = false) CustomUserDetails user) {
        return ResponseEntity.ok(subOrgTeamService.removeTeamMember(request, user));
    }
}
