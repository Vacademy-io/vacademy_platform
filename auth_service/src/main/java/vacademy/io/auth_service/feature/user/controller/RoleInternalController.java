package vacademy.io.auth_service.feature.user.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.user.dto.ModifyUserRolesDTO;
import vacademy.io.auth_service.feature.user.dto.UserRoleFilterDTO;
import vacademy.io.auth_service.feature.user.service.RoleService;
import vacademy.io.common.auth.dto.UserWithRolesDTO;
import vacademy.io.common.auth.enums.UserRoleStatus;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

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
     * HMAC-internal variant of {@code POST /auth-service/v1/user-roles/add-user-roles}.
     *
     * <p>Idempotently adds {@code roles} to the user. Existing ACTIVE rows for
     * the same (user, institute, role) tuple are skipped — see
     * {@link RoleService#addRolesToUser} dedup at lines 51–54. The underlying
     * service ignores the {@code CustomUserDetails} argument, so an internal
     * caller can pass {@code null} safely.
     *
     * <p>Used by the admin_core_service bulk-assignment flow to ensure that
     * existing users (e.g. leads created from an audience-form submission)
     * receive the {@code STUDENT} role on enrollment, since the per-row
     * learner-portal login check rejects users without it.
     */
    @PostMapping("/add-user-roles")
    public ResponseEntity<String> addUserRolesInternal(@RequestBody ModifyUserRolesDTO addRolesToUserDTO) {
        String response = roleService.addRolesToUser(
                addRolesToUserDTO,
                Optional.of(UserRoleStatus.ACTIVE.name()),
                null);
        return ResponseEntity.ok(response);
    }

}
