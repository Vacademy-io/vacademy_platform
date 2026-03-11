package vacademy.io.admin_core_service.features.super_admin.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.super_admin.dto.InstituteDetailSummaryDTO;
import vacademy.io.admin_core_service.features.super_admin.dto.InstituteListItemDTO;
import vacademy.io.admin_core_service.features.super_admin.dto.PlatformDashboardDTO;
import vacademy.io.admin_core_service.features.super_admin.dto.SuperAdminPageResponse;
import vacademy.io.admin_core_service.features.super_admin.service.SuperAdminInstituteService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.util.SuperAdminAuthUtil;

@Slf4j
@RestController
@RequestMapping("/admin-core-service/super-admin/v1")
public class SuperAdminInstituteController {

    @Autowired
    private SuperAdminInstituteService superAdminInstituteService;

    @GetMapping("/institutes")
    public ResponseEntity<SuperAdminPageResponse<InstituteListItemDTO>> listInstitutes(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search) {
        try {
            SuperAdminAuthUtil.requireSuperAdmin(user);
            if (size > 50) size = 50;
            return ResponseEntity.ok(superAdminInstituteService.listAllInstitutes(search, page, size));
        } catch (Exception e) {
            log.error("Error in listInstitutes: {}", e.getMessage());
            throw e;
        }
    }

    @GetMapping("/institutes/{instituteId}")
    public ResponseEntity<InstituteDetailSummaryDTO> getInstituteDetail(
            @RequestAttribute("user") CustomUserDetails user,
            @PathVariable String instituteId) {
        try {
            SuperAdminAuthUtil.requireSuperAdmin(user);
            InstituteDetailSummaryDTO detail = superAdminInstituteService.getInstituteDetail(instituteId);
            if (detail == null) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.ok(detail);
        } catch (Exception e) {
            log.error("Error in getInstituteDetail: {}", e.getMessage());
            throw e;
        }
    }

    @GetMapping("/dashboard")
    public ResponseEntity<PlatformDashboardDTO> getPlatformDashboard(
            @RequestAttribute("user") CustomUserDetails user) {
        try {
            SuperAdminAuthUtil.requireSuperAdmin(user);
            return ResponseEntity.ok(superAdminInstituteService.getPlatformDashboard());
        } catch (Exception e) {
            log.error("Error in getPlatformDashboard: {}", e.getMessage());
            throw e;
        }
    }
}
