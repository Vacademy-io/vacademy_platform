package vacademy.io.auth_service.feature.user.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.user.dto.AddRolesToUserDTO;
import vacademy.io.auth_service.feature.user.service.RoleService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("auth-service/v1/user-roles")
public class RoleController {

    private final RoleService roleService;

    public RoleController(RoleService roleService) {
        this.roleService = roleService;
    }

    @PostMapping("/add-roles-to-user")
    public ResponseEntity<String> addRolesToUser(
            @RequestBody AddRolesToUserDTO addRolesToUserDTO,
            @RequestAttribute("user") CustomUserDetails customUserDetails) {

        String response = roleService.addRolesToUser(addRolesToUserDTO, customUserDetails);
        return ResponseEntity.ok(response);
    }
}
