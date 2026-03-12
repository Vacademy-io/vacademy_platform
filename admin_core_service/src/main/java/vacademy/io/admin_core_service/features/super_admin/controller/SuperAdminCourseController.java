package vacademy.io.admin_core_service.features.super_admin.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.super_admin.dto.InstituteCourseDTO;
import vacademy.io.admin_core_service.features.super_admin.dto.SuperAdminPageResponse;
import vacademy.io.admin_core_service.features.super_admin.service.SuperAdminCourseService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.util.SuperAdminAuthUtil;

@Slf4j
@RestController
@RequestMapping("/admin-core-service/super-admin/v1")
public class SuperAdminCourseController {

    @Autowired
    private SuperAdminCourseService superAdminCourseService;

    @GetMapping("/institutes/{instituteId}/courses")
    public ResponseEntity<SuperAdminPageResponse<InstituteCourseDTO>> getInstituteCourses(
            @RequestAttribute("user") CustomUserDetails user,
            @PathVariable String instituteId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search) {
        try {
            SuperAdminAuthUtil.requireSuperAdmin(user);
            if (size > 50) size = 50;
            return ResponseEntity.ok(superAdminCourseService.getInstituteCourses(instituteId, search, page, size));
        } catch (Exception e) {
            log.error("Error in getInstituteCourses: {}", e.getMessage());
            throw e;
        }
    }
}
