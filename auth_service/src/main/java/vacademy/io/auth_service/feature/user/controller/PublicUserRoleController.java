package vacademy.io.auth_service.feature.user.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.user.dto.UserRoleFilterDTO;
import vacademy.io.auth_service.feature.user.service.RoleService;
import vacademy.io.common.auth.dto.UserWithRolesDTO;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("auth-service/public/v1/")
public class PublicUserRoleController {

    @Autowired
    private RoleService roleService;

    @PostMapping("/users-of-status")
    public ResponseEntity<List<UserWithRolesDTO>> getUsersOfStatus(@RequestBody UserRoleFilterDTO filterDTO,
                                                                   @RequestParam String instituteId) {
        List<UserWithRolesDTO> response = roleService.getUsersByInstituteIdAndStatus(instituteId, filterDTO, null);
        return ResponseEntity.ok(response);
    }

}
