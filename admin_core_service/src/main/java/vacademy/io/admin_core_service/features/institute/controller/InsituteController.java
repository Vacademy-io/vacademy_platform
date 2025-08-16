package vacademy.io.admin_core_service.features.institute.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.institute.service.InstituteService;
import vacademy.io.common.institute.entity.Institute;

@RestController
@RequestMapping("/admin-core-service/internal/institute/v1")
public class InsituteController {
    @Autowired
    private InstituteService service;

    @GetMapping("/{instituteId}")
    public ResponseEntity<Institute> getInstituteById(@PathVariable String instituteId) {
        Institute institute = service.findById(instituteId);
        return ResponseEntity.ok(institute);
    }
}
