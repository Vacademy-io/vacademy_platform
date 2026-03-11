package vacademy.io.admin_core_service.features.hr_salary.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.hr_salary.dto.SalaryComponentDTO;
import vacademy.io.admin_core_service.features.hr_salary.service.SalaryComponentService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/api/v1/hr/salary/components")
public class SalaryComponentController {

    @Autowired
    private SalaryComponentService salaryComponentService;

    @Autowired
    private InstituteAccessValidator instituteAccessValidator;

    @PostMapping
    public ResponseEntity<String> createComponent(
            @RequestBody SalaryComponentDTO dto,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String id = salaryComponentService.createComponent(dto, instituteId);
        return ResponseEntity.ok(id);
    }

    @GetMapping
    public ResponseEntity<List<SalaryComponentDTO>> getComponents(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        List<SalaryComponentDTO> components = salaryComponentService.getComponents(instituteId);
        return ResponseEntity.ok(components);
    }

    @PutMapping("/{id}")
    public ResponseEntity<String> updateComponent(
            @PathVariable("id") String id,
            @RequestBody SalaryComponentDTO dto,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String updatedId = salaryComponentService.updateComponent(id, dto);
        return ResponseEntity.ok(updatedId);
    }
}
