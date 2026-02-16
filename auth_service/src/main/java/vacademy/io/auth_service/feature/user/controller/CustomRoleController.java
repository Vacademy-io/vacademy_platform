package vacademy.io.auth_service.feature.user.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.user.dto.CreateRoleDTO;
import vacademy.io.auth_service.feature.user.dto.CustomRoleDTO;
import vacademy.io.auth_service.feature.user.dto.UpdateRoleDTO;
import vacademy.io.auth_service.feature.user.service.CustomRoleService;
import vacademy.io.common.auth.model.CustomUserDetails;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;

@RestController
@RequestMapping("/auth-service/v1/institute/{instituteId}/roles")
public class CustomRoleController {

    @Autowired
    private CustomRoleService customRoleService;

    @PostMapping
    public ResponseEntity<CustomRoleDTO> createCustomRole(@PathVariable String instituteId,
            @RequestBody CreateRoleDTO createRoleDTO) {
        // In a real app, we'd check @PreAuthorize or instituteId access here
        return ResponseEntity.ok(customRoleService.createCustomRole(instituteId, createRoleDTO));
    }

    @PutMapping("/{roleId}")
    public ResponseEntity<CustomRoleDTO> updateCustomRole(@PathVariable String instituteId,
            @PathVariable String roleId,
            @RequestBody UpdateRoleDTO updateRoleDTO) {
        return ResponseEntity.ok(customRoleService.updateCustomRole(instituteId, roleId, updateRoleDTO));
    }

    @DeleteMapping("/{roleId}")
    public ResponseEntity<Void> deleteCustomRole(@PathVariable String instituteId,
            @PathVariable String roleId) {
        customRoleService.deleteCustomRole(instituteId, roleId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public ResponseEntity<List<CustomRoleDTO>> getRolesForInstitute(@PathVariable String instituteId) {
        return ResponseEntity.ok(customRoleService.getRolesForInstitute(instituteId));
    }
}
