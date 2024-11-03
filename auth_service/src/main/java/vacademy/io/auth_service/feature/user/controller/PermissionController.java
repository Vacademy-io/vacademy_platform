package vacademy.io.auth_service.feature.user.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.auth_service.feature.user.dto.PermissionDTO;
import vacademy.io.auth_service.feature.user.service.PermissionService;

import java.util.List;

@RestController
@RequestMapping("/permission")
public class PermissionController {

    @Autowired
    PermissionService permissionService;


    // API to fetch all permissions
    @GetMapping("/v1/all")
    public ResponseEntity<List<PermissionDTO>> getAllPermissionsWithTag() {
        List<PermissionDTO> permissions = permissionService.getAllPermissionsWithTag();
        return ResponseEntity.ok(permissions);
    }
}
