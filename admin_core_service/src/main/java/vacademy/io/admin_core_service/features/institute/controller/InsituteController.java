package vacademy.io.admin_core_service.features.institute.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.institute.dto.InstituteInfoDTO;
import vacademy.io.admin_core_service.features.institute.service.InstituteService;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.config.cache.ClientCacheable;
import vacademy.io.admin_core_service.config.cache.CacheScope;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;

import java.util.Optional;

@RestController
@RequestMapping("/admin-core-service/internal/institute/v1")
public class InsituteController {
    @Autowired
    private InstituteService service;

    @Autowired
    private InstituteSettingService instituteSettingService;

    @Autowired
    private InstituteRepository instituteRepository;

    @GetMapping("/{instituteId}")
    @ClientCacheable(maxAgeSeconds = 600, scope = CacheScope.PUBLIC)
    @Cacheable(value = "instituteById", key = "#instituteId")
    public ResponseEntity<InstituteInfoDTO> getInstituteById(@PathVariable String instituteId) {
        InstituteInfoDTO institute = service.getInstituteById(instituteId);
        return ResponseEntity.ok(institute);
    }

    @GetMapping("/{instituteId}/setting")
    public ResponseEntity<Object> getSettingData(@PathVariable String instituteId,
                                                  @RequestParam String settingKey) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if (institute.isEmpty()) return ResponseEntity.notFound().build();
        Object data = instituteSettingService.getSettingData(institute.get(), settingKey);
        return ResponseEntity.ok(data);
    }

}
