package vacademy.io.admin_core_service.features.institute.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.config.cache.CacheScope;
import vacademy.io.admin_core_service.config.cache.ClientCacheable;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

/**
 * Public (unauthenticated) read of the STUDENT_DISPLAY_SETTINGS blob so the pre-login
 * course-catalogue pages can honour learner-facing display toggles (e.g. whether the
 * Teachers/Instructors section is shown). Deliberately exposes ONLY this one display-only
 * setting key — never arbitrary keys — so no sensitive institute config leaks. Lives under
 * /admin-core-service/open/** so it bypasses auth (see ApplicationSecurityConfig whitelist).
 */
@RestController
@RequestMapping("/admin-core-service/open/institute/setting/v1")
public class OpenInstituteSettingController {

    private static final String STUDENT_DISPLAY_SETTINGS = "STUDENT_DISPLAY_SETTINGS";

    @Autowired
    private InstituteRepository instituteRepository;

    @Autowired
    private InstituteSettingService instituteSettingService;

    @GetMapping("/student-display")
    @ClientCacheable(maxAgeSeconds = 300, scope = CacheScope.PUBLIC)
    public ResponseEntity<Object> getStudentDisplaySettings(@RequestParam("instituteId") String instituteId) {
        Institute institute = instituteRepository.findById(instituteId)
                .orElseThrow(() -> new VacademyException("Institute Not Found"));
        // Returns the setting's `data` object, or null when the institute never configured it.
        Object data = instituteSettingService.getSettingData(institute, STUDENT_DISPLAY_SETTINGS);
        return ResponseEntity.ok(data);
    }
}
