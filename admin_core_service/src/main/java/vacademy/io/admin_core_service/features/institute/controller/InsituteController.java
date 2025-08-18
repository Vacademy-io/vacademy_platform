package vacademy.io.admin_core_service.features.institute.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.institute.dto.InstituteDTO;
import vacademy.io.admin_core_service.features.institute.service.InstituteService;
import vacademy.io.common.institute.entity.Institute;

@RestController
@RequestMapping("/admin-core-service/internal/institute/v1")
public class InsituteController {
    @Autowired
    private InstituteService service;

    @GetMapping("/{instituteId}")
    public ResponseEntity<InstituteDTO> getInstituteById(@PathVariable String instituteId) {
        InstituteDTO institute = service.getInstituteById(instituteId);
        return ResponseEntity.ok(institute);
    }
}
