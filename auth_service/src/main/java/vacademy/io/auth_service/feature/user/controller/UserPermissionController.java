package vacademy.io.auth_service.feature.user.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.auth.dto.EditUserPermissionRequestDTO;
import vacademy.io.common.auth.service.UserPermissionService;

import java.util.List;

@RestController
@RequestMapping("/auth-service/v1/user-permission")
public class UserPermissionController {

    @Autowired
    private UserPermissionService userPermissionService;

    @PutMapping
    public ResponseEntity<String>editUserPermission(@RequestBody EditUserPermissionRequestDTO editUserPermissionRequestDTO){
        return ResponseEntity.ok(userPermissionService.updateUserPermission(editUserPermissionRequestDTO));
    }

    @GetMapping
    public ResponseEntity<List<String>>getUserPermissions(String userId){
        return ResponseEntity.ok(userPermissionService.getUserPermissions(userId));
    }
}
