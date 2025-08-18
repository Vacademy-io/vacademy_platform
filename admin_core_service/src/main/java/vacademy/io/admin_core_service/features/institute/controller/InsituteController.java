package vacademy.io.admin_core_service.features.institute.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.institute.dto.InstituteInfoDTO;
import vacademy.io.admin_core_service.features.institute.service.InstituteService;

@RestController
@RequestMapping("/admin-core-service/internal/institute/v1")
public class InsituteController {
    @Autowired
    private InstituteService service;

    @GetMapping("/{instituteId}")
    public ResponseEntity<InstituteInfoDTO> getInstituteById(@PathVariable String instituteId) {
        InstituteInfoDTO institute = service.getInstituteById(instituteId);
        return ResponseEntity.ok(institute);
    }
}
