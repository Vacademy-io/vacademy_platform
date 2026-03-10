package vacademy.io.admin_core_service.features.hr_tax.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.hr_tax.dto.TaxComputationDTO;
import vacademy.io.admin_core_service.features.hr_tax.dto.TaxConfigurationDTO;
import vacademy.io.admin_core_service.features.hr_tax.dto.TaxDeclarationDTO;
import vacademy.io.admin_core_service.features.hr_tax.service.TaxComputationService;
import vacademy.io.admin_core_service.features.hr_tax.service.TaxConfigurationService;
import vacademy.io.admin_core_service.features.hr_tax.service.TaxDeclarationService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/api/v1/hr/tax")
public class TaxController {

    @Autowired
    private TaxConfigurationService taxConfigurationService;

    @Autowired
    private TaxDeclarationService taxDeclarationService;

    @Autowired
    private TaxComputationService taxComputationService;

    @Autowired
    private InstituteAccessValidator instituteAccessValidator;

    // ======================== Tax Configuration ========================

    @PostMapping("/config")
    public ResponseEntity<String> saveConfig(
            @RequestBody TaxConfigurationDTO dto,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String id = taxConfigurationService.saveConfig(dto);
        return ResponseEntity.ok(id);
    }

    @GetMapping("/config")
    public ResponseEntity<TaxConfigurationDTO> getConfig(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        TaxConfigurationDTO config = taxConfigurationService.getConfig(instituteId);
        return ResponseEntity.ok(config);
    }

    // ======================== Tax Declarations ========================

    @PostMapping("/declarations")
    public ResponseEntity<String> submitDeclaration(
            @RequestBody TaxDeclarationDTO dto,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String id = taxDeclarationService.submitDeclaration(dto);
        return ResponseEntity.ok(id);
    }

    @GetMapping("/declarations")
    public ResponseEntity<TaxDeclarationDTO> getDeclaration(
            @RequestParam("employeeId") String employeeId,
            @RequestParam("fy") String financialYear,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        TaxDeclarationDTO declaration = taxDeclarationService.getDeclaration(employeeId, financialYear);
        return ResponseEntity.ok(declaration);
    }

    @PutMapping("/declarations/{id}")
    public ResponseEntity<String> updateDeclaration(
            @PathVariable("id") String id,
            @RequestBody TaxDeclarationDTO dto,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String resultId = taxDeclarationService.updateDeclaration(id, dto);
        return ResponseEntity.ok(resultId);
    }

    @PutMapping("/declarations/{id}/verify")
    public ResponseEntity<String> verifyDeclaration(
            @PathVariable("id") String id,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String resultId = taxDeclarationService.verifyDeclaration(id, user.getUserId());
        return ResponseEntity.ok(resultId);
    }

    // ======================== Tax Computation ========================

    @GetMapping("/computation")
    public ResponseEntity<List<TaxComputationDTO>> getComputation(
            @RequestParam("employeeId") String employeeId,
            @RequestParam("fy") String financialYear,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        List<TaxComputationDTO> computations = taxComputationService.getComputation(employeeId, financialYear);
        return ResponseEntity.ok(computations);
    }
}
