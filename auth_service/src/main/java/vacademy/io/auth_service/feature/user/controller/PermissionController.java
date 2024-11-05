package vacademy.io.auth_service.feature.user.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.user.dto.PermissionDTO;
import vacademy.io.auth_service.feature.user.service.PermissionService;

import java.util.List;

@RestController
public class PermissionController {

    @Autowired
    PermissionService permissionService;


    // API to fetch all permission of user correspond to user Id
    @GetMapping("/v1/internal/permission/{userId}")
    public ResponseEntity<List<PermissionDTO>> getPermissionsByUserId(@PathVariable String userId) {
        List<PermissionDTO> permissions = permissionService.getPermissionsByUserId(userId);
        return ResponseEntity.ok(permissions);
    }


    //API to fetch permission corresspond to list of roles ID
    @GetMapping("/v1/internal/permissions-by-list-of-role-id")
    public ResponseEntity<List<PermissionDTO>> getPermissionsByListOfRoleId(@RequestBody List<String> roleId) {
        List<PermissionDTO> permissions = permissionService.getPermissionsByListOfRoleId(roleId);
        return ResponseEntity.ok(permissions);
    }

    // API to fetch all permissions
    @GetMapping("/v1/all")
    public ResponseEntity<List<PermissionDTO>> getAllPermissionsWithTag() {
        List<PermissionDTO> permissions = permissionService.getAllPermissionsWithTag();
        return ResponseEntity.ok(permissions);
    }
}
