package vacademy.io.auth_service.feature.super_admin.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.super_admin.dto.CrossInstituteActiveUsersDTO;
import vacademy.io.auth_service.feature.super_admin.dto.InstituteSessionDTO;
import vacademy.io.auth_service.feature.super_admin.dto.PlatformActivityTrendDTO;
import vacademy.io.auth_service.feature.super_admin.dto.SuperAdminPageResponse;
import vacademy.io.auth_service.feature.super_admin.service.SuperAdminAnalyticsService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.util.SuperAdminAuthUtil;

import java.time.LocalDateTime;

@Slf4j
@RestController
@RequestMapping("/auth-service/super-admin/v1")
public class SuperAdminSessionController {

    @Autowired
    private SuperAdminAnalyticsService superAdminAnalyticsService;

    @GetMapping("/institutes/{instituteId}/sessions")
    public ResponseEntity<SuperAdminPageResponse<InstituteSessionDTO>> getInstituteSessions(
            @RequestAttribute("user") CustomUserDetails user,
            @PathVariable String instituteId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {
        try {
            SuperAdminAuthUtil.requireSuperAdmin(user);
            if (size > 50) size = 50;
            return ResponseEntity.ok(superAdminAnalyticsService.getInstituteSessions(
                    instituteId, page, size, startDate, endDate));
        } catch (Exception e) {
            log.error("Error in getInstituteSessions: {}", e.getMessage());
            throw e;
        }
    }

    @GetMapping("/active-users")
    public ResponseEntity<CrossInstituteActiveUsersDTO> getCrossInstituteActiveUsers(
            @RequestAttribute("user") CustomUserDetails user) {
        try {
            SuperAdminAuthUtil.requireSuperAdmin(user);
            return ResponseEntity.ok(superAdminAnalyticsService.getCrossInstituteActiveUsers());
        } catch (Exception e) {
            log.error("Error in getCrossInstituteActiveUsers: {}", e.getMessage());
            throw e;
        }
    }

    @GetMapping("/activity-trends")
    public ResponseEntity<PlatformActivityTrendDTO> getPlatformActivityTrends(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam(defaultValue = "7") int days) {
        try {
            SuperAdminAuthUtil.requireSuperAdmin(user);
            if (days > 30) days = 30;
            return ResponseEntity.ok(superAdminAnalyticsService.getPlatformActivityTrends(days));
        } catch (Exception e) {
            log.error("Error in getPlatformActivityTrends: {}", e.getMessage());
            throw e;
        }
    }
}
