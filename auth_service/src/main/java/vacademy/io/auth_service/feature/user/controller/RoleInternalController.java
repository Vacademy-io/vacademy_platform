package vacademy.io.auth_service.feature.user.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.user.dto.UserRoleFilterDTO;
import vacademy.io.auth_service.feature.user.service.RoleService;
import vacademy.io.common.auth.dto.PagedUserWithRolesResponse;
import vacademy.io.common.auth.dto.UserWithRolesDTO;
import vacademy.io.common.auth.enums.UserRoleStatus;

import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/auth-service/internal/v1/user-roles")
public class RoleInternalController {

    @Autowired
    private RoleService roleService;

    @PostMapping("/users-of-status")
    public ResponseEntity<List<UserWithRolesDTO>> getUsersOfRole(@RequestBody List<String> roles,
                                                                 @RequestParam String instituteId) {
        UserRoleFilterDTO userRoleFilterDTO = new UserRoleFilterDTO();
        userRoleFilterDTO.setRoles(roles);
        userRoleFilterDTO.setStatus(Arrays.asList(UserRoleStatus.ACTIVE.name()));
        List<UserWithRolesDTO> response = roleService.getUsersByInstituteIdAndStatus(instituteId, userRoleFilterDTO);
        return ResponseEntity.ok(response);
    }

    /**
     * Paged variant of users-of-status used by trusted internal callers
     * (e.g. admin-core-service sub-org team listing). Honours the full
     * {@link UserRoleFilterDTO}, including the optional userIds filter that
     * scopes results to a pre-resolved set of user IDs.
     */
    @PostMapping("/users-of-status-paged")
    public ResponseEntity<PagedUserWithRolesResponse> getUsersOfStatusPaged(
            @RequestBody UserRoleFilterDTO filterDTO,
            @RequestParam String instituteId) {
        PagedUserWithRolesResponse response = roleService.getUsersByInstituteIdAndStatusPaged(instituteId,
                filterDTO, null);
        return ResponseEntity.ok(response);
    }

}
