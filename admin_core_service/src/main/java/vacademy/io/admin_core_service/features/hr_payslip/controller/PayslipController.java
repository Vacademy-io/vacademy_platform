package vacademy.io.admin_core_service.features.hr_payslip.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.hr_payslip.dto.GeneratePayslipDTO;
import vacademy.io.admin_core_service.features.hr_payslip.dto.PayslipDTO;
import vacademy.io.admin_core_service.features.hr_payslip.service.PayslipService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/api/v1/hr/payslips")
public class PayslipController {

    @Autowired
    private PayslipService payslipService;

    @Autowired
    private InstituteAccessValidator instituteAccessValidator;

    @PostMapping("/generate")
    public ResponseEntity<String> generatePayslips(
            @RequestBody GeneratePayslipDTO dto,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String result = payslipService.generatePayslips(dto.getPayrollRunId());
        return ResponseEntity.ok(result);
    }

    @GetMapping
    public ResponseEntity<List<PayslipDTO>> getPayslips(
            @RequestParam("employeeId") String employeeId,
            @RequestParam(value = "year", required = false) Integer year,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        List<PayslipDTO> payslips = payslipService.getPayslips(employeeId, year);
        return ResponseEntity.ok(payslips);
    }

    @GetMapping("/{id}")
    public ResponseEntity<PayslipDTO> getPayslipById(
            @PathVariable("id") String id,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        PayslipDTO payslip = payslipService.getPayslipById(id);
        return ResponseEntity.ok(payslip);
    }
}
