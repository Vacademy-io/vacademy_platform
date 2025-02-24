package vacademy.io.auth_service.feature.user.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.user.dto.ModifyUserRolesDTO;
import vacademy.io.auth_service.feature.user.service.RoleService;
import vacademy.io.common.auth.dto.RoleCountProjection;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("auth-service/v1/user-roles")
public class RoleController {

    private final RoleService roleService;

    public RoleController(RoleService roleService) {
        this.roleService = roleService;
    }

    @PostMapping("/add-user-roles")
    public ResponseEntity<String> addRolesToUser(
            @RequestBody ModifyUserRolesDTO addRolesToUserDTO,
            @RequestAttribute("user") CustomUserDetails customUserDetails) {

        String response = roleService.addRolesToUser(addRolesToUserDTO, customUserDetails);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/remove-user-roles")
    public ResponseEntity<String> removeUserRoles(
            @RequestBody ModifyUserRolesDTO removeUserRolesDTO,
            @RequestAttribute("user") CustomUserDetails customUserDetails) {

        String response = roleService.removeRolesFromUser(removeUserRolesDTO, customUserDetails);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/user-roles-count")
    public ResponseEntity<List<RoleCountProjection>> getRolesCountByInstituteId(
            @RequestParam String instituteId,
            @RequestAttribute("user") CustomUserDetails userDetails) {

        List<RoleCountProjection> roleCounts = roleService.geRolesCountByInstituteId(instituteId, userDetails);
        return ResponseEntity.ok(roleCounts);
    }
}
