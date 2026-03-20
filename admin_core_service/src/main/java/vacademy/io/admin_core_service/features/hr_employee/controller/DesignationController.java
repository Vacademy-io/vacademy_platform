package vacademy.io.admin_core_service.features.hr_employee.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.hr_employee.dto.DesignationDTO;
import vacademy.io.admin_core_service.features.hr_employee.service.DesignationService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/api/v1/hr/designations")
public class DesignationController {

    @Autowired
    private DesignationService designationService;

    @Autowired
    private InstituteAccessValidator instituteAccessValidator;

    @PostMapping
    public ResponseEntity<String> addDesignation(
            @RequestBody DesignationDTO dto,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String id = designationService.addDesignation(dto, instituteId);
        return ResponseEntity.ok(id);
    }

    @GetMapping
    public ResponseEntity<List<DesignationDTO>> getDesignations(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        List<DesignationDTO> designations = designationService.getDesignations(instituteId);
        return ResponseEntity.ok(designations);
    }

    @PutMapping("/{id}")
    public ResponseEntity<String> updateDesignation(
            @PathVariable("id") String id,
            @RequestBody DesignationDTO dto,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String updatedId = designationService.updateDesignation(id, dto);
        return ResponseEntity.ok(updatedId);
    }
}
