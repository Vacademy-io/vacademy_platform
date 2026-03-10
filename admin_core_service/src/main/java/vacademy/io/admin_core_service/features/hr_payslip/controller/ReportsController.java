package vacademy.io.admin_core_service.features.hr_payslip.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.hr_payslip.dto.BankExportDTO;
import vacademy.io.admin_core_service.features.hr_payslip.dto.BankExportRequestDTO;
import vacademy.io.admin_core_service.features.hr_payslip.service.BankExportService;
import vacademy.io.admin_core_service.features.hr_payslip.service.HrReportService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin-core-service/api/v1/hr/reports")
public class ReportsController {

    @Autowired
    private BankExportService bankExportService;

    @Autowired
    private HrReportService hrReportService;

    @Autowired
    private InstituteAccessValidator instituteAccessValidator;

    @PostMapping("/bank-export")
    public ResponseEntity<byte[]> generateBankExport(
            @RequestBody BankExportRequestDTO requestDTO,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String csvContent = bankExportService.generateBankExport(requestDTO, user.getUserId());
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv"));
        headers.setContentDispositionFormData("attachment", "bank_export.csv");
        return new ResponseEntity<>(csvContent.getBytes(StandardCharsets.UTF_8), headers, HttpStatus.OK);
    }

    @GetMapping("/bank-export")
    public ResponseEntity<List<BankExportDTO>> getBankExports(
            @RequestParam("payrollRunId") String payrollRunId,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        List<BankExportDTO> exports = bankExportService.getBankExports(payrollRunId);
        return ResponseEntity.ok(exports);
    }

    @GetMapping("/payroll-summary")
    public ResponseEntity<Map<String, Object>> getPayrollSummary(
            @RequestParam("instituteId") String instituteId,
            @RequestParam("month") Integer month,
            @RequestParam("year") Integer year,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        Map<String, Object> summary = hrReportService.getPayrollSummary(instituteId, month, year);
        return ResponseEntity.ok(summary);
    }
}
