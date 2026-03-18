package vacademy.io.auth_service.feature.super_admin.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.super_admin.dto.InstituteUserDTO;
import vacademy.io.auth_service.feature.super_admin.dto.SuperAdminPageResponse;
import vacademy.io.auth_service.feature.super_admin.service.SuperAdminAnalyticsService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.util.SuperAdminAuthUtil;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/auth-service/super-admin/v1")
public class SuperAdminUserController {

    @Autowired
    private SuperAdminAnalyticsService superAdminAnalyticsService;

    @GetMapping("/institutes/{instituteId}/users")
    public ResponseEntity<SuperAdminPageResponse<InstituteUserDTO>> getInstituteUsers(
            @RequestAttribute("user") CustomUserDetails user,
            @PathVariable String instituteId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String search) {
        try {
            SuperAdminAuthUtil.requireSuperAdmin(user);
            if (size > 50) size = 50;
            return ResponseEntity.ok(superAdminAnalyticsService.getInstituteUsers(
                    instituteId, role, search, page, size));
        } catch (Exception e) {
            log.error("Error in getInstituteUsers: {}", e.getMessage());
            throw e;
        }
    }

    @PutMapping("/institutes/{instituteId}/users/{userId}/deactivate")
    public ResponseEntity<Map<String, String>> deactivateUser(
            @RequestAttribute("user") CustomUserDetails user,
            @PathVariable String instituteId,
            @PathVariable String userId) {
        try {
            SuperAdminAuthUtil.requireSuperAdmin(user);
            superAdminAnalyticsService.deactivateUserFromInstitute(instituteId, userId);
            return ResponseEntity.ok(Map.of("status", "success", "message",
                    "User deactivated from institute"));
        } catch (Exception e) {
            log.error("Error deactivating user {} from institute {}: {}", userId, instituteId, e.getMessage());
            throw e;
        }
    }
}
